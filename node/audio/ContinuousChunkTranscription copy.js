const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const TranscriptionEditor = require('./TranscriptionEditor');
const winkNLP = require('wink-nlp');
const its = require('wink-nlp/src/its.js');
const model = require('wink-eng-lite-web-model');
const nlp = winkNLP(model);

class ContinuousChunkTranscription {
    constructor(options) {
        this.openai = new OpenAI.OpenAI();
        this.model = options.model;
        this.editor = new TranscriptionEditor();
        this.transcripts = [];
        this.trimStart = options.trimStart || 0.25;
        this.trimEnd = options.trimEnd || 6.75;
    }

    async processNext(filename) {
        const transcription = await this._transcribe(filename);
        const { start, end } = this._parseFilename(filename);
        
        // Edit the transcription to get only the desired part
        const timeRange = this.transcripts.length == 0 ? [0, this.trimEnd] : [this.trimStart, this.trimEnd];
        const editedTranscript = this.editor.edit(transcription, timeRange);
        
        // Append the edited transcript to an array
        this.transcripts.push(editedTranscript);
        
        return editedTranscript;
    }

    getTranscription() {
        const fullText = this.transcripts.join(' ');
        const doc = nlp.readDoc(fullText);
        const sentences = doc.sentences().out(its.text);

        return fullText + "\n\n"+sentences.join('\n');
    }

    reset() {
        this.transcripts = [];
    }

    async _transcribe(filename) {
        const cacheDir = path.join(__dirname, 'cache');
        const cachePath = path.join(cacheDir, `${path.basename(filename)}.json`);

        // Check for cached data
        if (fs.existsSync(cachePath)) {
            return JSON.parse(fs.readFileSync(cachePath, 'utf8'));
        } else {
            const fileStream = fs.createReadStream(filename);
            const transcription = await this.openai.audio.transcriptions.create({
                file: fileStream,
                model: this.model,
                response_format: "verbose_json",
                timestamp_granularities: ["word"]
            });

            // Create cache directory if it does not exist
            if (!fs.existsSync(cacheDir)) {
                fs.mkdirSync(cacheDir);
            }

            // Cache the API response
            fs.writeFileSync(cachePath, JSON.stringify(transcription, null, 4), 'utf8');

            return transcription;
        }
    }

    _parseFilename(filename) {
        const pattern = /(\d+)_(\d+).wav$/;
        const match = filename.match(pattern);
        return {
            start: parseInt(match[1], 10),
            end: parseInt(match[2], 10)
        };
    }
}

/*
(async () => {
    const tr = new ContinuousChunkTranscription({
        model: 'whisper-1',
        trimStart: 0.1,
        trimEnd: 6.9,
    });

    const audioDir = path.join(__dirname, 'audio2');
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
})()*/

module.exports = ContinuousChunkTranscription;
