#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <fcntl.h>
#include <alsa/asoundlib.h>

#define SAMPLE_RATE 44100  // Common audio sample rate
#define CHANNELS 2        // Stereo channels
#define BLOCK_SIZE 1024     // ALSA buffer size (adjust as needed)

// Function prototypes
int open_microphone(snd_pcm_t** pcm_handle);
void close_microphone(snd_pcm_t* pcm_handle);
int record_audio_chunk(snd_pcm_t* pcm_handle, int chunk_duration_sec, const char* dir);
void write_wav_header(FILE* wav_file, int chunk_duration);

int main(int argc, char* argv[]) {
    if (argc != 3) {
        fprintf(stderr, "Usage: %s <chunkDuration> <directory>\n", argv[0]);
        return 1;
    }

    int chunk_duration_sec = atoi(argv[1]);
    const char* dir = argv[2];

    // Create output directory (if it doesn't exist)
    if (access(dir, F_OK) == -1) {
        if (mkdir(dir, 0755) == -1) {
            perror("mkdir");
            return 1;
        }
    }

    snd_pcm_t* pcm_handle;
    if (open_microphone(&pcm_handle) != 0) {
        return 1;
    }

    while (1) {
        record_audio_chunk(pcm_handle, chunk_duration_sec, dir);
    }

    close_microphone(pcm_handle);
    return 0;
}

// Opens the default microphone and sets necessary parameters
int open_microphone(snd_pcm_t** pcm_handle) {
    int err;

    // Open capture device
    if ((err = snd_pcm_open(pcm_handle, "hw:0,0", SND_PCM_STREAM_CAPTURE, 0)) < 0) {
        fprintf(stderr, "Cannot open PCM device: %s\n", snd_strerror(err));
        return 1;
    }

    // Set hardware parameters
    snd_pcm_hw_params_t* hw_params;
    snd_pcm_hw_params_allocargs_t* hw_params_args;

    if ((err = snd_pcm_hw_params_allocargs(&hw_params_args)) < 0) {
        fprintf(stderr, "PCM hardware parameters allocation failed: %s\n", snd_strerror(err));
        snd_pcm_close(*pcm_handle);
        return 1;
    }

    snd_pcm_hw_params_any(pcm_handle, hw_params_args);
    hw_params = snd_pcm_hw_params_current(*pcm_handle, hw_params_args);

    // Set access type
    if ((err = snd_pcm_hw_params_set_access(hw_params, SND_PCM_ACCESS_RW_INTERLEAVED)) < 0) {
        fprintf(stderr, "Failed to set access type: %s\n", snd_strerror(err));
        snd_pcm_hw_params_free(hw_params);
        snd_pcm_close(*pcm_handle);
        return 1;
    }

    // Set sample format (16-bit signed PCM is common)
    if ((err = snd_pcm_hw_params_set_format(hw_params, SND_PCM_FORMAT_S16_LE)) < 0) {
        fprintf(stderr, "Failed to set sample format: %s\n", sndstrerror(err));
        snd_pcm_hw_params_free(hw_params);
        snd_pcm_close(*pcm_handle);
        return 1;
    }

    // Set channels
    if ((err = snd_pcm_hw_params_set_channels(hw_params, CHANNELS)) < 0) {
        fprintf(stderr, "Failed to set channels: %s\n", snd_strerror(err));
        snd_pcm_hw_params_free(hw_params);
        snd_pcm_close(*pcm_handle);
        return 1;
    }

    // Set sample rate
    if ((err = snd_pcm_hw_params_set_rate(hw_params, SAMPLE_RATE, 0)) < 0) {
        fprintf(stderr, "Failed to set sample rate: %s\n", snd_strerror(err));
        snd_pcm_hw_params_free(hw_params);
        snd_pcm_close(*pcm_handle);
        return 1;
    }

    // Set buffer size (adjust if needed based on performance or latency)
    if ((err = snd_pcm_hw_params_set_buffer_size(hw_params, BLOCK_SIZE * 10)) < 0) { // Adjust multiplier as needed
        fprintf(stderr, "Failed to set buffer size: %s\n", sndstrerror(err));
        snd_pcm_hw_params_free(hw_params);
        snd_pcm_close(*pcm_handle);
        return 1;
    }

    // Apply hardware parameters
    if ((err = snd_pcm_hw_params(pcm_handle, hw_params)) < 0) {
        fprintf(stderr, "Failed to apply hardware parameters: %s\n", sndstrerror(err));
        snd_pcm_hw_params_free(hw_params);
        snd_pcm_close(*pcm_handle);
        return 1;
    }

    snd_pcm_hw_params_free(hw_params);
    return 0;
}

// Closes the opened microphone
void close_microphone(snd_pcm_t* pcm_handle) {
    snd_pcm_drain(pcm_handle);
    snd_pcm_close(pcm_handle);
}

// Records a chunk of audio and saves it to a WAV file
int record_audio_chunk(snd_pcm_t* pcm_handle, int chunk_duration_sec, const char* dir) {
    int bytes_to_read = chunk_duration_sec * SAMPLE_RATE * CHANNELS * sizeof(short);  // Calculate total bytes for chunk
    int bytes_read = 0;
    short audio_data[BLOCK_SIZE];  // Buffer for audio data

    // Generate unique filename for each chunk
    time_t now = time(NULL);
    struct tm* timeinfo = localtime(&now);
    char filename[100];
    strftime(filename, sizeof(filename), "%Y-%m-%d_%H-%M-%S", timeinfo);
    strcat(filename, ".wav");
    char filepath[256];
    snprintf(filepath, sizeof(filepath), "%s/%s", dir, filename);

    FILE* wav_file = fopen(filepath, "wb");
    if (wav_file == NULL) {
        fprintf(stderr, "Failed to open file for writing: %s\n", filepath);
        return 1;
    }

    write_wav_header(wav_file, chunk_duration_sec);  // Write WAV header

    while (bytes_read < bytes_to_read) {
        int res = snd_pcm_readi(pcm_handle, audio_data, BLOCK_SIZE);
        if (res < 0) {
            fprintf(stderr, "Failed to read audio data: %s\n", snd_strerror(res));
            fclose(wav_file);
            return 1;
        }

        int bytes_written = fwrite(audio_data, sizeof(short), res, wav_file);
        if (bytes_written != res) {
            fprintf(stderr, "Failed to write audio data to file\n");
            fclose(wav_file);
            return 1;
        }

        bytes_read += res * sizeof(short);
    }

    fclose(wav_file);
    return 0;
}

// Writes the WAV header to the specified file
void write_wav_header(FILE* wav_file, int chunk_duration) {
    int wav_size = 36 + chunk_duration * SAMPLE_RATE * CHANNELS * sizeof(short);  // Total file size

    // Chunk ID
    fwrite("RIFF", 1, 4, wav_file);

    // File size (little-endian)
    int size_le = wav_size;
    fwrite(&size_le, sizeof(int), 1, wav_file);

    // WAV format
    fwrite("WAVE", 1, 4, wav_file);

    // fmt chunk
    fwrite("fmt ", 1, 4, wav_file);
    int fmt_chunk_size = 16;  // Size of the fmt chunk
    fwrite(&fmt_chunk_size, sizeof(int), 1, wav_file);

    // Format (PCM)
    short format = 1;
    fwrite(&format, sizeof(short), 1, wav_file);

    // Channels (stereo)
    fwrite(&CHANNELS, sizeof(short), 1, wav_file);

    // Sample rate
    fwrite(&SAMPLE_RATE, sizeof(int), 1, wav_file);

    // Bytes per second (derived)
    int bytes_per_second = SAMPLE_RATE * CHANNELS * sizeof(short);
    fwrite(&bytes_per_second, sizeof(int), 1, wav_file);

    // Block alignment
    short block_align = CHANNELS * sizeof(short);
    fwrite(&block_align, sizeof(short), 1, wav_file);

    // Bits per sample
    short bits_per_sample = sizeof(short) * 8;  // 16-bit PCM
    fwrite(&bits_per_sample, sizeof(short), 1, wav_file);

    // Data chunk
    fwrite("data", 1, 4, wav_file);

    // Data size (chunk duration * data bytes per second)
    int data_size = chunk_duration * bytes_per_second;
    fwrite(&data_size, sizeof(int), 1, wav_file);
}