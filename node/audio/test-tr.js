const fs = require('fs');
const path = require('path');
const ContinuousChunkRecorder = require("./ContinuousChunkRecorder");
const ContinuousChunkTranscription = require("./ContinuousChunkTranscription");

const config = {
    chunk: 4,
    trim: 0.05,
    silence: 0.2,
    dir: 'audio10'
}

const testTranscription = async () => {
    const tr = new ContinuousChunkTranscription({
        model: 'whisper-1',
        trimStart: config.trim,
        trimEnd: config.chunk-config.trim,
        silenceThresholdMs: config.silence,
        onCommand: function(text, silenceDuration) {
            console.log('>> ['+silenceDuration+']', text, '\n')
        }
    });

    const audioDir = path.join(__dirname, config.dir);
    // Read all files from the audio directory
    const files = fs.readdirSync(audioDir).sort();

    // Process each file in order
    for (const file of files) {
        if (path.extname(file) === '.wav') { // Make sure to process only .wav files
            const fullPath = path.join(audioDir, file);
            //console.log(`Processing ${file}...`);
            const result = await tr.processNext(fullPath);
            console.log("out:", result);
        }
    }

    console.log("------");
    console.log(tr.getTranscription());
}

testTranscription();