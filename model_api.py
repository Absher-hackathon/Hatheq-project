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
    print("="*50 + "\n")
    
    app.run(host='0.0.0.0', port=port, debug=True)

