const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const TranscriptionEditor = require('./TranscriptionEditor');

class ContinuousChunkTranscription {
    constructor(options) {
        this.openai = new OpenAI.OpenAI();
        this.model = options.model;
        this.editor = new TranscriptionEditor();
        this.transcripts = [];
        this.trimStart = options.trimStart;
        this.trimEnd = options.trimEnd;
        this.silenceThresholdMs = options.silenceThresholdMs;
        this.onCommand = options.onCommand;
        this.lastWordEndTime = 0; // Track end time of the last word processed in milliseconds
        this.currentSentence = '';
    }

    displayTs(ts) {
        const d = new Date(ts)
        return `[${d.getHours()}:${d.getMinutes()}:${d.getSeconds()}]`
    }

    async processNext(filename) {
        const transcription = await this._transcribe(filename);
        const { start, end } = this._parseFilename(filename); // Ensure these are epoch times in milliseconds
    
        if (transcription.words.length === 0) {
            this.transcripts.push('[silence]');
            return '[silence]';
        }
    
        //console.log("-----------")
        //console.log(filename);
        //console.log('');
        transcription.words.forEach((word, index) => {
            let wordStartTimeMs = start + (word.start * 1000); // Correctly calculating word start time
            let wordEndTimeMs = start + (word.end * 1000); // Correctly calculating word end time
    
            /*let silenceDuration = index === 0
                ? (wordStartTimeMs - this.lastWordEndTime) // Silence between files
                : (wordStartTimeMs - transcription.words[index - 1].end * 1000 + start); // Silence within the file*/
            
            let silenceDuration = (!this.lastWordEndTime ? 0 : wordStartTimeMs - this.lastWordEndTime)/1000;

            //console.log("# ", word.word, '      \t', this.displayTs(wordStartTimeMs), silenceDuration, `  \t|> ${wordStartTimeMs} - ${this.lastWordEndTime}`)
    
            if (silenceDuration > this.silenceThresholdMs && this.currentSentence) {
                this.onCommand(this.currentSentence.trim(), silenceDuration);
                this.currentSentence = '';
            }
    
            this.currentSentence += ` ${word.word}`;
            this.lastWordEndTime = wordEndTimeMs; // Update for next word or next file
        });
    
        this.transcripts.push(this.currentSentence.trim());
        this.currentSentence = ''; // Reset for next usage
        return this.currentSentence;
    }
    
    
    

    getTranscription() {
        // Final call to onCommand for any remaining text in currentSentence
        if (this.currentSentence.trim()) {
            this.onCommand(this.currentSentence.trim(), -1);
            this.currentSentence = '';
        }
        return this.transcripts.join(' ');
    }

    reset() {
        this.transcripts = [];
        this.currentSentence = '';
        this.lastWordEndTime = 0;
    }

    async _transcribe(filename) {
        const cacheDir = path.join(__dirname, 'cache');
        const cachePath = path.join(cacheDir, `${path.basename(filename)}.json`);

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

            if (!fs.existsSync(cacheDir)) {
                fs.mkdirSync(cacheDir);
            }

            fs.writeFileSync(cachePath, JSON.stringify(transcription), 'utf8');

            return transcription;
        }
    }

    _parseFilename(filename) {
        const pattern = /(\d+)_(\d+).wav$/;
        const match = filename.match(pattern);
        return {
            start: parseInt(match[1], 10), // Assuming these are milliseconds
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
        silenceThresholdMs: 0.3,
        onCommand: function(text, silenceDuration) {
            console.log('>> ['+silenceDuration+']', text)
        }
    });

    const audioDir = path.join(__dirname, 'audio5');
    // Read all files from the audio directory
    const files = fs.readdirSync(audioDir).sort();

    // Process each file in order
    for (const file of files) {
        if (path.extname(file) === '.wav') { // Make sure to process only .wav files
            const fullPath = path.join(audioDir, file);
            //console.log(`Processing ${file}...`);
            const result = await tr.processNext(fullPath);
            //console.log("out:", result);
        }
    }

    console.log("------");
    console.log(tr.getTranscription());
})()
*/


module.exports = ContinuousChunkTranscription;
