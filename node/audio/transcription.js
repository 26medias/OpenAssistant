const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');

class ContinuousChunkTranscription {
    constructor(options) {
        this.openai = new OpenAI.OpenAI();
        this.model = options.model;
        this.fullTranscriptionText = '';
        this.lastEndTime = 0;
    }

    async processNext(filename) {
        const transcription = await this._transcribe(filename);
        const { start, end } = this._parseFilename(filename);

        // Adjust word timestamps to be absolute
        transcription.words.forEach(word => {
            word.start = start + word.start;
            word.end = start + word.end;
        });

        // Find overlapping words based on timestamp and remove them from the 'text'
        const firstNonOverlappingWordIndex = transcription.words.findIndex(word => word.start >= this.lastEndTime);

        if (firstNonOverlappingWordIndex !== -1) {
            // Extract the non-overlapping portion of text
            let nonOverlappingTextStart = transcription.words[firstNonOverlappingWordIndex].start - start;
            let nonOverlappingText = this._extractNonOverlappingText(transcription.text, nonOverlappingTextStart);
            this.fullTranscriptionText += " " + nonOverlappingText;
        }

        this.lastEndTime = transcription.words[transcription.words.length - 1].end;

        return this.fullTranscriptionText.trim();
    }

    getTranscription() {
        return this.fullTranscriptionText.trim();
    }

    reset() {
        this.fullTranscriptionText = '';
        this.lastEndTime = 0;
    }

    _extractNonOverlappingText(fullText, start) {
        const words = fullText.split(' ');
        const startPosition = Math.floor(start);
        let extractedText = words.slice(startPosition).join(' ');
        return extractedText;
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
            fs.writeFileSync(cachePath, JSON.stringify(transcription), 'utf8');

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
