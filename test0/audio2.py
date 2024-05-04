import sounddevice as sd
from scipy.io.wavfile import write

def record_audio(duration=20, fs=44100, device=0):  # Default device set to 0
    print("Recording...")
    try:
        recording = sd.rec(int(duration * fs), samplerate=fs, channels=2, dtype='int16', device=device)
        sd.wait()  # Wait until recording is finished
        print("Finished recording.")
    except Exception as e:
        print(f"An error occurred: {e}")
        return None
    return recording

if __name__ == "__main__":
    fs = 44100  # Sample rate
    duration = 20  # seconds
    myrecording = record_audio(duration, fs, 0)
    if myrecording is not None:
        write('output1.wav', fs, myrecording)  # Save as WAV file
        print("WAV file 'output.wav' saved.")
    else:
        print("Failed to record audio.")
