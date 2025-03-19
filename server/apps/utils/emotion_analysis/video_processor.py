import json
import cv2
import numpy as np
import logging
import matplotlib.pyplot as plt
import base64
from io import BytesIO
from datetime import datetime
from collections import deque

logger = logging.getLogger(__name__)

def get_optimal_sampling_rate(video_duration):
    """Determine best sampling rate based on video length"""
    if video_duration < 30:  # Short video
        return 0.5  # Sample 50% of frames
    elif video_duration < 120:  # 1-2 minute video
        return 0.25  # Sample 25% of frames
    else:  # Longer videos
        return 0.1  # Sample 10% of frames

# Modify the extract_frames function to better handle browser-generated WebM files
def extract_frames(video_path, sample_rate=1.0):
    """Extract frames from video with improved compatibility for browser WebM files"""
    # CRITICAL FIX: Try to use FFmpeg first for better WebM compatibility
    try:
        import subprocess
        import tempfile
        import os
        
        # Check if the file is WebM and possibly problematic
        is_webm = video_path.lower().endswith('.webm')
        
        if is_webm:
            # Create a temporary directory for extracted frames
            with tempfile.TemporaryDirectory() as temp_dir:
                # Use FFmpeg to extract frames (much better WebM support than OpenCV)
                ffmpeg_cmd = [
                    'ffmpeg', '-i', video_path, 
                    '-vf', f'fps=1/{int(1/sample_rate)}', # Extract at sample rate
                    f'{temp_dir}/frame_%04d.jpg'
                ]
                
                logger.info(f"Attempting FFmpeg extraction: {' '.join(ffmpeg_cmd)}")
                subprocess.run(ffmpeg_cmd, check=True, capture_output=True)
                
                # Check if frames were extracted
                frame_files = sorted([f for f in os.listdir(temp_dir) if f.startswith('frame_')])
                
                if frame_files:
                    # Get video info using FFprobe
                    ffprobe_cmd = [
                        'ffprobe', '-v', 'error', '-select_streams', 'v:0',
                        '-show_entries', 'stream=width,height,r_frame_rate,nb_frames',
                        '-of', 'json', video_path
                    ]
                    
                    result = subprocess.run(ffprobe_cmd, capture_output=True, text=True)
                    video_info = json.loads(result.stdout)['streams'][0]
                    
                    # Calculate FPS from rational number format
                    fps_parts = video_info['r_frame_rate'].split('/')
                    fps = float(fps_parts[0]) / float(fps_parts[1]) if len(fps_parts) > 1 else float(fps_parts[0])
                    
                    # Build video info dict
                    processed_info = {
                        "duration": float(video_info.get('nb_frames', 0)) / fps if fps > 0 else 0,
                        "fps": fps,
                        "frame_count": int(video_info.get('nb_frames', 0)),
                        "resolution": f"{video_info.get('width', 0)}x{video_info.get('height', 0)}"
                    }
                    
                    # Load frames using OpenCV
                    frames = []
                    for i, frame_file in enumerate(frame_files):
                        frame_path = os.path.join(temp_dir, frame_file)
                        frame = cv2.imread(frame_path)
                        if frame is not None:
                            # Estimate timestamp based on position and frame rate
                            timestamp = i / sample_rate
                            frames.append((i, timestamp, frame))
                    
                    logger.info(f"Successfully extracted {len(frames)} frames using FFmpeg")
                    return processed_info, frames
    except Exception as e:
        logger.warning(f"FFmpeg extraction failed, falling back to OpenCV: {str(e)}")
    
    # Original OpenCV method as fallback
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        logger.error(f"Failed to open video file: {video_path}")
        return None, []
    
    # Get video properties
    fps = cap.get(cv2.CAP_PROP_FPS)
    frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    duration = frame_count / fps if fps > 0 else 0
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    
    # Log detailed information about the video
    logger.info(f"Video info from OpenCV: fps={fps}, frames={frame_count}, duration={duration}, size={width}x{height}")
    
    # If video appears empty but file exists, try to force reading with relaxed constraints
    if frame_count == 0 and os.path.getsize(video_path) > 0:
        logger.warning("Video appears empty but file exists, forcing frame reading")
        
        # Try direct frame reading
        frames = []
        frame_idx = 0
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            
            timestamp = frame_idx / fps if fps > 0 else 0
            frames.append((frame_idx, timestamp, frame))
            frame_idx += 1
            
            # Apply sampling rate by skipping frames
            for _ in range(int(1/sample_rate) - 1):
                cap.read()  # Skip frames according to sampling rate
                frame_idx += 1
        
        # Update frame count based on what we actually read
        frame_count = len(frames)
        
        # Create video info dict
        video_info = {
            "duration": frame_count / fps if fps > 0 else 0,
            "fps": fps,
            "frame_count": frame_count,
            "resolution": f"{width}x{height}"
        }
        
        cap.release()
        return video_info, frames
    
    # For longer videos, improve sampling based on content analysis
    if duration > 60:  # Videos longer than 1 minute
        # Analyze first few frames to detect face density
        face_density = _analyze_face_density(cap)
        
        # Adjust sample rate based on face density
        if face_density > 0.7:  # High face presence
            sample_rate = max(sample_rate, 0.3)  # Ensure at least 30% sampling
        elif face_density < 0.3:  # Low face presence
            sample_rate = min(sample_rate * 1.5, 1.0)  # Increase sampling, max 100%
    
    # Determine which frames to sample
    sample_interval = max(1, int(1 / sample_rate))
    frames_to_sample = range(0, frame_count, sample_interval)
    
    # Extract frames with improved error handling
    frames = []
    for frame_idx in frames_to_sample:
        try:
            # Set frame position
            cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
            ret, frame = cap.read()
            
            if not ret or frame is None:
                continue
                
            # Calculate timestamp
            timestamp = frame_idx / fps
            
            # Enhanced pre-processing for better face detection
            # Resize large frames to improve processing speed while maintaining quality
            if width > 1280:
                scale_factor = 1280 / width
                new_width = 1280
                new_height = int(height * scale_factor)
                frame = cv2.resize(frame, (new_width, new_height))
            
            # Enhance contrast for better face detection
            frame = _enhance_frame_for_detection(frame)
            
            frames.append((frame_idx, timestamp, frame))
            
        except Exception as e:
            logger.warning(f"Error processing frame {frame_idx}: {str(e)}")
            continue
    
    cap.release()
    
    # If no frames were captured, try again with higher sample rate
    if not frames and sample_rate < 0.5:
        logger.warning("No frames captured, retrying with higher sample rate")
        return extract_frames(video_path, min(sample_rate * 2, 1.0))
        
    return video_info, frames

def _analyze_face_density(cap):
    """Analyze first few frames to determine face density"""
    face_frames = 0
    total_frames = 10  # Check first 10 frames
    
    for i in range(total_frames):
        ret, frame = cap.read()
        if not ret or frame is None:
            continue
            
        # Reset position after reading
        if i == 0:
            cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
            
        # Detect faces
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
        faces = face_cascade.detectMultiScale(gray, 1.1, 4)
        
        if len(faces) > 0:
            face_frames += 1
    
    # Reset position again
    cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
    
    return face_frames / total_frames

def apply_temporal_smoothing(frame_emotions, window_size=5):
    """Smooth emotion predictions across frames to reduce fluctuation"""
    if not frame_emotions or len(frame_emotions) < 2:
        return frame_emotions
        
    # Use only the most recent frames up to window_size
    recent_frames = frame_emotions[-window_size:]
    
    # Initialize with first frame's emotions
    smoothed = {}
    for emotion in recent_frames[0].keys():
        values = [frame[emotion] for frame in recent_frames]
        smoothed[emotion] = sum(values) / len(values)
    
    return smoothed

def _enhance_frame_for_detection(frame):
    """Enhance frame for better face detection"""
    # Convert to grayscale for histogram equalization
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    
    # Apply histogram equalization to improve contrast
    equ = cv2.equalizeHist(gray)
    
    # Convert back to BGR for colored output
    enhanced = cv2.cvtColor(equ, cv2.COLOR_GRAY2BGR)
    
    # Blend with original for more natural look
    result = cv2.addWeighted(frame, 0.7, enhanced, 0.3, 0)
    
    return result

def generate_timeline_graph(emotion_timeline, width=800, height=500):
    """Generate a timeline graph for emotion changes throughout a video"""
    try:
        import matplotlib
        matplotlib.use('Agg')
        import matplotlib.pyplot as plt
        # Create figure
        fig, ax = plt.subplots(figsize=(width/100, height/100), dpi=100)
        
        # Plot each emotion
        for i, (emotion, data_points) in enumerate(emotion_timeline.items()):
            if not data_points:
                continue
                
            timestamps = [point["timestamp"] for point in data_points]
            values = [point["value"] for point in data_points]
            
            ax.plot(timestamps, values, label=emotion, marker='o', markersize=3)
        
        # Add labels and legend
        ax.set_xlabel('Time (seconds)')
        ax.set_ylabel('Emotion Probability')
        ax.set_title('Emotion Timeline')
        ax.legend(loc='upper right')
        ax.grid(True, alpha=0.3)
        
        # Set y-axis from 0 to 1
        ax.set_ylim(0, 1.0)
        
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
        logger.error(f"Error generating timeline graph: {str(e)}")
        return None

def create_video_preview(frame_results, max_frames=6, output_size=(800, None)):
    """Create a preview image with key frames from video analysis"""
    try:
        if not frame_results:
            return None
            
        # Select frames evenly distributed throughout the video
        frames_with_faces = [f for f in frame_results if f.get("faces")]
        if not frames_with_faces:
            return None
            
        # Select subset of frames
        if len(frames_with_faces) > max_frames:
            step = len(frames_with_faces) // max_frames
            selected_frames = frames_with_faces[::step][:max_frames]
        else:
            selected_frames = frames_with_faces
            
        # Prepare frame locations
        rows = (len(selected_frames) + 1) // 2  # Arrange in 2 columns
        cols = min(2, len(selected_frames))
        
        # Need actual image data for this
        # This is a placeholder - in reality, you'd need the actual frame images
        # This function would be called during video analysis when frames are available
        
        logger.info(f"Would create preview with {len(selected_frames)} frames in {rows}x{cols} grid")
        return None
        
    except Exception as e:
        logger.error(f"Error creating video preview: {str(e)}")
        return None

def detect_emotion_changes(emotion_timeline, threshold=0.3):
    """Detect significant changes in emotions over time"""
    if not emotion_timeline:
        return []
        
    significant_changes = []
    
    # For each emotion, detect significant increases/decreases
    for emotion, data_points in emotion_timeline.items():
        if len(data_points) < 3:
            continue
            
        for i in range(1, len(data_points)):
            prev_value = data_points[i-1]["value"]
            curr_value = data_points[i]["value"]
            curr_timestamp = data_points[i]["timestamp"]
            
            # Detect significant increases or decreases
            if abs(curr_value - prev_value) > threshold:
                direction = "increased" if curr_value > prev_value else "decreased"
                significant_changes.append({
                    "emotion": emotion,
                    "timestamp": curr_timestamp,
                    "change": direction,
                    "from": prev_value,
                    "to": curr_value
                })
    
    # Sort by timestamp
    significant_changes.sort(key=lambda x: x["timestamp"])
    return significant_changes

def create_framewise_visualization(frames, face_results, interval=10):
    """Create a visualization showing emotion detection across multiple frames"""
    try:
        if not frames or not face_results:
            return None
            
        # Select frames at regular intervals
        total_frames = len(frames)
        if total_frames <= 6:
            # Use all frames if we have 6 or fewer
            selected_indices = range(total_frames)
        else:
            # Select evenly distributed frames
            step = max(1, total_frames // 6)
            selected_indices = range(0, total_frames, step)[:6]
        
        # Prepare canvas
        rows = min(2, len(selected_indices))
        cols = (len(selected_indices) + rows - 1) // rows
        
        # Calculate tile size and overall image size
        frame_height, frame_width = frames[0][2].shape[:2] if frames else (300, 400)
        tile_width = 400
        tile_height = int(frame_height * (tile_width / frame_width))
        
        # Create canvas
        canvas_width = tile_width * cols
        canvas_height = tile_height * rows
        canvas = np.zeros((canvas_height, canvas_width, 3), dtype=np.uint8)
        
        # Add frames to canvas
        for idx, frame_idx in enumerate(selected_indices):
            # Get frame and results
            _, timestamp, frame = frames[frame_idx]
            result = face_results[frame_idx] if frame_idx < len(face_results) else None
            
            # Calculate position
            row = idx // cols
            col = idx % cols
            x_offset = col * tile_width
            y_offset = row * tile_height
            
            # Resize frame
            resized_frame = cv2.resize(frame, (tile_width, tile_height))
            
            # Draw emotion labels if available
            if result and result.get("faces"):
                # For each face
                for face_data in result["faces"]:
                    # Get position and scale for the resized frame
                    fx = face_data["position"]["x"] * (tile_width / frame_width)
                    fy = face_data["position"]["y"] * (tile_height / frame_height)
                    fw = face_data["position"]["width"] * (tile_width / frame_width)
                    fh = face_data["position"]["height"] * (tile_height / frame_height)
                    
                    # Draw rectangle
                    cv2.rectangle(resized_frame, (int(fx), int(fy)), 
                                  (int(fx+fw), int(fy+fh)), (0, 255, 0), 2)
                    
                    # Add emotion text
                    emotion = face_data["dominant_emotion"]
                    cv2.putText(resized_frame, emotion, (int(fx), int(fy-5)),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 1)
            
            # Draw timestamp
            cv2.putText(resized_frame, f"T: {timestamp:.1f}s", (10, 20),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
            
            # Place on canvas
            canvas[y_offset:y_offset+tile_height, x_offset:x_offset+tile_width] = resized_frame
        
        # Convert to base64
        _, buffer = cv2.imencode('.jpg', canvas)
        viz_b64 = base64.b64encode(buffer).decode('utf-8')
        return f"data:image/jpeg;base64,{viz_b64}"
        
    except Exception as e:
        logger.error(f"Error creating framewise visualization: {str(e)}")
        return None