const ContinuousChunkRecorder = require("./ContinuousChunkRecorder");
const ContinuousChunkTranscription = require("./ContinuousChunkTranscription");

const tr = new ContinuousChunkTranscription({
    model: 'whisper-1',
    trimStart: 0.1,
    trimEnd: 6.9,
});

const rec = new ContinuousChunkRecorder({
    dir: 'audio2/',
    chunkLengthMs: 7000,
    marginMs: 500,
    onChunk: async function(filename, startTime, endTime) {
        console.log({filename, startTime, endTime})
        const result = await tr.processNext(filename);
        console.log(result);
    }
});
rec.start();

