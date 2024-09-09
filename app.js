import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import ffmpeg from 'fluent-ffmpeg';
import { Worker } from 'worker_threads';

const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);

class VideoUtility {
  constructor() {
    this.supportedFormats = ['mp4', 'webm', 'avi'];
    this.effects = ['none', 'grayscale', 'sepia', 'vignette'];
    this.speedRange = { min: 1, max: 20 };
  }

  async processVideo(inputPath, options = {}) {
    const {
      speed = 1,
      music,
      effect = 'none',
      outputFormat = 'mp4',
      outputPath,
      trim,
      subtitles
    } = options;

    if (!this.supportedFormats.includes(outputFormat)) {
      throw new Error(`Unsupported output format: ${outputFormat}`);
    }

    if (!this.effects.includes(effect)) {
      throw new Error(`Unsupported effect: ${effect}`);
    }

    if (speed < this.speedRange.min || speed > this.speedRange.max) {
      throw new Error(`Speed must be between ${this.speedRange.min}x and ${this.speedRange.max}x`);
    }

    const output = outputPath || this.generateOutputPath(inputPath, outputFormat);

    return new Promise((resolve, reject) => {
      let command = ffmpeg(inputPath)
        .videoFilters(`setpts=${1/speed}*PTS`)
        .outputOptions('-preset ultrafast')
        .outputOptions('-hwaccel auto');

      if (music) {
        command = command.input(music).audioFilters(`asetpts=${speed}*PTS`);
      }

      if (effect !== 'none') {
        command = command.videoFilters(effect);
      }

      if (trim) {
        const { start, duration } = trim;
        command = command.setStartTime(start).setDuration(duration);
      }

      if (subtitles) {
        command = command.videoFilters(`subtitles=${subtitles}`);
      }

      command
        .toFormat(outputFormat)
        .on('progress', this.onProgress)
        .on('end', () => resolve(output))
        .on('error', reject)
        .save(output);
    });
  }

  generateOutputPath(inputPath, format) {
    const dir = path.dirname(inputPath);
    const name = path.basename(inputPath, path.extname(inputPath));
    return path.join(dir, `${name}_processed.${format}`);
  }

  onProgress(progress) {
    console.log(`Processing: ${progress.percent.toFixed(2)}% done`);
  }

  async batchProcess(inputDir, options) {
    const files = await readdir(inputDir);
    const videoFiles = await Promise.all(
      files.map(async (file) => {
        const filePath = path.join(inputDir, file);
        const stats = await stat(filePath);
        return stats.isFile() && this.supportedFormats.includes(path.extname(file).slice(1))
          ? filePath
          : null;
      })
    );

    const validVideos = videoFiles.filter(Boolean);

    return Promise.all(
      validVideos.map((video) => this.processVideo(video, options))
    );
  }

  async processWithWorker(inputPath, options) {
    return new Promise((resolve, reject) => {
      const worker = new Worker('./videoProcessingWorker.js');
      worker.on('message', resolve);
      worker.on('error', reject);
      worker.postMessage({ inputPath, options });
    });
  }

  async mergeVideos(inputPaths, outputPath) {
    return new Promise((resolve, reject) => {
      const command = ffmpeg();
      inputPaths.forEach(inputPath => {
        command.input(inputPath);
      });

      command
        .on('error', reject)
        .on('end', () => resolve(outputPath))
        .mergeToFile(outputPath, './temp');
    });
  }
}

const videoUtility = new VideoUtility();

export default videoUtility;

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [,, inputPath, ...args] = process.argv;
  const options = Object.fromEntries(
    args.map(arg => arg.split('='))
  );

  videoUtility.processVideo(inputPath, options)
    .then(output => console.log(`Video processed successfully: ${output}`))
    .catch(error => console.error(`Error processing video: ${error.message}`));
}