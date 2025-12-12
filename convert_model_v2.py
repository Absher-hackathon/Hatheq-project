"""
Script to convert Keras model to TensorFlow.js format
This version saves as H5 first, then converts
"""
import tensorflow as tf
import tensorflowjs as tfjs
import os
import tempfile

MODEL_PATH = 'transfer.keras'
OUTPUT_PATH = 'public/models'
TEMP_H5_PATH = 'transfer_temp.h5'

try:
    print(f"Loading model from {MODEL_PATH}...")
    model = tf.keras.models.load_model(MODEL_PATH, compile=False)
    print("Model loaded successfully!")
    
    # Create output directory if it doesn't exist
    os.makedirs(OUTPUT_PATH, exist_ok=True)
    
    # Save as H5 format first (this should work better)
    print("Saving model as H5 format...")
    model.save(TEMP_H5_PATH)
    print("H5 model saved successfully!")
    
    # Now convert H5 to TensorFlow.js
    print(f"Converting H5 model to TensorFlow.js format...")
    tfjs.converters.save_keras_model(TEMP_H5_PATH, OUTPUT_PATH)
    print(f"Model converted successfully! Saved to {OUTPUT_PATH}")
    
    # Clean up temp file
    if os.path.exists(TEMP_H5_PATH):
        os.remove(TEMP_H5_PATH)
        print("Temporary H5 file cleaned up.")
    
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
    
    # Clean up temp file if it exists
    if os.path.exists(TEMP_H5_PATH):
        os.remove(TEMP_H5_PATH)
    
    print("\nNote: You need to install tensorflowjs:")
    print("pip install tensorflowjs")



