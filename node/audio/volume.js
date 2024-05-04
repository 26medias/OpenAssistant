const record = require('node-record-lpcm16');

// Configuration for the recording
const recordingConfig = {
    sampleRate: 16000, // 16KHz sample rate
    threshold: 0.5, // Volume threshold
    verbose: false, // Verbose mode
};

// Start recording
const mic = record.record(recordingConfig);

// Event listener for when the microphone starts recording
mic.on('data', function(data) {
    // Calculate the volume
    const volume = calculateVolume(data);
    console.log('Volume:', volume);
});

// Function to calculate volume from audio data
function calculateVolume(data) {
    // Assuming data is an array of audio samples
    // Calculate volume based on the average absolute amplitude
    const sum = data.reduce((acc, val) => acc + Math.abs(val), 0);
    const average = sum / data.length;
    return average;
}

// Handle errors
mic.on('error', function(err) {
    console.error('Error:', err);
});

// Handle when the recording stops
mic.on('end', function() {
    console.log('Recording stopped');
});

// Handle Ctrl+C to stop recording
process.on('SIGINT', function() {
    mic.stop();
});
