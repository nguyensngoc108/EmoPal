import os
import sys
import torch
import logging
import cv2
import uuid
import base64
from io import BytesIO
from datetime import datetime
from torchvision import transforms
import numpy as np

# Import specialized processors
from .image_processor import (
    load_image, detect_faces, analyze_face, generate_visualization, 
    generate_emotion_graph, enhance_face_quality
)
from .video_processor import (
    extract_frames, apply_temporal_smoothing, generate_timeline_graph,
    get_optimal_sampling_rate, detect_emotion_changes, create_framewise_visualization
)

# Add parent directory to path to allow importing ResEmoteNet
parent_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../"))
sys.path.append(parent_dir)
from approach.ResEmoteNet import ResEmoteNet

# Configure logging
logger = logging.getLogger(__name__)

# Emotion class labels
CLASS_LABELS = ['angry', 'disgust', 'fear', 'happy', 'neutral', 'sad', 'surprise']

# Valence & Engagement weights
VALENCE_WEIGHTS = [-0.8, -0.7, -0.6, 0.8, 0, -0.5, 0.7]  # Approximate Valence Scores
ENGAGEMENT_WEIGHTS = [0.6, 0.8, 0.7, 1.0, 0.3, 0.5, 0.9]  # Expressiveness Scores

# Model path
MODEL_PATH = os.path.join(parent_dir, 'best_finetuned_ResEmoteNet.pth')

# Image transformations
def get_transform():
    """Get image transformations for model input"""
    return transforms.Compose([
        transforms.Grayscale(num_output_channels=3),
        transforms.Resize((48, 48)),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.5, 0.5, 0.5], std=[0.5, 0.5, 0.5])
    ])

# Initialize model
def load_model():
    """Load the pre-trained emotion detection model"""
    # Use MPS for Mac GPU support
    device = torch.device("mps" if torch.backends.mps.is_available() else "cpu")
    
    try:
        # Create model instance first
        model = ResEmoteNet().to(device)
        # Then load state dict
        model.load_state_dict(torch.load(MODEL_PATH, map_location=device))
        model.eval()  # Set to evaluation mode
        logger.info(f"Emotion model loaded successfully on {device}")
        return model, device
    except Exception as e:
        logger.error(f"Error loading emotion model: {str(e)}")
        return None, device

# Main analysis function for image
def analyze_image(image_path_or_obj, return_visualization=False):
    """
    Analyze emotions in an image
    
    Args:
        image_path_or_obj: Path to image or PIL Image/numpy array
        return_visualization: Whether to return visualization image
        
    Returns:
        dict: Analysis results
    """
    # Load model
    model, device = load_model()
    if model is None:
        return {"error": "Failed to load emotion model"}
    
    transform = get_transform()
    
    try:
        # Load image using image processor
        image = load_image(image_path_or_obj)
        
        # Detect faces
        faces, image = detect_faces(image)
        
        # Initialize results
        results = {
            "face_count": len(faces),
            "faces": [],
            "timestamp": datetime.utcnow().isoformat(),
            "overall": {
                "dominant_emotion": None,
                "avg_valence": 0,
                "avg_engagement": 0
            }
        }
        
        # If no faces detected
        if len(faces) == 0:
            results["error"] = "No faces detected in the image"
            return results
        
        # Track overall metrics
        all_valences = []
        all_engagements = []
        emotion_counts = {emotion: 0 for emotion in CLASS_LABELS}
        
        # Process each face
        for i, (x, y, w, h) in enumerate(faces):
            # Extract face region
            face_roi = image[y:y+h, x:x+w]
            
            # Apply face enhancement before analysis
            enhanced_face = enhance_face_quality(face_roi, target_size=(48, 48))
            
            # Analyze face using image processor
            face_result = analyze_face(
                enhanced_face, model, device, transform, 
                CLASS_LABELS, VALENCE_WEIGHTS, ENGAGEMENT_WEIGHTS
            )
            
            # Store face results with position
            face_data = {
                "face_id": i,
                "position": {"x": int(x), "y": int(y), "width": int(w), "height": int(h)},
                "emotions": face_result["emotions"],
                "dominant_emotion": face_result["dominant_emotion"],
                "confidence": face_result["confidence"],
                "valence": face_result["valence"],
                "engagement": face_result["engagement"]
            }
            
            results["faces"].append(face_data)
            
            # Track overall metrics
            all_valences.append(face_result["valence"])
            all_engagements.append(face_result["engagement"])
            emotion_counts[face_result["dominant_emotion"]] += 1
        
        # Calculate overall metrics
        if results["faces"]:
            results["overall"]["avg_valence"] = sum(all_valences) / len(all_valences)
            results["overall"]["avg_engagement"] = sum(all_engagements) / len(all_engagements)
            results["overall"]["dominant_emotion"] = max(emotion_counts, key=emotion_counts.get)
        
        # Generate visualization if requested
        if return_visualization:
            results["visualization"] = generate_visualization(image, results["faces"])
        
        # Generate emotion graph
        if results["faces"]:
            graph_data = results["faces"][0]  # Use first face for graph
            results["graph"] = generate_emotion_graph(graph_data)
        
        return results
        
    except Exception as e:
        logger.error(f"Error analyzing image: {str(e)}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        return {"error": f"Error analyzing image: {str(e)}"}

# Video analysis
def analyze_video(video_path, sample_rate=None):
    """
    Enhanced analysis of emotions in a video with improved face detection
    """
    model, device = load_model()
    if model is None:
        return {"error": "Failed to load emotion model"}
    
    transform = get_transform()
    
    try:
        # Extract video information and frames
        video_info, frames = extract_frames(video_path, sample_rate or 0.2)
        if not video_info:
            return {"error": "Failed to open video file"}
        
        if not frames:
            return {"error": "No frames could be extracted from video"}
        
        # Optimize sampling rate based on video length
        if not sample_rate:
            sample_rate = get_optimal_sampling_rate(video_info["duration"])
            # Re-extract frames with optimal rate if not specified
            video_info, frames = extract_frames(video_path, sample_rate)
        
        logger.info(f"Processing video: {len(frames)} frames extracted, duration: {video_info['duration']:.2f}s")
        
        # Initialize results
        results = {
            "video_info": video_info,
            "frames": [],
            "face_count": 0,
            "overall": {
                "face_count": 0,
                "dominant_emotion": None,
                "avg_valence": 0,
                "avg_engagement": 0,
                "emotion_timeline": {emotion: [] for emotion in CLASS_LABELS}
            }
        }
        
        # Process sampled frames
        all_emotions = {emotion: [] for emotion in CLASS_LABELS}
        all_valences = []
        all_engagements = []
        face_count_total = 0
        frames_with_faces = 0
        
        # Store recent emotions for smoothing
        recent_emotions = []
        
        # Use MTCNN for better face detection if available
        try:
            from facenet_pytorch import MTCNN
            mtcnn = MTCNN(keep_all=True, device=device)
            use_mtcnn = True
            logger.info("Using MTCNN for improved face detection")
        except ImportError:
            use_mtcnn = False
            logger.info("MTCNN not available, using OpenCV cascade classifier")
        
        for frame_idx, timestamp, frame in frames:
            # Detect faces with improved accuracy
            if use_mtcnn:
                # Convert BGR to RGB for MTCNN
                frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                boxes, _ = mtcnn.detect(frame_rgb)
                
                if boxes is not None:
                    faces = []
                    for box in boxes:
                        x, y, x2, y2 = [int(b) for b in box]
                        w = x2 - x
                        h = y2 - y
                        faces.append((x, y, w, h))
                else:
                    faces = []
            else:
                faces, _ = detect_faces(frame)
            
            frame_result = {
                "frame_idx": frame_idx,
                "timestamp": timestamp,
                "face_count": len(faces),
                "faces": []
            }
            
            # Track emotions in this frame
            if len(faces) > 0:
                frames_with_faces += 1
                face_count_total += len(faces)
                
                for i, (x, y, w, h) in enumerate(faces):
                    # Ensure face coordinates are within image bounds
                    x = max(0, x)
                    y = max(0, y)
                    w = min(w, frame.shape[1] - x)
                    h = min(h, frame.shape[0] - y)
                    
                    if w <= 0 or h <= 0:
                        continue
                    
                    try:
                        # Extract face region with proper bounds checking
                        face_roi = frame[y:y+h, x:x+w]
                        
                        if face_roi.size == 0:
                            continue
                        
                        # Apply face enhancement before analysis
                        enhanced_face = enhance_face_quality(face_roi, target_size=(48, 48))
                        
                        # Analyze face 
                        face_result = analyze_face(
                            enhanced_face, model, device, transform, 
                            CLASS_LABELS, VALENCE_WEIGHTS, ENGAGEMENT_WEIGHTS
                        )
                        
                        # Apply temporal smoothing for UI stability
                        if recent_emotions and i == 0:  # Only smooth primary face
                            smoothed_emotions = apply_temporal_smoothing(
                                [recent_emotions[-1], face_result["emotions"]], 
                                window_size=2
                            )
                            face_result["emotions"] = smoothed_emotions
                        
                        # Update recent emotions
                        if i == 0:  # Only track primary face
                            recent_emotions.append(face_result["emotions"])
                            if len(recent_emotions) > 10:
                                recent_emotions.pop(0)  # Keep only last 10 frames
                        
                        # Store results
                        face_data = {
                            "face_id": i,
                            "position": {"x": int(x), "y": int(y), "width": int(w), "height": int(h)},
                            "emotions": face_result["emotions"],
                            "dominant_emotion": face_result["dominant_emotion"],
                            "confidence": face_result["confidence"],
                            "valence": face_result["valence"],
                            "engagement": face_result["engagement"]
                        }
                        
                        frame_result["faces"].append(face_data)
                        
                        # Add to overall tracking
                        for emotion, prob in face_result["emotions"].items():
                            all_emotions[emotion].append(prob)
                        all_valences.append(face_result["valence"])
                        all_engagements.append(face_result["engagement"])
                        
                        # Add to timeline (use first detected face for timeline)
                        if i == 0:
                            for emotion, prob in face_result["emotions"].items():
                                results["overall"]["emotion_timeline"][emotion].append({
                                    "timestamp": timestamp,
                                    "value": prob
                                })
                                
                    except Exception as e:
                        logger.warning(f"Error analyzing face in frame {frame_idx}: {str(e)}")
                        continue
            
            results["frames"].append(frame_result)
        
        # Calculate overall metrics if any faces were detected
        results["face_detected"] = frames_with_faces > 0
        
        if face_count_total > 0:
            results["overall"]["face_count"] = face_count_total
            results["face_count"] = face_count_total
            
            # Calculate average emotions
            avg_emotions = {emotion: sum(probs) / len(probs) if probs else 0 
                           for emotion, probs in all_emotions.items()}
            results["overall"]["emotions"] = avg_emotions
            results["emotions"] = avg_emotions
            
            # Determine dominant emotion
            if avg_emotions:
                dominant_emotion = max(avg_emotions, key=avg_emotions.get)
                results["overall"]["dominant_emotion"] = dominant_emotion
                results["dominant_emotion"] = dominant_emotion
                
                # Calculate confidence for dominant emotion
                results["confidence"] = avg_emotions.get(dominant_emotion, 0)
            
            # Calculate average valence & engagement
            if all_valences:
                avg_valence = sum(all_valences) / len(all_valences)
                results["overall"]["avg_valence"] = avg_valence
                results["valence"] = avg_valence
            
            if all_engagements:
                avg_engagement = sum(all_engagements) / len(all_engagements)
                results["overall"]["avg_engagement"] = avg_engagement
                results["engagement"] = avg_engagement
            
            # Detect significant emotion changes
            results["emotion_changes"] = detect_emotion_changes(results["overall"]["emotion_timeline"])
        else:
            logger.warning("No faces detected in any video frames")
            results["error"] = "No faces detected in video frames"
        
        # Generate enhanced visualization
        results = _generate_enhanced_visualizations(results, frames)
        
        return results
        
    except Exception as e:
        logger.error(f"Error analyzing video: {str(e)}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        return {"error": f"Error analyzing video: {str(e)}"}

def _generate_enhanced_visualizations(results, frames):
    """Generate all visualizations for video analysis"""
    try:
        # Generate timeline graph showing emotion changes over time
        if results["overall"]["emotion_timeline"]:
            timeline_graph = generate_timeline_graph(results["overall"]["emotion_timeline"])
            if timeline_graph:
                results["timeline_graph"] = timeline_graph
        
        # Generate frame visualization showing detected faces and emotions
        if frames and results["frames"]:
            frame_viz = create_framewise_visualization(frames, results["frames"])
            if frame_viz:
                results["frame_visualization"] = frame_viz
        
        # Generate emotional intensity heatmap
        if results.get("overall", {}).get("emotions"):
            results["emotion_heatmap"] = generate_emotion_heatmap(results["overall"]["emotions"])
        
        # Generate annotated video preview - REMOVE MAX_DURATION PARAMETER
        if frames and results["face_detected"]:
            try:
                # This is the key change - no max_duration parameter!
                annotated_video_path = create_annotated_video_preview(
                    frames, results["frames"]
                )
                
                # Store the path for later processing
                if annotated_video_path:
                    results["annotated_video_path"] = annotated_video_path
                    
            except Exception as viz_err:
                logger.warning(f"Error creating annotated video: {str(viz_err)}")
        
        return results
        
    except Exception as e:
        logger.error(f"Error generating visualizations: {str(e)}")
        return results
def create_annotated_video_preview(frames, frame_results, max_duration=None):
    """
    Create an annotated video preview showing emotions in real-time
    Now preserves original video length and framerate
    
    Args:
        frames: List of (frame_idx, timestamp, frame) tuples
        frame_results: Analysis results per frame
        max_duration: If provided, limits the video length (default: None = use full duration)
        
    Returns:
        str: Path to the saved video file
    """
    try:
        if not frames or not frame_results:
            return None
        
        # Get dimensions of first frame
        _, _, first_frame = frames[0]
        height, width, _ = first_frame.shape
        
        # Get the original video framerate (estimated from timestamps)
        if len(frames) > 1:
            timestamps = [timestamp for _, timestamp, _ in frames]
            avg_time_diff = (timestamps[-1] - timestamps[0]) / (len(timestamps) - 1)
            original_fps = 1.0 / avg_time_diff if avg_time_diff > 0 else 30.0
        else:
            original_fps = 30.0  # Default if can't calculate
            
        logger.info(f"Original video estimated at {original_fps:.2f} fps")
        
        # Calculate video duration for logging
        video_duration = frames[-1][1] - frames[0][1] if len(frames) > 1 else 0
        logger.info(f"Original video duration: {video_duration:.2f} seconds")
        
        # Use all frames by default, or limit if max_duration is specified
        if max_duration and len(frames) > 1:
            if video_duration > max_duration:
                # Keep fps but reduce frames
                sample_ratio = max_duration / video_duration
                step = max(1, int(1.0 / sample_ratio))
                selected_indices = range(0, len(frames), step)
                selected_frames = []
                for i in selected_indices:
                    if i < len(frame_results):
                        selected_frames.append((frames[i], frame_results[i]))
                logger.info(f"Limiting video from {video_duration:.2f}s to {max_duration:.2f}s, keeping {len(selected_frames)} of {len(frames)} frames")
            else:
                selected_frames = list(zip(frames, frame_results))
        else:
            # Use all frames for full duration
            selected_frames = list(zip(frames, frame_results))
            
        logger.info(f"Creating annotated video with {len(selected_frames)} frames at {original_fps:.2f} fps")
            
        # Create output video file with temporary path
        temp_path = f"/tmp/annotated_video_{uuid.uuid4().hex}.mp4"
        
        # Use H.264 codec which is better supported by Cloudinary
        fourcc = cv2.VideoWriter_fourcc(*'avc1')
        
        # Use original fps (capped between 15-60 fps for compatibility)
        output_fps = max(15, min(60, original_fps))
        
        # Create video writer
        out = cv2.VideoWriter(temp_path, fourcc, output_fps, (width, height))
        if not out.isOpened():
            # Fallback to other codecs if H.264 is not available
            logger.warning("Failed to create video with avc1 codec, trying mp4v")
            fourcc = cv2.VideoWriter_fourcc(*'mp4v')
            out = cv2.VideoWriter(temp_path, fourcc, output_fps, (width, height))
        
        if not out.isOpened():
            raise Exception("Could not create video writer")
        
        # Process each frame with annotations
        for (frame_idx, timestamp, frame), frame_result in selected_frames:
            # Create a copy to avoid modifying original
            annotated = frame.copy()
            
            # Add timestamp
            cv2.putText(annotated, f"Time: {timestamp:.2f}s", (10, 30),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
            
            # Add faces and emotions
            for face_data in frame_result.get("faces", []):
                # Get face position
                x = face_data["position"]["x"]
                y = face_data["position"]["y"]
                w = face_data["position"]["width"]
                h = face_data["position"]["height"]
                
                # Draw face rectangle
                emotion = face_data["dominant_emotion"]
                confidence = face_data["confidence"]
                
                # Choose color based on emotion
                color = get_emotion_color(emotion)
                
                # Draw rectangle around face
                cv2.rectangle(annotated, (x, y), (x+w, y+h), color, 2)
                
                # Add emotion label
                label = f"{emotion} ({confidence:.0%})"
                cv2.putText(annotated, label, (x, y-10),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)
                
                # Add valence and engagement meters
                valence = face_data["valence"]
                engagement = face_data["engagement"]
                
                # Valence meter (negative to positive)
                meter_width = 60
                meter_height = 10
                meter_x = x + w + 10
                meter_y = y
                
                # Draw valence background
                cv2.rectangle(annotated, 
                             (meter_x, meter_y), 
                             (meter_x + meter_width, meter_y + meter_height),
                             (100, 100, 100), -1)
                
                # Calculate valence position (map from -1,1 to 0,meter_width)
                val_pos = int((valence + 1) / 2 * meter_width)
                val_color = (0, 0, 255) if valence < 0 else (0, 255, 0)  # Red for negative, green for positive
                
                # Draw valence indicator
                cv2.rectangle(annotated,
                             (meter_x, meter_y),
                             (meter_x + val_pos, meter_y + meter_height),
                             val_color, -1)
                
                # Label
                cv2.putText(annotated, "Valence", (meter_x, meter_y - 5),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.4, (255, 255, 255), 1)
                
                # Engagement meter
                eng_meter_y = meter_y + meter_height + 15
                
                # Draw engagement background
                cv2.rectangle(annotated,
                             (meter_x, eng_meter_y),
                             (meter_x + meter_width, eng_meter_y + meter_height),
                             (100, 100, 100), -1)
                
                # Draw engagement indicator
                eng_pos = int(engagement * meter_width)
                cv2.rectangle(annotated,
                             (meter_x, eng_meter_y),
                             (meter_x + eng_pos, eng_meter_y + meter_height),
                             (255, 165, 0), -1)  # Orange for engagement
                
                # Label
                cv2.putText(annotated, "Engagement", (meter_x, eng_meter_y - 5),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.4, (255, 255, 255), 1)
                
                # Add emotion bars at the bottom for the primary face
                if face_data.get("face_id", -1) == 0:
                    # Draw emotion bars at the bottom
                    emotions = face_data.get("emotions", {})
                    if emotions:
                        emotion_bar_height = 30
                        emotion_bar_y = height - emotion_bar_height - 10
                        emotion_bar_width = width // len(emotions)
                        
                        for i, (emotion_name, value) in enumerate(emotions.items()):
                            # Calculate position
                            bar_x = i * emotion_bar_width
                            bar_height = int(value * emotion_bar_height)
                            
                            # Draw bar background
                            cv2.rectangle(annotated,
                                        (bar_x, emotion_bar_y),
                                        (bar_x + emotion_bar_width, height - 10),
                                        (30, 30, 30), -1)
                            
                            # Draw emotion value
                            cv2.rectangle(annotated,
                                        (bar_x, height - 10 - bar_height),
                                        (bar_x + emotion_bar_width, height - 10),
                                        get_emotion_color(emotion_name), -1)
                            
                            # Add label
                            cv2.putText(annotated, f"{emotion_name}",
                                       (bar_x + 5, height - 15),
                                       cv2.FONT_HERSHEY_SIMPLEX, 0.4, (255, 255, 255), 1)
            
            # Write frame to output video
            out.write(annotated)
        
        # Release video writer
        out.release()
        
        # IMPORTANT: Return the path to the file (don't convert to base64)
        logger.info(f"Created annotated video at {temp_path}")
        return temp_path
        
    except Exception as e:
        logger.error(f"Error creating annotated video: {str(e)}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        return None

def get_emotion_color(emotion):
    """Get color for emotion visualization"""
    colors = {
        'happy': (0, 255, 0),     # Green
        'sad': (255, 0, 0),       # Blue (BGR)
        'angry': (0, 0, 255),     # Red
        'fear': (0, 0, 128),      # Dark Red
        'neutral': (128, 128, 128), # Gray
        'surprise': (0, 255, 255),  # Yellow
        'disgust': (128, 0, 128)    # Purple
    }
    return colors.get(emotion, (200, 200, 200))  # Default gray

def generate_emotion_heatmap(emotions):
    """Generate a heatmap visualization of emotions"""
    try:
        import matplotlib
        matplotlib.use('Agg')
        import matplotlib.pyplot as plt
        import seaborn as sns
        
        # Create figure
        fig, ax = plt.subplots(figsize=(10, 6), dpi=100)
        
        # Prepare data
        emotions_sorted = sorted(emotions.items(), key=lambda x: x[1], reverse=True)
        labels = [e[0].capitalize() for e in emotions_sorted]
        values = [e[1] for e in emotions_sorted]
        
        # Create heatmap-style bar chart
        cmap = plt.cm.get_cmap('viridis')
        bars = ax.barh(labels, values, color=[cmap(v) for v in values])
        
        # Add value labels
        for i, v in enumerate(values):
            ax.text(v + 0.01, i, f'{v:.2f}', va='center')
        
        # Customize chart
        ax.set_title('Emotion Distribution', fontsize=14)
        ax.set_xlim(0, max(values) * 1.1)
        
        # Add color bar
        sm = plt.cm.ScalarMappable(cmap=cmap)
        sm.set_array([])
        cbar = fig.colorbar(sm)
        cbar.set_label('Intensity')
        
        # Convert to image
        buf = BytesIO()
        fig.tight_layout()
        plt.savefig(buf, format='png')
        plt.close(fig)
        buf.seek(0)
        
        # Convert to base64 for embedding in HTML
        graph_img = base64.b64encode(buf.getvalue()).decode('utf-8')
        return f"data:image/png;base64,{graph_img}"
        
    except Exception as e:
        logger.error(f"Error generating emotion heatmap: {str(e)}")
        return None