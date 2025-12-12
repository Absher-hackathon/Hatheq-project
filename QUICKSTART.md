# Quick Start Guide

## Using the Python Model API

### 1. Install Python Dependencies

```bash
pip install -r requirements.txt
```

### 2. Start the API Server

In one terminal, start the Python API server:

```bash
python model_api.py
```

Or use a custom port:
```bash
python model_api.py 5002
```

You should see:
```
==================================================
TensorFlow Model API Server
==================================================
Model loaded: True
Starting server on http://localhost:5001
Endpoints:
  GET  /health - Health check
  POST /predict - Single image prediction
  POST /predict_batch - Batch predictions
==================================================
```

**Note:** The default port is 5001 (not 5000) to avoid conflicts with macOS AirPlay Receiver.

### 3. Start the Web Application

In another terminal, start the web app:

```bash
npm run dev
```

### 4. Use the Application

1. Open the web app in your browser
2. Create or open a session
3. Click "تشغيل الكاميرا" (Start Camera)
4. The Python model will analyze your face in real-time
5. You'll see:
   - Expression predictions (Angry, Happy, Neutral, etc.)
   - Authenticity predictions (Fake/Genuine)
   - MediaPipe analysis (stress scores, eye movements)
6. Click "إيقاف الكاميرا" (Stop Camera) to save the video and analysis

## Troubleshooting

**API server won't start:**
- Make sure `transfer.keras` is in the project root
- Check Python version: `python3 --version` (should be 3.8+)
- Install dependencies: `pip install -r requirements.txt`

**Web app can't connect:**
- Make sure API server is running on port 5001 (default)
- Check browser console for errors
- Test API: `curl http://localhost:5001/health`
- If using a different port, set `VITE_MODEL_API_PORT` environment variable

**Model predictions not showing:**
- Check API server console for errors
- Verify model loaded successfully (should see "Model loaded: True")
- Check browser console for API connection errors

