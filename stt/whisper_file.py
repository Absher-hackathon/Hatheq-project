from faster_whisper import WhisperModel
from moviepy import VideoFileClip

# Load video
video = VideoFileClip("video.mp4")

# Extract audio and save as WAV
audio = video.audio
audio.write_audiofile("audio.wav", fps=16000, nbytes=2, codec='pcm_s16le')  # compatible with Whisper

print("Audio extracted successfully!")

print("Loading model...")
model = WhisperModel("large-v3", device="cpu", compute_type="int8")

segments, info = model.transcribe("audio.mp3", language="ar")

print("Detected language:", info.language)

# UTF-8 file
with open("output.txt", "w", encoding="utf-8") as f:
    for s in segments:
        print(s.text)
        f.write(s.text + "\n")
        




