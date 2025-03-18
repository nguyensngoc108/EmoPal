import cv2
import numpy as np
from apps.utils.emotion_analysis.analyzer import analyze_image
import logging

logger = logging.getLogger(__name__)

def process_frame(frame):
    """
    Process a video frame for emotion analysis with optimizations for real-time performance
    """
    try:
        # Resize frame for better performance if needed
        height, width = frame.shape[:2]
        if width > 640:
            scale = 640 / width
            new_width = 640
            new_height = int(height * scale)
            frame = cv2.resize(frame, (new_width, new_height))
        
        # Enhance contrast for better face detection
        frame = enhance_frame_for_detection(frame)
        
        # Analyze with existing function
        result = analyze_image(frame, return_visualization=False)
        return result
    except Exception as e:
        logger.error(f"Error processing frame: {str(e)}")
        return {"error": str(e)}

def extract_face_data(result):
    """
    Extract face position data from analysis result
    """
    if not result or "faces" not in result or not result["faces"]:
        return None
    
    face = result["faces"][0]  # Using first face for now
    return {
        "x": face["position"]["x"],
        "y": face["position"]["y"],
        "width": face["position"]["width"],
        "height": face["position"]["height"]
    }

def enhance_frame_for_detection(frame):
    """
    Enhance frame for better face detection
    """
    # Convert to grayscale for histogram equalization
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    
    # Apply histogram equalization to improve contrast
    equ = cv2.equalizeHist(gray)
    
    # Convert back to BGR for colored output
    enhanced = cv2.cvtColor(equ, cv2.COLOR_GRAY2BGR)
    
    # Blend with original for more natural look
    result = cv2.addWeighted(frame, 0.7, enhanced, 0.3, 0)
    
    return result