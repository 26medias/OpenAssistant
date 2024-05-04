import numpy as np
import sounddevice as sd
import datetime
import wave

class AudioRecorder:
    def __init__(self, sample_rate=44100, volume_threshold=1.0, silence_threshold=1.5, max_duration=20):
        self.sample_rate = sample_rate
        self.volume_threshold = volume_threshold
        self.silence_threshold = silence_threshold
        self.max_duration = max_duration
        self.audio_data = np.array([], dtype='int16')
        self.recording = False

    def audio_callback(self, indata, frames, time, status):
        if status:
            print(f"Status: {status}", file=sys.stderr)
        current_volume = np.linalg.norm(indata) * 10
        if current_volume > self.volume_threshold:
            if not self.recording:
                self.recording = True
                print(f"Recording started at {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
            self.audio_data = np.append(self.audio_data, indata.copy().flatten())
        elif self.recording and (datetime.datetime.now() - self.last_clip_time).total_seconds() > self.silence_threshold:
            print(f"Silence detected at {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}; stopping recording.")
            self.stop_recording()

    def record(self):
        with sd.InputStream(callback=self.audio_callback, channels=1, samplerate=self.sample_rate, dtype='int16'):
            print("Listening...")
            self.last_clip_time = datetime.datetime.now()
            while self.recording or (datetime.datetime.now() - self.last_clip_time).total_seconds() < self.silence_threshold:
                sd.sleep(100)

    def stop_recording(self):
        self.recording = False
        print(f"Recording stopped at {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        self.save_recording()

    def save_recording(self):
        if self.audio_data.size > 0:
            filename = f"recording_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.wav"
            wavfile = wave.open(filename, 'wb')
            wavfile.setnchannels(1)
            wavfile.setsampwidth(2)  # 16 bits per sample
            wavfile.setframerate(self.sample_rate)
            wavfile.writeframes(self.audio_data.tobytes())
            wavfile.close()
            print(f"Recording saved as {filename}")
            return filename
        else:
            print("No audio data to save.")
            return None
