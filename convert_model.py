"""
Script to convert Keras model to TensorFlow.js format
Run this script to convert transfer.keras to TensorFlow.js format
"""
import tensorflow as tf
import tensorflowjs as tfjs
import os
import tempfile
import shutil

MODEL_PATH = 'transfer.keras'
OUTPUT_PATH = 'public/models'
TEMP_SAVEDMODEL_PATH = 'temp_savedmodel'

try:
    print(f"Loading model from {MODEL_PATH}...")
    model = tf.keras.models.load_model(MODEL_PATH, compile=False)
    print("Model loaded successfully!")
    
    # Create output directory if it doesn't exist
    os.makedirs(OUTPUT_PATH, exist_ok=True)
    
    # Try converting directly first
    print(f"Attempting direct conversion to TensorFlow.js format...")
    try:
        tfjs.converters.save_keras_model(model, OUTPUT_PATH)
        print(f"Model converted successfully! Saved to {OUTPUT_PATH}")
    except Exception as direct_error:
        print(f"Direct conversion failed: {direct_error}")
        print("Trying alternative method: Save as SavedModel first, then convert...")
        
        # Clean up temp directory if it exists
        if os.path.exists(TEMP_SAVEDMODEL_PATH):
            shutil.rmtree(TEMP_SAVEDMODEL_PATH)
        
        # Save as SavedModel format first (Keras 3 way)
        print("Saving model as SavedModel...")
        tf.saved_model.save(model, TEMP_SAVEDMODEL_PATH)
        print("SavedModel created successfully!")
        
        # Convert SavedModel to TensorFlow.js
        print("Converting SavedModel to TensorFlow.js...")
        tfjs.converters.convert_tf_saved_model(
            TEMP_SAVEDMODEL_PATH,
            OUTPUT_PATH,
            quantization_dtype='float32'
        )
        print(f"Model converted successfully! Saved to {OUTPUT_PATH}")
        
        # Clean up temp directory
        shutil.rmtree(TEMP_SAVEDMODEL_PATH)
        print("Temporary files cleaned up.")
    
    print(f"\nModel files in {OUTPUT_PATH}:")
    if os.path.exists(OUTPUT_PATH):
        for file in os.listdir(OUTPUT_PATH):
            file_path = os.path.join(OUTPUT_PATH, file)
            size = os.path.getsize(file_path) / (1024 * 1024)  # Size in MB
            print(f"  - {file} ({size:.2f} MB)")
    print("\nYou can now use the model in your web application.")
    print("The model will be loaded from: /models/model.json")
    
except Exception as e:
    import traceback
    print(f"Error: {e}")
    print("\nFull traceback:")
    traceback.print_exc()
    print("\nNote: You need to install tensorflowjs:")
    print("pip install tensorflowjs")

