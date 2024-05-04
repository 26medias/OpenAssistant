'use strict';

const recorder = require('node-record-lpcm16');
const fs = require('fs');

class ContinuousChunkRecorder {
    constructor(options) {
        this.dir = options.dir;
        this.chunkLengthMs = options.chunkLengthMs;
        this.marginMs = options.marginMs;
        this.onChunk = options.onChunk;
        this.recorders = [];
        this.recorderIndex = 0;
    }

    start() {
        this._scheduleNextRecording(Date.now());
    }

    stop() {
        this.recorders.forEach(rec => rec.stop());
        this.recorders = [];
    }

    _scheduleNextRecording(startTime) {
        const endTime = startTime + this.chunkLengthMs;
        const marginTime = this.chunkLengthMs - this.marginMs;
        const filename = `${this.dir}/${startTime}_${endTime}.wav`;

        // Start recording
        const recording = recorder.record({
                recordProgram: '/usr/bin/sox',
                audioType: 'wav',
                channels: 1,
                threshold: 0,
        });
        
        const fileStream = fs.createWriteStream(filename, { encoding: 'binary' });
        recording.stream().pipe(fileStream);

        // Callback when a chunk is saved
        fileStream.on('finish', () => {
            this.onChunk(filename, startTime, endTime);
        });

        // Store the recorder instance to manage multiple recordings
        this.recorders[this.recorderIndex] = recording;

        // Schedule the next recording start before the current one ends
        setTimeout(() => {
            this._scheduleNextRecording(Date.now());
        }, marginTime);

        // Update recorder index, cycle between two recorders
        this.recorderIndex = (this.recorderIndex + 1) % 2;

        // Stop the current recording after its duration plus margin
        setTimeout(() => {
            recording.stop();
        }, this.chunkLengthMs);
    }
}

/*
const rec = new ContinuousChunkRecorder({
    dir: 'audio/',
    chunkLengthMs: 10000,
    marginMs: 2500,
    onChunk: function(filename, startTime, endTime) {
        console.log({filename, startTime, endTime})
    }
});
rec.start();
*/

module.exports = ContinuousChunkRecorder;
