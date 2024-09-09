# Video Utility in Node.js

## Project Overview

The Video Utility is a powerful Node.js application designed to process and enhance videos using FFmpeg. It offers a range of features for video manipulation, including speed adjustment, background music addition, and visual effects application. The project is built with scalability and performance in mind, utilizing modern Node.js features and best practices.

## Features

### Current Features
- Speed up videos by a factor of 1x to 20x
- Add background music to videos
- Apply visual effects (grayscale, sepia, vignette)
- Support for multiple output formats (MP4, WebM, AVI)
- Batch processing for multiple videos
- Progress tracking during video processing

### Planned Enhancements
- Multiple audio track support
- Custom visual effect templates
- Video trimming and merging
- Subtitle integration
- Command-line interface (CLI) for easy usage
- Web-based user interface for non-technical users

## Architecture

The Video Utility is built using a modular architecture to allow for easy feature additions and maintenance. The main components are:

1. **VideoUtility Class**: The core of the application, handling video processing logic.
2. **Worker Threads**: Used for parallel processing of videos.
3. **FFmpeg Integration**: Leverages the `fluent-ffmpeg` library for video manipulation.

### Module Interactions

1. The `VideoUtility` class is instantiated in `app.js`.
2. User input (via CLI or future UI) is passed to the `processVideo` or `batchProcess` methods.
3. These methods use FFmpeg commands to process the video(s).
4. For batch processing or heavy workloads, worker threads can be utilized via the `processWithWorker` method.

## Installation

1. Ensure you have Node.js (v12 or later) installed on your system.
2. Clone the repository:
   ```
   git clone https://github.com/your-repo/video-utility.git
   cd video-utility
   ```
3. Install dependencies:
   ```
   npm install
   ```
4. Install FFmpeg on your system if not already present.

## Usage

### Basic Usage

To process a single video:

```javascript
const videoUtility = require('./app.js');

videoUtility.processVideo('path/to/input.mp4', {
  speed: 2,
  music: 'path/to/music.mp3',
  effect: 'sepia',
  outputFormat: 'mp4'
})
.then(output => console.log(`Video processed: ${output}`))
.catch(error => console.error(`Error: ${error.message}`));
```

### Batch Processing

To process multiple videos in a directory:

```javascript
videoUtility.batchProcess('path/to/video/directory', {
  speed: 1.5,
  effect: 'grayscale',
  outputFormat: 'webm'
})
.then(outputs => console.log(`Processed videos: ${outputs.join(', ')}`))
.catch(error => console.error(`Error: ${error.message}`));
```

### CLI Usage

The utility can be used from the command line:

```
node app.js path/to/input.mp4 speed=2 music=path/to/music.mp3 effect=sepia outputFormat=mp4
```

## Technical Considerations

- **Modular Architecture**: The project is designed with modularity in mind, allowing for easy feature additions and maintenance.
- **Streaming**: The application uses Node.js streams for efficient memory usage during processing.
- **Error Handling**: Comprehensive error handling and logging are implemented for better debugging.
- **Testing**: Unit tests and integration tests are planned to ensure reliability.
- **Parallel Processing**: Worker threads are utilized for handling multiple videos or heavy processing tasks.
- **Progress Tracking**: The application provides real-time progress updates during video processing.

## Performance Optimization

- **Caching**: Frequently used audio and effect assets are cached for faster processing.
- **Hardware Acceleration**: The application is designed to use hardware acceleration when available.
- **FFmpeg Optimization**: FFmpeg command parameters are optimized for faster processing.

## Contributing

Contributions to the Video Utility project are welcome! Please refer to the contributing guidelines in the repository for more information on how to submit pull requests, report issues, or request features.

## License

This project is licensed under the MIT License. See the LICENSE file in the repository for full details.

---

This documentation provides a comprehensive overview of the Video Utility project, including its features, architecture, usage instructions, and technical considerations. As the project evolves, remember to keep this documentation updated to reflect any new features or changes in the application structure.