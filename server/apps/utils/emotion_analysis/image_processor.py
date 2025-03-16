import cv2
import numpy as np
import torch
import base64
import logging
from PIL import Image
from io import BytesIO
import matplotlib.pyplot as plt

# Configure logging
logger = logging.getLogger(__name__)

def detect_faces(image):
    """Detect faces in an image using Haar Cascade"""
    face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
    
    # Convert PIL Image to OpenCV format if needed
    if isinstance(image, Image.Image):
        image = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)
        
    # Convert to grayscale for face detection
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    
    # Detect faces with optimized parameters
    faces = face_cascade.detectMultiScale(
        gray, 
        scaleFactor=1.2,
        minNeighbors=6,
        minSize=(60, 60)
    )
    
    return faces, image

def load_image(image_path_or_obj):
    """Load image from path or object"""
    if isinstance(image_path_or_obj, str):
        try:
            image = cv2.imread(image_path_or_obj)
            if image is None:
                raise ValueError(f"Failed to load image from {image_path_or_obj}")
            return image
        except Exception as e:
            logger.error(f"Failed to load image: {str(e)}")
            raise
    elif isinstance(image_path_or_obj, Image.Image):
        return cv2.cvtColor(np.array(image_path_or_obj), cv2.COLOR_RGB2BGR)
    else:
        return image_path_or_obj  # Assume it's already a numpy array

def preprocess_face(face_img, transform):
    """Preprocess face region for model input"""
    # Convert to PIL Image for transformations if it's a numpy array
    if isinstance(face_img, np.ndarray):
        face_img = Image.fromarray(cv2.cvtColor(face_img, cv2.COLOR_BGR2RGB))
        
    # Apply transformations
    face_tensor = transform(face_img).unsqueeze(0)  # Add batch dimension
    return face_tensor

def analyze_face(face_img, model, device, transform, class_labels, valence_weights, engagement_weights):
    """Analyze emotion in a face image"""
    # Preprocess face
    face_tensor = preprocess_face(face_img, transform).to(device)
    
    # Predict emotions
    with torch.no_grad():
        output = model(face_tensor)
        probabilities = torch.nn.functional.softmax(output, dim=1).cpu().numpy()[0]
    
    # Calculate valence & engagement
    valence = sum(probabilities[i] * valence_weights[i] for i in range(len(class_labels)))
    engagement = sum(probabilities[i] * engagement_weights[i] for i in range(len(class_labels)))
    
    # Get dominant emotion
    dominant_idx = np.argmax(probabilities)
    dominant_emotion = class_labels[dominant_idx]
    confidence = probabilities[dominant_idx]
    
    return {
        "emotions": {class_labels[i]: float(probabilities[i]) for i in range(len(class_labels))},
        "dominant_emotion": dominant_emotion,
        "confidence": float(confidence),
        "valence": float(valence),
        "engagement": float(engagement * 100)  # Convert to percentage
    }

def generate_visualization(image, face_results):
    """Generate visualization of analyzed faces"""
    viz_image = image.copy()
    
    for face_data in face_results:
        x, y, w, h = (
            face_data["position"]["x"],
            face_data["position"]["y"],
            face_data["position"]["width"],
            face_data["position"]["height"]
        )
        
        # Draw rectangle around face
        cv2.rectangle(viz_image, (x, y), (x+w, y+h), (255, 255, 255), 2)
        
        # Add emotion text with background for readability
        emotion = face_data["dominant_emotion"]
        conf = face_data["confidence"] * 100
        val = face_data["valence"]
        
        # Select text color based on valence (negative=red, positive=green)
        text_color = (0, 255, 0) if val > 0 else (0, 0, 255)
        
        # Add labels
        text = f"{emotion}: {conf:.1f}%"
        cv2.putText(viz_image, text, (x, y-10), 
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, text_color, 2)
    
    # Convert to base64
    _, buffer = cv2.imencode('.jpg', viz_image)
    viz_b64 = base64.b64encode(buffer).decode('utf-8')
    return f"data:image/jpeg;base64,{viz_b64}"

def generate_emotion_graph(emotion_data, width=800, height=500):
    """Generate a graph visualization for emotion trends"""
    try:
        # Set the Agg backend before importing pyplot
        import matplotlib
        matplotlib.use('Agg')
        import matplotlib.pyplot as plt
        
        # Create figure and axes
        fig, ax = plt.subplots(figsize=(width/100, height/100), dpi=100)
        
        # Extract data
        emotions = emotion_data["emotions"]
        
        # Sort emotions by value, descending
        sorted_emotions = sorted(emotions.items(), key=lambda x: x[1], reverse=True)
        labels, values = zip(*sorted_emotions)
        
        # Generate color map based on valence
        colors = []
        for emotion in labels:
            # Assign colors based on emotion valence
            if emotion in ['happy', 'surprise']:
                colors.append('green')
            elif emotion in ['angry', 'fear', 'disgust', 'sad']:
                colors.append('red')
            else:
                colors.append('gray')
                
        # Create horizontal bar chart
        bars = ax.barh(labels, values, color=colors)
        
        # Add values on bars
        for i, v in enumerate(values):
            ax.text(v + 0.01, i, f'{v:.2f}', va='center')
        
        # Customize chart
        ax.set_title('Emotion Analysis Results')
        ax.set_xlim(0, 1.0)
        
        # Convert plot to image
        buf = BytesIO()
        fig.tight_layout()
        plt.savefig(buf, format='png')
        plt.close(fig)
        buf.seek(0)
        
        # Convert to base64 for embedding in HTML
        graph_img = base64.b64encode(buf.getvalue()).decode('utf-8')
        return f"data:image/png;base64,{graph_img}"
        
    except Exception as e:
        logger.error(f"Error generating emotion graph: {str(e)}")
        return None

def enhance_face_quality(face_img, target_size=(224, 224)):
    """Enhance face image quality for better analysis"""
    try:
        # Convert to grayscale if needed
        if len(face_img.shape) == 3 and face_img.shape[2] == 3:
            gray = cv2.cvtColor(face_img, cv2.COLOR_BGR2GRAY)
        else:
            gray = face_img
            
        # Apply contrast enhancement
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        enhanced = clahe.apply(gray)
        
        # Resize to target size
        resized = cv2.resize(enhanced, target_size)
        
        # Convert back to RGB if input was RGB
        if len(face_img.shape) == 3:
            resized = cv2.cvtColor(resized, cv2.COLOR_GRAY2BGR)
            
        return resized
    except Exception as e:
        logger.warning(f"Face enhancement failed: {str(e)}")
        return face_img