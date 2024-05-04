import os

from AudioRecorder import AudioRecorder
from Transcriber import Transcriber
from Application import Application

def main():
    token = os.getenv('OPENAI_API_KEY', 'your_default_token_here')
    recorder = AudioRecorder()
    transcriber = Transcriber(token=token)

    app = Application(recorder, transcriber)
    app.start()

if __name__ == "__main__":
    main()
