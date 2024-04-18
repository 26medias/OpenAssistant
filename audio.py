import argparse
import datetime
import json
import os
import sys
import wave

import numpy as np
import requests
import sounddevice as sd


def int_or_str(text):
    """Helper function for argument parsing."""
    try:
        return int(text)
    except ValueError:
        return text


def record_audio(duration, volume_threshold, silence_threshold, fs):
    """Record audio from the microphone and return the data as numpy array."""
    def callback(indata, frames, time, status):
        """This function will be called for each audio block."""
        if status:
            print(status, file=sys.stderr)
        volume_norm = np.linalg.norm(indata) * 10
        if volume_norm < volume_threshold:
            raise sd.CallbackAbort  # Stop recording if below volume threshold
        sys.stdout.write('▒')
        sys.stdout.flush()

    with sd.InputStream(callback=callback, channels=1, samplerate=fs, dtype='int16'):
        try:
            print("\nRecording... (press Ctrl+C to stop)")
            myrecording = sd.rec(int(duration * fs), samplerate=fs, channels=1, dtype='int16')
            sd.wait()
        except KeyboardInterrupt:
            print("\nRecording stopped: KeyboardInterrupt")
        except sd.CallbackAbort:
            print("\nSilence detected, stopping recording")
        finally:
            myrecording = np.trim_zeros(myrecording.flatten(), 'f')
            return myrecording if myrecording.size > 0 else None


def save_wave_file(filename, data, fs):
    """Save a numpy array to a WAV file."""
    wavfile = wave.open(filename, 'wb')
    wavfile.setnchannels(1)
    wavfile.setsampwidth(2)  # 2 bytes per sample
    wavfile.setframerate(fs)
    wavfile.writeframes(data.tobytes())
    wavfile.close()
    print(f"File saved: {filename}")


def transcribe_audio(file_path, token, language='en', model='whisper-1', translate=False):
    """Transcribe audio using OpenAI's Whisper API."""
    headers = {
        'Authorization': f'Bearer {token}'
    }
    params = {
        'model': model,
        'language': language
    }
    files = {
        'file': open(file_path, 'rb')
    }
    if translate:
        url = "https://api.openai.com/v1/audio/translations"
    else:
        url = "https://api.openai.com/v1/audio/transcriptions"

    response = requests.post(url, headers=headers, files=files, data=params)
    transcription = response.json()
    print(json.dumps(transcription, indent=4))
    return transcription


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Whisper API Audio Recorder and Transcriber")
    parser.add_argument('-d', '--duration', type=float, default=30.0, help="Duration of the recording in seconds (for microphone input)")
    parser.add_argument('-v', '--volume', type=float, default=1.0, help="Volume threshold percentage (for microphone input)")
    parser.add_argument('-s', '--silence', type=float, default=1.5, help="Silence length to trigger recording stop (for microphone input)")
    parser.add_argument('-t', '--token', type=str, required=True, help="OpenAI API token")
    parser.add_argument('-f', '--file', type=str, help="Path to an audio file for transcription")
    parser.add_argument('-l', '--language', type=str, default='en', help="Language for transcription")
    parser.add_argument('-m', '--model', type=str, default='whisper-1', help="Model type for Whisper API")
    parser.add_argument('-tr', '--translate', action='store_true', help="Translate transcription to English")
    args = parser.parse_args()

    fs = 44100  # Sample rate

    if args.file:
        if os.path.exists(args.file):
            print("Transcribing file...")
            transcribe_audio(args.file, args.token, args.language, args.model, args.translate)
        else:
            print("File not found!")
    else:
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"output_{timestamp}.wav"
        recorded_data = record_audio(args.duration, args.volume, args.silence, fs)
        if recorded_data is not None:
            save_wave_file(filename, recorded_data, fs)
            print("Transcribing recorded audio...")
            transcribe_audio(filename, args.token, args.language, args.model, args.translate)
        else:
            print("No audio recorded or file is empty.")
