const fs = require('fs');
const path = require('path');
const ContinuousChunkRecorder = require("./ContinuousChunkRecorder");
const ContinuousChunkTranscription = require("./ContinuousChunkTranscription");

const config = {
    chunk: 5,
    trim: 0.02,
    silence: 0.3,
    dir: 'audio14/'
}

function mkdirs(dir) {
    const dirname = path.join(__dirname, dir); // Building the full path using __dirname
    try {
        if (!fs.existsSync(dirname)) {
            fs.mkdirSync(dirname, { recursive: true });
            console.log(`Directory created: ${dirname}`);
        } else {
            console.log(`Directory already exists: ${dirname}`);
        }
    } catch (error) {
        console.error(`Error creating directory: ${error}`);
    }
}


mkdirs(config.dir)


const tr = new ContinuousChunkTranscription({
    model: 'whisper-1',
    trimStart: config.trim,
    trimEnd: config.chunk-config.trim,
    silenceThresholdMs: config.silence,
    live: true,
    onCommand: function(text, silenceDuration) {
        console.log('>> ['+silenceDuration.toFixed(2)+']', text)
    }
});

const rec = new ContinuousChunkRecorder({
    dir: config.dir,
    chunkLengthMs: config.chunk*1000,
    marginMs: (config.trim*2)*1000,
    onChunk: async function(filename, startTime, endTime) {
        //console.log({filename, startTime, endTime})
        const result = await tr.processNext(filename);
        //console.log(result);
    }
});
rec.start();
