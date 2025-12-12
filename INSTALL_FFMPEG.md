# Installing FFmpeg

FFmpeg is required for extracting audio from video files. Here are installation instructions:

## macOS (using Homebrew)

```bash
brew install ffmpeg
```

## Verify Installation

After installation, verify it works:

```bash
ffmpeg -version
```

## Alternative: Using MoviePy

If you cannot install ffmpeg, the script will try to use MoviePy as a fallback, but it may have issues with WebM files that don't have duration metadata.

To install MoviePy:

```bash
pip3 install moviepy
```

## Note

For best results with WebM files recorded from the browser, ffmpeg is strongly recommended.
