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
        return `[${d.getHours()}:${d.getMinutes()}:${d.getSeconds()}:${d.getMilliseconds()}]`
    }

    async processNext(filename) {
        const transcription = await this._transcribe(filename, this.previousTranscription);
        const { start, end } = this._parseFilename(filename); // Ensure these are epoch times in milliseconds

        if (transcription.words.length === 0) {
            this.transcripts.push('[silence]');
            return '[silence]';
        }

        this.trimIndex = 0; //this.trimStart;
        let lastTriggeredCue = null;
    
        const editedTranscript = transcription.text;//this.editor.edit(transcription, [this.trimStart, this.trimEnd]);
        this.previousTranscription = editedTranscript; 

        console.log('----------------------------')
        console.log(filename)
        console.log('')

        transcription.words.forEach((word, index) => {
            let wordStartTimeMs = start + (word.start * 1000); // Correctly calculating word start time
            let wordEndTimeMs = start + (word.end * 1000); // Correctly calculating word end time
    
            let silenceDuration = (!this.lastWordEndTime ? 0 : wordStartTimeMs - this.lastWordEndTime)/1000;

            console.log("> ", this.displayTs(wordStartTimeMs), word.word, '   \t', silenceDuration, '   \t')

            //this.currentSentence += ` ${word.word}`;

            if (silenceDuration >= this.silenceThresholdMs) {
                this.currentSentence += this.editor.edit(transcription, [this.trimIndex, word.end]);
                lastTriggeredCue = word.end;
                this.trimIndex = word.end;
                this.onCommand(this.currentSentence, silenceDuration);
                this.currentSentence = '';
            }

            this.lastWordEndTime = wordEndTimeMs; // Update for next word or next file
        });

        if (lastTriggeredCue) {
            this.currentSentence += this.editor.edit(transcription, [lastTriggeredCue, this.trimEnd]);
        } else {
            this.currentSentence += editedTranscript;
        }
    
        this.transcripts.push(editedTranscript);
        return editedTranscript;
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

    async _transcribe(filename, previousTranscription) {
        const cacheDir = path.join(__dirname, 'cache');
        const cachePath = path.join(cacheDir, `${path.basename(filename)}.json`);

        if (fs.existsSync(cachePath)) {
            return JSON.parse(fs.readFileSync(cachePath, 'utf8'));
        } else {
            const fileStream = fs.createReadStream(filename);
            const transcription = await this.openai.audio.transcriptions.create({
                file: fileStream,
                model: this.model,
                prompt: previousTranscription,
                language: 'en',
                response_format: "verbose_json",
                timestamp_granularities: ["word"]
            });

            if (!fs.existsSync(cacheDir)) {
                fs.mkdirSync(cacheDir);
            }

            fs.writeFileSync(cachePath, JSON.stringify(transcription, null, 4), 'utf8');

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

module.exports = ContinuousChunkTranscription;
