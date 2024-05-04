import argparse
import datetime
import json
import os
import sys
import wave
import time
import threading
import queue

import numpy as np
import requests
import sounddevice as sd


def int_or_str(text):
    """Helper function for argument parsing."""
    try:
        return int(text)
    except ValueError:
        return text


def audio_callback(indata, frames, time, status):
    """This function will be called for each audio block."""
    if status:
        print(status, file=sys.stderr)
    # Put the incoming audio data into a queue
    audio_queue.put(indata.copy())

def record_audio(volume_threshold, silence_threshold, fs, max_duration, record_queue):
    """Record audio from the microphone and store segments in a queue."""
    last_sound_time = datetime.datetime.now()
    recording = False
    myrecording = np.array([], dtype='int16')

    try:
        with sd.InputStream(callback=audio_callback, channels=1, samplerate=fs, dtype='int16'):
            while True:
                if not audio_queue.empty():
                    data = audio_queue.get()
                    volume_norm = np.linalg.norm(data) * 10
                    current_time = datetime.datetime.now()

                    if volume_norm > volume_threshold:
                        last_sound_time = current_time
                        if not recording:
                            recording = True
                            print("\nRecording started")

                    if recording:
                        myrecording = np.append(myrecording, data.flatten())
                        sys.stdout.write('▒')
                        sys.stdout.flush()

                    if (current_time - last_sound_time).total_seconds() > silence_threshold and recording:
                        record_queue.put(myrecording)
                        myrecording = np.array([], dtype='int16')  # Reset recording
                        recording = False
                        print("\nRecording stopped due to silence.")

                    if (current_time - last_sound_time).total_seconds() >= max_duration:
                        break

    except KeyboardInterrupt:
        print("\nRecording stopped: KeyboardInterrupt")
    except Exception as e:
        print(f"\nAn error occurred: {e}")

    if myrecording.size > 0:
        record_queue.put(myrecording)  # Ensure last recording is added to the queue


def save_and_transcribe(record_queue, token, language, model, translate, fs):
    """Save and transcribe recordings from a queue."""
    while True:
        data = record_queue.get()
        if data is None:
            break  # Stop the thread if None is received
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"output_{timestamp}.wav"
        save_wave_file(filename, data, fs)
        print("Transcribing recorded audio...")
        transcribe_audio(filename, token, language, model, translate)


def save_wave_file(filename, data, fs):
    """Save a numpy array to a WAV file."""
    if data.size > 0:
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
    url = "https://api.openai.com/v1/audio/translations" if translate else "https://api.openai.com/v1/audio/transcriptions"

    response = requests.post(url, headers=headers, files=files, data=params)
    transcription = response.json()
    print(json.dumps(transcription, indent=4))
    return transcription


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Whisper API Audio Recorder and Transcriber")
    parser.add_argument('-d', '--duration', type=float, default=45.0, help="Maximum duration of the recording in seconds")
    parser.add_argument('-v', '--volume', type=float, default=1.0, help="Volume threshold percentage")
    parser.add_argument('-s', '--silence', type=float, default=1.5, help="Silence length to trigger recording stop")
    parser.add_argument('-t', '--token', type=str, required=False, default=os.getenv('OPENAI_API_KEY'), help="OpenAI API token")
    parser.add_argument('-l', '--language', type=str, default='en', help="Language for transcription")
    parser.add_argument('-m', '--model', type=str, default='whisper-1', help="Model type for Whisper API")
    parser.add_argument('-tr', '--translate', action='store_true', help="Translate transcription to English")
    parser.add_argument('-to', '--timeout', type=float, required=False, default=2, help="Timeout in minutes after which the script ends")
    args = parser.parse_args()

    fs = 44100  # Sample rate
    record_queue = queue.Queue()

    record_thread = threading.Thread(target=record_audio, args=(args.volume, args.silence, fs, args.duration, record_queue), daemon=True)
    transcribe_thread = threading.Thread(target=save_and_transcribe, args=(record_queue, args.token, args.language, args.model, args.translate, fs), daemon=True)

    record_thread.start()
    transcribe_thread.start()

    time.sleep(args.timeout * 60)  # Run the script for the timeout duration
    record_queue.put(None)  # Signal the transcription thread to stop
    transcribe_thread.join()  # Ensure transcription thread has completed
