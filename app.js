import fs from "fs";
import path from "path";
import { promisify } from "util";
import ffmpeg from "fluent-ffmpeg";
import { Worker } from "worker_threads";
import { fileURLToPath } from "url";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import ProgressBar from "progress";

const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);

class VideoUtility {
    constructor() {
        this.supportedFormats = ["mp4", "webm", "avi"];
        this.effects = ["none", "grayscale", "sepia", "vignette"];
        this.speedRange = { min: 1, max: 20 };
        this.cacheDir = path.join(process.cwd(), "cache");
        this.ensureCacheDir();
    }

    ensureCacheDir() {
        if (!fs.existsSync(this.cacheDir)) {
            fs.mkdirSync(this.cacheDir, { recursive: true });
        }
    }

    async processVideo(inputPath, options = {}) {
        const { speed = 1, music, effect = "none", outputFormat = "mp4", outputPath, trim, subtitles } = options;

        this.validateOptions(speed, effect, outputFormat);

        const output = outputPath || this.generateOutputPath(inputPath, outputFormat);
        const cachedAudio = music ? await this.cacheAudio(music) : null;
        const cachedSubtitles = subtitles ? await this.cacheSubtitles(subtitles) : null;

        return new Promise((resolve, reject) => {
            let command = ffmpeg(inputPath)
                .videoFilters(`setpts=${1 / speed}*PTS`)
                .outputOptions("-preset ultrafast")
                .outputOptions("-hwaccel auto");

            if (cachedAudio) {
                command = command.input(cachedAudio).audioFilters(`asetpts=${speed}*PTS`);
            }

            if (effect !== "none") {
                command = command.videoFilters(effect);
            }

            if (trim) {
                const { start, duration } = trim;
                command = command.setStartTime(start).setDuration(duration);
            }

            if (cachedSubtitles) {
                command = command.videoFilters(`subtitles=${cachedSubtitles}`);
            }

            const progressBar = new ProgressBar("Processing [:bar] :percent :etas", {
                complete: "=",
                incomplete: " ",
                width: 20,
                total: 100,
            });

            command
                .toFormat(outputFormat)
                .on("progress", (progress) => {
                    progressBar.update(progress.percent / 100);
                })
                .on("end", () => resolve(output))
                .on("error", reject)
                .save(output);
        });
    }

    validateOptions(speed, effect, outputFormat) {
        if (!this.supportedFormats.includes(outputFormat)) {
            throw new Error(`Unsupported output format: ${outputFormat}`);
        }

        if (!this.effects.includes(effect)) {
            throw new Error(`Unsupported effect: ${effect}`);
        }

        if (speed < this.speedRange.min || speed > this.speedRange.max) {
            throw new Error(`Speed must be between ${this.speedRange.min}x and ${this.speedRange.max}x`);
        }
    }

    generateOutputPath(inputPath, format) {
        const dir = path.dirname(inputPath);
        const name = path.basename(inputPath, path.extname(inputPath));
        return path.join(dir, `${name}_processed.${format}`);
    }

    async cacheAudio(audioPath) {
        const cacheKey = `audio_${path.basename(audioPath)}`;
        const cachePath = path.join(this.cacheDir, cacheKey);

        if (!fs.existsSync(cachePath)) {
            await fs.promises.copyFile(audioPath, cachePath);
        }

        return cachePath;
    }

    async cacheSubtitles(subtitlesPath) {
        const cacheKey = `subtitles_${path.basename(subtitlesPath)}`;
        const cachePath = path.join(this.cacheDir, cacheKey);

        if (!fs.existsSync(cachePath)) {
            await fs.promises.copyFile(subtitlesPath, cachePath);
        }

        return cachePath;
    }

    async batchProcess(inputDir, options) {
        const files = await readdir(inputDir);
        const videoFiles = await Promise.all(
            files.map(async (file) => {
                const filePath = path.join(inputDir, file);
                const stats = await stat(filePath);
                return stats.isFile() && this.supportedFormats.includes(path.extname(file).slice(1)) ? filePath : null;
            })
        );

        const validVideos = videoFiles.filter(Boolean);

        return Promise.all(validVideos.map((video) => this.processVideo(video, options)));
    }

    async processWithWorker(inputPath, options) {
        return new Promise((resolve, reject) => {
            const worker = new Worker("./videoProcessingWorker.js");
            worker.on("message", resolve);
            worker.on("error", reject);
            worker.postMessage({ inputPath, options });
        });
    }

    async mergeVideos(inputPaths, outputPath) {
        return new Promise((resolve, reject) => {
            const command = ffmpeg();
            inputPaths.forEach((inputPath) => {
                command.input(inputPath);
            });

            command
                .on("error", reject)
                .on("end", () => resolve(outputPath))
                .mergeToFile(outputPath, "./temp");
        });
    }

    async convertToGif(inputPath, outputPath, options = {}) {
        const { fps = 10, width = 320 } = options;

        return new Promise((resolve, reject) => {
            ffmpeg(inputPath)
                .outputOptions([
                    `-vf fps=${fps},scale=${width}:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse`,
                ])
                .toFormat("gif")
                .on("end", () => resolve(outputPath))
                .on("error", reject)
                .save(outputPath);
        });
    }
}

const videoUtility = new VideoUtility();

export default videoUtility;

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const argv = yargs(hideBin(process.argv))
        .option("input", {
            alias: "i",
            describe: "Input video file or directory",
            type: "string",
            demandOption: true,
        })
        .option("speed", {
            alias: "s",
            describe: "Playback speed (1-20)",
            type: "number",
            default: 1,
        })
        .option("music", {
            alias: "m",
            describe: "Background music file",
            type: "string",
        })
        .option("effect", {
            alias: "e",
            describe: "Visual effect to apply",
            choices: videoUtility.effects,
            default: "none",
        })
        .option("format", {
            alias: "f",
            describe: "Output format",
            choices: videoUtility.supportedFormats,
            default: "mp4",
        })
        .option("output", {
            alias: "o",
            describe: "Output file or directory",
            type: "string",
        })
        .option("batch", {
            alias: "b",
            describe: "Process all videos in the input directory",
            type: "boolean",
            default: false,
        })
        .option("gif", {
            alias: "g",
            describe: "Convert to GIF",
            type: "boolean",
            default: false,
        }).argv;

    const options = {
        speed: argv.speed,
        music: argv.music,
        effect: argv.effect,
        outputFormat: argv.format,
        outputPath: argv.output,
    };

    const processVideos = async () => {
        if (argv.batch) {
            const results = await videoUtility.batchProcess(argv.input, options);
            console.log(`Batch processing complete. Processed ${results.length} videos.`);
        } else {
            const output = await videoUtility.processVideo(argv.input, options);
            console.log(`Video processed successfully: ${output}`);

            if (argv.gif) {
                const gifOutput = output.replace(/\.[^/.]+$/, ".gif");
                await videoUtility.convertToGif(output, gifOutput);
                console.log(`GIF created: ${gifOutput}`);
            }
        }
    };

    processVideos().catch((error) => console.error(`Error processing video: ${error.message}`));
}
