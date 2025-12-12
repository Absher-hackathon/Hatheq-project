"""
Flask API server for TensorFlow model inference
Run this server to provide model predictions to the web application
"""
from flask import Flask, request, jsonify
from flask_cors import CORS
import numpy as np
import tensorflow as tf
from tensorflow.keras.models import load_model
import base64
import io
import os
import subprocess
import tempfile
from PIL import Image

# Note: cv2 is only used for resizing, but PIL can do that too
# We'll use PIL instead to avoid NumPy 2.x compatibility issues

app = Flask(__name__)
CORS(app)  # Enable CORS for web app

IMG_SIZE = 224
EXPRESSION_LABELS = ['Angry', 'Disgust', 'Fear', 'Happy', 'Neutral', 'Sad', 'Surprise']
AUTHENTICITY_LABELS = ['Fake', 'Genuine']
MODEL_PATH = 'transfer.keras'

# Load model once at startup
print(f"Loading model from {MODEL_PATH}...")
try:
    model = load_model(MODEL_PATH, compile=False)
    print(f"Model '{MODEL_PATH}' loaded successfully.")
except Exception as e:
    print(f"Error loading model: {e}")
    model = None

def preprocess_image(image_data):
    """Preprocess image for model input - optimized version"""
    # Decode base64 image
    if isinstance(image_data, str):
        # Remove data URL prefix if present
        if ',' in image_data:
            image_data = image_data.split(',')[1]
        image_bytes = base64.b64decode(image_data)
    else:
        image_bytes = image_data
    
    # Convert to PIL Image
    image = Image.open(io.BytesIO(image_bytes))
    
    # Convert to RGB if needed
    if image.mode != 'RGB':
        image = image.convert('RGB')
    
    # Resize to model input size using PIL (faster than doing it after conversion)
    # Use NEAREST for fastest processing (acceptable quality for small 224x224 images)
    image = image.resize((IMG_SIZE, IMG_SIZE), Image.Resampling.NEAREST)
    
    # Convert to numpy array
    img_array = np.array(image, dtype=np.float32)
    
    # Preprocess using ResNet preprocessing
    img_array = tf.keras.applications.resnet.preprocess_input(img_array)
    
    # Expand dimensions for batch
    img_array = np.expand_dims(img_array, axis=0)
    
    return img_array

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'model_loaded': model is not None
    })

@app.route('/predict', methods=['POST'])
def predict():
    """Predict expression and authenticity from image"""
    if model is None:
        return jsonify({'error': 'Model not loaded'}), 500
    
    try:
        data = request.json
        
        if 'image' not in data:
            return jsonify({'error': 'No image provided'}), 400
        
        # Preprocess image
        input_tensor = preprocess_image(data['image'])
        
        # Get predictions with optimized settings
        # Use smaller batch size and disable verbose for faster inference
        predictions = model.predict(input_tensor, verbose=0, batch_size=1)
        expr_probs = predictions[0][0]  # Expression probabilities
        auth_probs = predictions[1][0]   # Authenticity probabilities
        
        # Get predicted labels
        expr_index = np.argmax(expr_probs)
        auth_index = np.argmax(auth_probs)
        
        predicted_expression = EXPRESSION_LABELS[expr_index]
        predicted_authenticity = AUTHENTICITY_LABELS[auth_index]
        
        # Convert probabilities to dictionaries
        expression_probs = {
            label: float(expr_probs[i]) 
            for i, label in enumerate(EXPRESSION_LABELS)
        }
        
        authenticity_probs = {
            label: float(auth_probs[i]) 
            for i, label in enumerate(AUTHENTICITY_LABELS)
        }
        
        return jsonify({
            'expression': {
                'label': predicted_expression,
                'confidence': float(expr_probs[expr_index]),
                'probabilities': expression_probs
            },
            'authenticity': {
                'label': predicted_authenticity,
                'confidence': float(auth_probs[auth_index]),
                'probabilities': authenticity_probs
            }
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/predict_batch', methods=['POST'])
def predict_batch():
    """Predict for multiple images at once"""
    if model is None:
        return jsonify({'error': 'Model not loaded'}), 500
    
    try:
        data = request.json
        
        if 'images' not in data or not isinstance(data['images'], list):
            return jsonify({'error': 'No images array provided'}), 400
        
        results = []
        for image_data in data['images']:
            # Preprocess image
            input_tensor = preprocess_image(image_data)
            
            # Get predictions
            predictions = model.predict(input_tensor, verbose=0)
            expr_probs = predictions[0][0]
            auth_probs = predictions[1][0]
            
            expr_index = np.argmax(expr_probs)
            auth_index = np.argmax(auth_probs)
            
            results.append({
                'expression': {
                    'label': EXPRESSION_LABELS[expr_index],
                    'confidence': float(expr_probs[expr_index])
                },
                'authenticity': {
                    'label': AUTHENTICITY_LABELS[auth_index],
                    'confidence': float(auth_probs[auth_index])
                }
            })
        
        return jsonify({'results': results})
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/transcribe', methods=['POST'])
def transcribe():
    """Extract audio from video and transcribe using Whisper"""
    temp_video_path = None
    txt_path = None
    
    try:
        if 'video' not in request.files:
            return jsonify({'error': 'No video file provided'}), 400
        
        video_file = request.files['video']
        if video_file.filename == '':
            return jsonify({'error': 'No video file selected'}), 400
        
        # Get script directory and stt folder path
        script_dir = os.path.dirname(os.path.abspath(__file__))
        stt_dir = os.path.join(script_dir, 'stt')
        
        # Ensure stt directory exists
        os.makedirs(stt_dir, exist_ok=True)
        
        # Get video filename and extension
        video_filename = video_file.filename or 'video.mp4'
        video_ext = os.path.splitext(video_filename)[1] or '.mp4'  # Default to .mp4 if no extension
        
        # Create temporary video file with correct extension
        temp_video = tempfile.NamedTemporaryFile(delete=False, suffix=video_ext)
        temp_video_path = temp_video.name
        temp_video.close()
        
        # Generate output text filename based on video filename
        # Extract base name from video filename (e.g., "session-123-1234567890.webm" or "session-123-1234567890.mp4" -> "session-123-1234567890.txt")
        base_name = os.path.splitext(video_filename)[0]
        txt_filename = f"{base_name}.txt"
        txt_path = os.path.join(stt_dir, txt_filename)
        # Use absolute path to ensure correct location
        txt_path = os.path.abspath(txt_path)
        
        # Save uploaded video to temp file
        print(f"Saving video to: {temp_video_path}")
        video_file.save(temp_video_path)
        print(f"Video saved, size: {os.path.getsize(temp_video_path)} bytes")
        
        # Get path to whisper_file.py script
        whisper_script = os.path.join(script_dir, 'stt', 'whisper_file.py')
        
        if not os.path.exists(whisper_script):
            return jsonify({
                'error': f'Whisper script not found at: {whisper_script}'
            }), 500
        
        print(f"Running transcription script: {whisper_script}")
        print(f"Input video: {temp_video_path}")
        print(f"Output text: {txt_path}")
        
        # Try python3 first, fallback to python
        python_cmd = 'python3'
        try:
            subprocess.run([python_cmd, '--version'], capture_output=True, check=True)
        except (subprocess.CalledProcessError, FileNotFoundError):
            python_cmd = 'python'
            try:
                subprocess.run([python_cmd, '--version'], capture_output=True, check=True)
            except (subprocess.CalledProcessError, FileNotFoundError):
                return jsonify({'error': 'Python interpreter not found'}), 500
        
        # Run transcription script
        result = subprocess.run(
            [python_cmd, whisper_script, temp_video_path, txt_path],
            capture_output=True,
            text=True,
            timeout=600,  # 10 minute timeout
            cwd=script_dir  # Set working directory
        )
        
        print(f"Transcription return code: {result.returncode}")
        if result.stdout:
            print(f"Transcription stdout: {result.stdout}")
        if result.stderr:
            print(f"Transcription stderr: {result.stderr}")
        
        if result.returncode != 0:
            error_msg = result.stderr if result.stderr else result.stdout
            return jsonify({
                'error': 'Transcription failed',
                'details': error_msg,
                'return_code': result.returncode
            }), 500
        
        # Check if output file was created
        abs_txt_path = os.path.abspath(txt_path)
        if not os.path.exists(txt_path):
            # Try to check with absolute path
            if not os.path.exists(abs_txt_path):
                return jsonify({
                    'error': f'Transcription output file was not created at: {txt_path} (absolute: {abs_txt_path})',
                    'expected_path': abs_txt_path,
                    'stt_dir': stt_dir
                }), 500
            else:
                txt_path = abs_txt_path
        
        # Read transcription result
        with open(txt_path, 'r', encoding='utf-8') as f:
            transcription = f.read().strip()
        
        if not transcription:
            return jsonify({
                'error': 'Transcription is empty - video may not contain audio'
            }), 400
        
        print(f"Transcription completed, length: {len(transcription)} characters")
        abs_txt_path = os.path.abspath(txt_path)
        print(f"Transcription saved to: {abs_txt_path}")
        
        # Verify file exists and get its actual location
        if os.path.exists(abs_txt_path):
            actual_path = os.path.abspath(abs_txt_path)
            file_size = os.path.getsize(actual_path)
            print(f"Verified file exists at: {actual_path} (size: {file_size} bytes)")
        else:
            print(f"WARNING: File not found at expected path: {abs_txt_path}")
        
        return jsonify({
            'success': True,
            'transcription': transcription,
            'file_path': abs_txt_path,
            'relative_path': txt_path
        })
        
    except subprocess.TimeoutExpired:
        return jsonify({'error': 'Transcription timeout (exceeded 10 minutes)'}), 500
    except FileNotFoundError as e:
        return jsonify({'error': f'File not found: {str(e)}'}), 500
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"Transcription error: {error_trace}")
        return jsonify({
            'error': str(e),
            'traceback': error_trace
        }), 500
    finally:
        # Clean up temporary video file only (keep the txt file in stt folder)
        if temp_video_path and os.path.exists(temp_video_path):
            try:
                os.unlink(temp_video_path)
                print(f"Cleaned up temp video: {temp_video_path}")
            except Exception as e:
                print(f"Error cleaning up temp video: {e}")

if __name__ == '__main__':
    import sys
    
    # Allow port to be specified via command line argument
    port = 5001
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except ValueError:
            print(f"Invalid port number: {sys.argv[1]}. Using default port 5001.")
    
    print("\n" + "="*50)
    print("TensorFlow Model API Server")
    print("="*50)
    print(f"Model loaded: {model is not None}")
    print(f"Starting server on http://localhost:{port}")
    print("Endpoints:")
    print("  GET  /health - Health check")
    print("  POST /predict - Single image prediction")
    print("  POST /predict_batch - Batch predictions")
    print("  POST /transcribe - Extract audio and transcribe video")
    print("="*50 + "\n")
    
    app.run(host='0.0.0.0', port=port, debug=True)

