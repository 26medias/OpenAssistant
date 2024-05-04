const fs = require('fs');

class TranscriptionEditor {
    edit(transcriptionData, timeRange) {
        const startTime = timeRange[0];
        const endTime = timeRange[1];
        let editedTranscription = '';

        // Initialize a flag to mark when to start including words
        let startIncluded = false;

        transcriptionData.words.forEach(word => {
            // Check if the word is within the time range
            if (word.start >= startTime && word.end <= endTime) {
                startIncluded = true; // Set the flag to true once we start including words

                const wordText = word.word;
                const wordIndex = transcriptionData.text.indexOf(wordText);

                // Check if the next character in the original text is a punctuation mark
                const nextCharIndex = wordIndex + wordText.length;
                if (nextCharIndex < transcriptionData.text.length && /[^\w\s]/.test(transcriptionData.text[nextCharIndex])) {
                    editedTranscription += wordText + transcriptionData.text[nextCharIndex] + ' ';
                } else {
                    editedTranscription += wordText + ' ';
                }
            } else if (word.end > endTime) {
                return editedTranscription.trim();
            } else if (startIncluded && word.start > endTime) {
                return editedTranscription.trim();
            }
        });

        return editedTranscription.trim();
    }

    editFile(filename, timeRange) {
        const data = JSON.parse(fs.readFileSync(filename, 'utf8'));
        return this.edit(data, timeRange);
    }
}
/*
const editor = new TranscriptionEditor();
const editedTranscription = editor.editFile('cache/1714706294033_1714706304033.wav.json', [1.0, 9.0]);
console.log(editedTranscription); */

module.exports = TranscriptionEditor;
