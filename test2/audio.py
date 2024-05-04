#! python3.7

import argparse
import os
import numpy as np
import speech_recognition as sr
import requests
from datetime import datetime, timedelta
from queue import Queue
from time import sleep
from sys import platform

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--api_key", required=False, default=os.getenv('OPENAI_API_KEY'), help="OpenAI API Key for accessing the API")
    parser.add_argument("--energy_threshold", default=1000, type=int, help="Energy level for mic to detect.")
    parser.add_argument("--record_timeout", default=2, type=float, help="Real-time recording update interval in seconds.")
    parser.add_argument("--phrase_timeout", default=3, type=float, help="Pause duration to consider before stopping recording.")
    if 'linux' in platform:
        parser.add_argument("--default_microphone", default='pulse', type=str, help="Default microphone name for SpeechRecognition.")
    args = parser.parse_args()

    data_queue = Queue()
    recorder = sr.Recognizer()
    recorder.energy_threshold = args.energy_threshold
    recorder.dynamic_energy_threshold = False

    if 'linux' in platform and (not args.default_microphone or args.default_microphone == 'list'):
        print("Available microphone devices are: ")
        for index, name in enumerate(sr.Microphone.list_microphone_names()):
            print(f"Microphone with name \"{name}\" found")
        return

    source = sr.Microphone(sample_rate=16000)
    if 'linux' in platform:
        for index, name in enumerate(sr.Microphone.list_microphone_names()):
            if args.default_microphone in name:
                source = sr.Microphone(sample_rate=16000, device_index=index)
                break

    with source:
        recorder.adjust_for_ambient_noise(source)

    def record_callback(_, audio: sr.AudioData):
        data_queue.put(audio.get_raw_data())

    recorder.listen_in_background(source, record_callback, phrase_time_limit=args.record_timeout)
    print("Model loaded.\n")

    transcription = ['']

    while True:
        try:
            if not data_queue.empty():
                now = datetime.utcnow()
                phrase_time = now if 'phrase_time' not in locals() else phrase_time
                phrase_complete = now - phrase_time > timedelta(seconds=args.phrase_timeout)
                phrase_time = now

                audio_data = b''.join(list(data_queue.queue))
                data_queue.queue.clear()

                headers = {
                    'Authorization': f'Bearer {args.api_key}',
                    'Content-Type': 'application/json',
                }

                response = requests.post(
                    'https://api.openai.com/v1/audio/transcriptions',
                    headers=headers,
                    files={'file': ('audio.wav', audio_data, 'audio/wav')}
                )

                result = response.json()
                text = result.get('text', '').strip()

                if phrase_complete:
                    transcription.append(text)
                else:
                    transcription[-1] = text

                os.system('cls' if os.name == 'nt' else 'clear')
                for line in transcription:
                    print(line)
                print('', end='', flush=True)

            else:
                sleep(0.25)

        except KeyboardInterrupt:
            break

    print("\n\nTranscription:")
    for line in transcription:
        print(line)


if __name__ == "__main__":
    main()
