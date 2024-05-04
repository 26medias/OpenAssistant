import threading

class Application:
    def __init__(self, recorder, transcriber):
        self.recorder = recorder
        self.transcriber = transcriber

    def start(self):
        recording_thread = threading.Thread(target=self.recorder.record)
        recording_thread.start()
        recording_thread.join()

        audio_filename = self.recorder.save_recording()
        if audio_filename:
            print("Transcribing audio...")
            with open(audio_filename, 'rb') as audio_file:
                transcription = self.transcriber.transcribe(audio_file)
                print(transcription)
        else:
            print("No audio data to transcribe.")
