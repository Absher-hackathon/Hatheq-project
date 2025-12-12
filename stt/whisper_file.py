#!/usr/bin/env python3
"""
Extract audio from video and transcribe using Whisper
Usage: python whisper_file.py <video_path> <output_txt_path>
"""
import sys
import os
import subprocess
from faster_whisper import WhisperModel
import tempfile

# Try to import moviepy as fallback
try:
    from moviepy.editor import VideoFileClip
    MOVIEPY_AVAILABLE = True
except ImportError:
    MOVIEPY_AVAILABLE = False

def check_ffmpeg():
    """Check if ffmpeg is available"""
    try:
        result = subprocess.run(['ffmpeg', '-version'], capture_output=True, text=True)
        return result.returncode == 0
    except FileNotFoundError:
        return False

def extract_audio_with_ffmpeg(video_path: str, output_audio_path: str):
    """Extract audio from video using ffmpeg directly (more reliable for WebM)"""
    try:
        # Use ffmpeg to extract audio directly
        # -i: input file
        # -vn: disable video
        # -acodec pcm_s16le: PCM 16-bit little-endian
        # -ar 16000: sample rate 16kHz
        # -ac 1: mono channel
        # -y: overwrite output file
        # -loglevel error: suppress most output
        cmd = [
            'ffmpeg',
            '-loglevel', 'error',
            '-i', video_path,
            '-vn',  # No video
            '-acodec', 'pcm_s16le',  # PCM codec
            '-ar', '16000',  # Sample rate
            '-ac', '1',  # Mono
            '-y',  # Overwrite
            output_audio_path
        ]
        
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True
        )
        
        if result.returncode != 0:
            print(f"FFmpeg error: {result.stderr}", file=sys.stderr)
            return False
        
        if not os.path.exists(output_audio_path) or os.path.getsize(output_audio_path) == 0:
            print("Error: Audio file was not created or is empty", file=sys.stderr)
            return False
        
        return True
    except FileNotFoundError:
        print("Error: ffmpeg not found. Please install ffmpeg with: brew install ffmpeg", file=sys.stderr)
        return False
    except Exception as e:
        print(f"Error extracting audio: {e}", file=sys.stderr)
        return False

def extract_audio_with_moviepy(video_path: str, output_audio_path: str):
    """Extract audio using moviepy as fallback (may have issues with WebM without duration)"""
    if not MOVIEPY_AVAILABLE:
        return False
    
    video = None
    audio = None
    try:
        # Try to load video with duration workaround for WebM
        video = VideoFileClip(video_path)
        
        # Check if video has audio
        if video.audio is None:
            print("Warning: Video has no audio track", file=sys.stderr)
            video.close()
            return False
        
        # Extract audio
        audio = video.audio
        audio.write_audiofile(
            output_audio_path,
            fps=16000,
            nbytes=2,
            codec='pcm_s16le',
            verbose=False,
            logger=None
        )
        
        return True
    except Exception as e:
        print(f"MoviePy error: {e}", file=sys.stderr)
        return False
    finally:
        if audio:
            try:
                audio.close()
            except:
                pass
        if video:
            try:
                video.close()
            except:
                pass

def transcribe_video(video_path: str, output_txt_path: str):
    """Extract audio from video and transcribe to text file"""
    temp_audio_path = None
    
    try:
        print(f"Loading video: {video_path}", file=sys.stderr)
        if not os.path.exists(video_path):
            print(f"Error: Video file not found: {video_path}", file=sys.stderr)
            return False
        
        # Check file size
        file_size = os.path.getsize(video_path)
        if file_size == 0:
            print("Error: Video file is empty", file=sys.stderr)
            return False
        print(f"Video file size: {file_size} bytes", file=sys.stderr)
        
        # Create temporary audio file
        temp_audio = tempfile.NamedTemporaryFile(suffix='.wav', delete=False)
        temp_audio_path = temp_audio.name
        temp_audio.close()
        
        # Try to extract audio - prefer ffmpeg, fallback to moviepy
        if check_ffmpeg():
            print("Extracting audio with ffmpeg...", file=sys.stderr)
            if not extract_audio_with_ffmpeg(video_path, temp_audio_path):
                # Fallback to moviepy if ffmpeg fails
                if MOVIEPY_AVAILABLE:
                    print("FFmpeg failed, trying moviepy as fallback...", file=sys.stderr)
                    if not extract_audio_with_moviepy(video_path, temp_audio_path):
                        return False
                else:
                    return False
        elif MOVIEPY_AVAILABLE:
            print("FFmpeg not found, using moviepy...", file=sys.stderr)
            print("Note: For better WebM support, install ffmpeg: brew install ffmpeg", file=sys.stderr)
            if not extract_audio_with_moviepy(video_path, temp_audio_path):
                return False
        else:
            print("Error: Neither ffmpeg nor moviepy available.", file=sys.stderr)
            print("Please install ffmpeg: brew install ffmpeg", file=sys.stderr)
            print("Or install moviepy: pip install moviepy", file=sys.stderr)
            return False
        
        print("Audio extracted successfully!", file=sys.stderr)
        
        # Check if audio file is valid
        audio_size = os.path.getsize(temp_audio_path)
        if audio_size == 0:
            print("Warning: Extracted audio file is empty - video may have no audio", file=sys.stderr)
            with open(output_txt_path, "w", encoding="utf-8") as f:
                f.write("")
            return True
        
        print(f"Audio file size: {audio_size} bytes", file=sys.stderr)
        print("Loading Whisper model...", file=sys.stderr)
        model = WhisperModel("large-v3", device="cpu", compute_type="int8")
        
        print("Transcribing audio...", file=sys.stderr)
        segments, info = model.transcribe(temp_audio_path, language="ar")
        
        print(f"Detected language: {info.language}", file=sys.stderr)
        
        # Ensure output directory exists
        output_dir = os.path.dirname(output_txt_path)
        if output_dir and not os.path.exists(output_dir):
            os.makedirs(output_dir, exist_ok=True)
            print(f"Created output directory: {output_dir}", file=sys.stderr)
        
        # Get absolute path for verification
        abs_output_path = os.path.abspath(output_txt_path)
        print(f"Writing transcription to: {abs_output_path}", file=sys.stderr)
        
        # Write transcription to output file
        transcription_lines = []
        with open(output_txt_path, "w", encoding="utf-8") as f:
            for s in segments:
                text = s.text.strip()
                if text:  # Only write non-empty segments
                    print(text, file=sys.stderr)
                    f.write(text + "\n")
                    transcription_lines.append(text)
        
        if not transcription_lines:
            print("Warning: No transcription text generated", file=sys.stderr)
            # Write empty file
            with open(output_txt_path, "w", encoding="utf-8") as f:
                f.write("")
        
        # Verify file was created
        if os.path.exists(output_txt_path):
            file_size = os.path.getsize(output_txt_path)
            print(f"Transcription saved successfully to: {abs_output_path}", file=sys.stderr)
            print(f"File size: {file_size} bytes", file=sys.stderr)
        else:
            print(f"ERROR: File was not created at: {abs_output_path}", file=sys.stderr)
            return False
        
        return True
        
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"Error: {e}", file=sys.stderr)
        print(f"Traceback: {error_trace}", file=sys.stderr)
        return False
    finally:
        # Clean up resources
        if temp_audio_path and os.path.exists(temp_audio_path):
            try:
                os.unlink(temp_audio_path)
            except:
                pass

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python whisper_file.py <video_path> <output_txt_path>", file=sys.stderr)
        sys.exit(1)
    
    video_path = sys.argv[1]
    output_txt_path = sys.argv[2]
    
    if not os.path.exists(video_path):
        print(f"Error: Video file not found: {video_path}", file=sys.stderr)
        sys.exit(1)
    
    success = transcribe_video(video_path, output_txt_path)
    sys.exit(0 if success else 1)
        




