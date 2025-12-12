# Model Setup Instructions

This application uses a TensorFlow/Keras model (`transfer.keras`) for facial expression and authenticity analysis via a Python backend API.

## ✅ Current Setup: Python Backend API

The application uses a Python Flask API server to run the TensorFlow model. This is the recommended approach.

### Step 1: Install Python Dependencies

```bash
pip install -r requirements.txt
```

Or install manually:

```bash
pip install flask flask-cors tensorflow opencv-python numpy Pillow
```

### Step 2: Start the API Server

Run the Python API server:

```bash
python model_api.py
```

Or use the convenience script:

```bash
./start_model_api.sh
```

The server will start on `http://localhost:5001` (default port changed to avoid macOS AirPlay conflict)

You can specify a custom port:

```bash
python model_api.py 5002
```

### Step 3: Verify the Server

Check that the server is running:

```bash
curl http://localhost:5000/health
```

You should see:

```json
{
  "status": "healthy",
  "model_loaded": true
}
```

### Step 4: Start the Web Application

The web app will automatically connect to the API server when you start the camera. The model predictions will appear in real-time on the video feed.

## API Endpoints

- `GET /health` - Health check and model status
- `POST /predict` - Single image prediction
- `POST /predict_batch` - Batch predictions (multiple images)

## How It Works

1. The web app captures video frames from the camera
2. Frames are sent to the Python API server as base64-encoded images
3. The Python server runs the TensorFlow model and returns predictions
4. Predictions are displayed in real-time on the video feed
5. All analysis data (including model predictions) is saved when recording stops

## Troubleshooting

### Server won't start

- Make sure `transfer.keras` is in the project root
- Check that all dependencies are installed
- Verify Python version (3.8+)

### Web app can't connect

- Make sure the API server is running on port 5001 (default)
- Check browser console for CORS errors
- Verify the server is accessible: `curl http://localhost:5001/health`
- If using a different port, set `VITE_MODEL_API_PORT` environment variable before starting the web app

### Model not loading

- Check that `transfer.keras` exists in the project root
- Look for error messages in the API server console
- Verify TensorFlow is installed correctly

## Alternative: TensorFlow.js (Not Currently Working)

The current `transfer.keras` model contains non-serializable objects that prevent direct conversion to TensorFlow.js format. If you need browser-based inference, you would need to retrain/resave the model.

### Option 2: Retrain/Resave the Model

If you have access to the model training code, you can:

1. Retrain the model without custom objects
2. Save it in a format compatible with TensorFlow.js
3. Use the conversion scripts provided

### Option 3: Use MediaPipe Only (Current Status)

The application works perfectly fine with just MediaPipe analysis. The TensorFlow model integration is optional and the app will show a warning if the model can't be loaded, but all other features will continue to work.

## Converting the Model (If Compatible)

If you have a compatible model, follow these steps:

### Step 1: Install Required Python Packages

```bash
pip install tensorflowjs
```

### Step 2: Convert the Model

Try the conversion script:

```bash
python convert_model.py
```

Or try the alternative:

```bash
python convert_model_v2.py
```

### Step 3: Verify Model Files

After successful conversion, you should have:

- `public/models/model.json` - Model architecture
- `public/models/*.bin` - Model weights files

### Step 4: Start the Application

The model will be automatically loaded when you start the camera. The application will:

1. Load the TensorFlow.js model from `/models/model.json`
2. Run predictions on video frames
3. Display expression and authenticity predictions

## Model Outputs

The model predicts:

- **Expression**: ['Angry', 'Disgust', 'Fear', 'Happy', 'Neutral', 'Sad', 'Surprise']
- **Authenticity**: ['Fake', 'Genuine']

## Current Status

✅ **MediaPipe Analysis**: Working perfectly
✅ **Video Recording**: Working perfectly  
✅ **Analysis Data Collection**: Working perfectly
⚠️ **TensorFlow Model**: Ready for integration, but model conversion needs to be resolved

The application is fully functional without the TensorFlow model - it will use MediaPipe for real-time facial analysis, which provides stress scores, eye movements, and facial expressions.
