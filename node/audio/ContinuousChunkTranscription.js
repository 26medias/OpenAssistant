const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const TranscriptionEditor = require('./TranscriptionEditor');

class ContinuousChunkTranscription {
    constructor(options) {
        this.openai = new OpenAI.OpenAI();
        this.live = options.live;
        this.model = options.model;
        this.editor = new TranscriptionEditor();
        this.transcripts = [];
        this.trimStart = options.trimStart;
        this.trimEnd = options.trimEnd;
        this.silenceThresholdMs = options.silenceThresholdMs;
        this.onCommand = options.onCommand;
        this.lastWordEndTime = 0; // Track end time of the last word processed in milliseconds
        this.currentSentence = '';
        this.reset();
    }

    displayTs(ts) {
        const d = new Date(ts)
        return `[${d.getHours()}:${d.getMinutes()}:${d.getSeconds()}:${d.getMilliseconds()}]`
    }


    /*
        Logic:
            start:
                currentSentence = ''
            processNext:
                if has silence:
                    if curr_break_cue: // not first break in this transcription
                        currentSentence += transcription[curr_break_cue:word.start-0.01] // Get relevant slice
                        onCommand(currentSentence)
                        currentSentence = ''
                        curr_break_cue = word.start-0.01
                    else: // first break in this transcription
                        currentSentence += transcription[:word.start-0.01]
                        onCommand(currentSentence)
                        currentSentence = ''
                        curr_break_cue = word.start-0.01
                else:
                    currentSentence += transcription
    */

    async processNext(filename) {
        const transcription = await this._transcribe(filename, this.previousTranscription);
        const { start, end } = this._parseFilename(filename); // Ensure these are epoch times in milliseconds

        if (transcription.words.length === 0) {
            this.transcripts.push('[silence]');
            if (this.live) {
                // Live transcription, check if there's a breaking silence
                let silenceDuration = new Date().getTime() - this.lastWordEndTime;
                if (silenceDuration > this.silenceThresholdMs) {
                    this.onCommand(this.currentSentence, silenceDuration)
                    this.currentSentence = ''
                }
            }
            return '[silence]';
        }

        this.trimIndex = 0; //this.trimStart;
        let curr_break_cue = null;
    
        const editedTranscript = transcription.text;//this.editor.edit(transcription, [this.trimStart, this.trimEnd]);
        this.previousTranscription = editedTranscript; 

        //console.log('----------------------------')

        transcription.words.forEach((word, index) => {
            let wordStartTimeMs = start + (word.start * 1000);
            let wordEndTimeMs = start + (word.end * 1000);
    
            let silenceDuration = (!this.lastWordEndTime ? 0 : wordStartTimeMs - this.lastWordEndTime)/1000;

            //console.log("> ", this.displayTs(wordStartTimeMs), silenceDuration.toFixed(2), '   \t', word.word, '   \t')

            if (silenceDuration >= this.silenceThresholdMs) {
                if (curr_break_cue) {
                    // not first break in this transcription
                    const transcriptionSlice = this.editor.edit(transcription, [curr_break_cue, word.start-0.01]);
                    this.currentSentence += transcriptionSlice;
                    this.onCommand(this.currentSentence, silenceDuration)
                    this.currentSentence = ''
                    curr_break_cue = word.start-0.01
                } else {
                    // first break in this transcription
                    const transcriptionSlice = this.editor.edit(transcription, [0, word.start-0.01]);
                    this.currentSentence += transcriptionSlice;
                    this.onCommand(this.currentSentence, silenceDuration)
                    this.currentSentence = ''
                    curr_break_cue = word.start-0.01
                }
            }

            this.lastWordEndTime = wordEndTimeMs; // Update for next word or next file
        });

        if (!curr_break_cue) {
            //console.log('[[ NO BREAK IN FILE ]]')
            this.currentSentence += editedTranscript
        } else {
            const transcriptionSlice = this.editor.edit(transcription, [curr_break_cue, 10000000]);
            //console.log(`[[ SAVE: ${transcriptionSlice} ]]`)
            this.currentSentence += transcriptionSlice;
        }
    
        this.transcripts.push(editedTranscript);
        return editedTranscript;
    }
    
    
    

    getTranscription() {
        // Final call to onCommand for any remaining text in currentSentence
        /*if (this.currentSentence.trim()) {
            this.onCommand(this.currentSentence.trim(), -1);
            this.currentSentence = '';
        }*/
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
                prompt: `previous transcription: ${previousTranscription}`,
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
