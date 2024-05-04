import requests

class Transcriber:
    def __init__(self, token, language='en', model='whisper-1', translate=False):
        self.token = token
        self.language = language
        self.model = model
        self.translate = translate

    def transcribe(self, audio_data):
        url = "https://api.openai.com/v1/audio/translations" if self.translate else "https://api.openai.com/v1/audio/transcriptions"
        headers = {'Authorization': f'Bearer {self.token}'}
        files = {'file': ('audio.wav', audio_data, 'audio/wav')}
        params = {'model': self.model, 'language': self.language}

        response = requests.post(url, headers=headers, files=files, data=params)
        return response.json()
