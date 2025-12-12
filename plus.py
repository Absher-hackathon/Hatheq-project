import cv2
import numpy as np
import tensorflow as tf
from tensorflow.keras.models import load_model

IMG_SIZE = 224
EXPRESSION_LABELS = ['Angry', 'Disgust', 'Fear', 'Happy', 'Neutral', 'Sad', 'Surprise']
AUTHENTICITY_LABELS = ['Fake', 'Genuine'] 
MODEL_PATH = 'transfer.keras'

try:
    model = load_model(MODEL_PATH, compile=False) 
    print(f"Model '{MODEL_PATH}' loaded successfully.")
except Exception as e:
    print(f"Error loading model: {e}")
    exit()

cap = cv2.VideoCapture(0)
if not cap.isOpened():
    print("Cannot open camera")
    exit()

while True:
    ret, frame = cap.read()
    
    if not ret:
        print("Can't receive frame.")
        break

    rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    resized_frame = cv2.resize(rgb_frame, (IMG_SIZE, IMG_SIZE))
    # normalized_frame = resized_frame.astype(np.float32) / 255.0
    normalized_frame = tf.keras.applications.resnet.preprocess_input(resized_frame)
    input_tensor = np.expand_dims(normalized_frame, axis=0)
    
    predictions = model.predict(input_tensor, verbose=0)
    expr_probs = predictions[0][0] # First output head (expression), first item in batch
    auth_probs = predictions[1][0] # Second output head (authenticity), first item in batch
    print(f"Expression probabilities: {expr_probs}")
    print(f"Authenticity probabilities: {auth_probs}\n----------------------------------------------\n\n")

    expr_index = np.argmax(expr_probs)
    auth_index = np.argmax(auth_probs)
    
    predicted_expression = EXPRESSION_LABELS[expr_index]
    predicted_authenticity = AUTHENTICITY_LABELS[auth_index]
    
    font = cv2.FONT_HERSHEY_SIMPLEX
    color = (0, 255, 0)
    cv2.putText(frame, f"Expression: {predicted_expression} ({expr_probs[expr_index]*100:.1f}%)", (10, 30), font, 0.7, color, 2)
    cv2.putText(frame, f"Authenticity: {predicted_authenticity} ({auth_probs[auth_index]*100:.1f}%)", (10, 60), font, 0.7, color, 2)
    cv2.imshow('Live Inference - Expression/Authenticity Model', frame)

    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

# When everything done, release the capture and close windows
cap.release()
cv2.destroyAllWindows()