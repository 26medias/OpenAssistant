const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const winkNLP = require('wink-nlp');
const its = require('wink-nlp/src/its.js');
const model = require('wink-eng-lite-web-model');
const nlp = winkNLP(model);

class ContinuousChunkTranscription {
    constructor(options) {
        this.openai = new OpenAI.OpenAI();
        this.model = options.model;
        this.fullTranscriptionText = '';
        this.words = [];
    }

    async processNext(filename) {
        const { start, end } = this._parseFilename(filename);
        const transcription = await this._transcribe(filename);

        // Adjust word timestamps to be absolute based on the start time of the file
        const adjustedWords = transcription.words.map(word => ({
            ...word,
            start: start + word.start,
            end: start + word.end,
            word: word.word
        }));

        // Append adjusted words to the words array for full tracking
        this.words.push(...adjustedWords);

        // Update full transcription text
        this.fullTranscriptionText += " " + adjustedWords.map(word => word.word).join(" ");

        // Return only new transcription text from this chunk
        return adjustedWords.map(word => word.word).join(" ");
    }

    getTranscription() {
        // Use winkNLP to parse the full text and extract sentences
        const doc = nlp.readDoc(this.fullTranscriptionText.trim());
        const sentences = doc.sentences().out(its.text);

        // Map sentences to their start and end times based on the words array
        return this._mapSentencesToTimes(sentences);
    }

    reset() {
        this.fullTranscriptionText = '';
        this.words = [];
    }

    _mapSentencesToTimes(sentences) {
        let result = [];
        let sentenceIndex = 0;
        let wordIndex = 0;

        sentences.forEach((sentence) => {
            let start = this.words[wordIndex].start;
            let wordsInSentence = sentence.split(/\s+/).length;

            // Find end time of the last word in the sentence
            let end = this.words[wordIndex + wordsInSentence - 1].end;

            result.push({ start: start, end: end, text: sentence });

            // Update word index to the start of the next sentence
            wordIndex += wordsInSentence;
        });

        return result;
    }

    async _transcribe(filename) {
        const cacheDir = path.join(__dirname, 'cache');
        const cachePath = path.join(cacheDir, `${path.basename(filename)}.json`);

        // Check for cache
        if (fs.existsSync(cachePath)) {
            // Read the cached transcription
            return JSON.parse(fs.readFileSync(cachePath, 'utf8'));
        } else {
            // Perform the transcription via API
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

(async () => {
    const tr = new ContinuousChunkTranscription({
        model: 'whisper-1'
    });

    const audioDir = path.join(__dirname, 'audio');
    // Read all files from the audio directory
    const files = fs.readdirSync(audioDir).sort();

    // Process each file in order
    for (const file of files) {
        if (path.extname(file) === '.wav') { // Make sure to process only .wav files
            const fullPath = path.join(audioDir, file);
            console.log(`Processing ${file}...`);
            const result = await tr.processNext(fullPath);
            console.log(result);
        }
    }

    console.log("------");
    console.log(tr.getTranscription());
})()


module.exports = ContinuousChunkTranscription;
