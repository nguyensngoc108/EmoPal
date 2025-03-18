import json
import base64
import logging
import numpy as np
import cv2
from datetime import datetime
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from apps.utils.emotion_analysis.analyzer import analyze_image
from apps.utils.emotion_analysis.trend_analyzer import EmotionTrendAnalyzer
from live_processing.emotion_processor import process_frame, extract_face_data
from live_processing.insight_generator import generate_insights
from io import BytesIO
from PIL import Image

logger = logging.getLogger(__name__)

class EmotionAnalysisConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.session_id = self.scope['url_route']['kwargs']['session_id']
        self.user = self.scope['user']
        
        # Join session group
        await self.channel_layer.group_add(
            f"session_{self.session_id}",
            self.channel_name
        )
        
        # Initialize session state
        self.emotion_history = []
        self.trend_analyzer = EmotionTrendAnalyzer()
        self.last_insights_update = 0  # Counter to control insight generation frequency
        self.insights = None
        
        await self.accept()
        logger.info(f"WebSocket connection established for session {self.session_id}")

    async def disconnect(self, close_code):
        # Leave session group
        await self.channel_layer.group_discard(
            f"session_{self.session_id}",
            self.channel_name
        )
        logger.info(f"WebSocket disconnected for session {self.session_id}: {close_code}")

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
            message_type = data.get('type')
            
            if message_type == 'analyze_frame':
                await self.handle_analyze_frame(data)
            elif message_type == 'ping':
                await self.send(text_data=json.dumps({"type": "pong"}))
                
        except Exception as e:
            logger.error(f"Error processing message: {str(e)}")
            await self.send(text_data=json.dumps({
                "type": "error",
                "message": f"Error processing request: {str(e)}"
            }))

    async def handle_analyze_frame(self, data):
        """Process a video frame and return emotion analysis"""
        try:
            # Extract image data
            frame_data = data.get('frame')
            if not frame_data or not frame_data.startswith('data:image'):
                raise ValueError("Invalid frame data format")
            
            # Decode base64 image
            image_data = frame_data.split(',')[1]
            image = Image.open(BytesIO(base64.b64decode(image_data)))
            
            # Convert to OpenCV format
            image_np = np.array(image)
            image_cv = cv2.cvtColor(image_np, cv2.COLOR_RGB2BGR)
            
            # Process frame using the emotion analyzer
            result = await self.process_frame_async(image_cv)
            
            if not result or "error" in result:
                logger.warning(f"Frame analysis error: {result.get('error', 'Unknown error')}")
                return
                
            # Extract basic emotions data
            emotions = result.get("faces", [{}])[0].get("emotions", {})
            dominant_emotion = result.get("faces", [{}])[0].get("dominant_emotion", "neutral")
            valence = result.get("faces", [{}])[0].get("valence", 0)
            engagement = result.get("faces", [{}])[0].get("engagement", 0)
            
            # Extract face detection data for UI overlay
            face_detection = None
            if result.get("faces"):
                face_detection = {
                    "x": result["faces"][0]["position"]["x"],
                    "y": result["faces"][0]["position"]["y"],
                    "width": result["faces"][0]["position"]["width"],
                    "height": result["faces"][0]["position"]["height"]
                }
                
            # Store data in history for trend analysis
            self.emotion_history.append({
                "timestamp": data.get('timestamp', 0),
                "emotions": emotions,
                "dominant_emotion": dominant_emotion,
                "valence": valence,
                "engagement": engagement
            })
            
            # Keep history at manageable size
            if len(self.emotion_history) > 100:
                self.emotion_history = self.emotion_history[-100:]
            
            # Generate trend analysis (every 5 frames to avoid overprocessing)
            trend_analysis = None
            if len(self.emotion_history) >= 5:
                self.last_insights_update += 1
                if self.last_insights_update >= 5:  # Every 5 frames
                    trend_analysis = self.trend_analyzer.analyze_session_data(self.emotion_history)
                    self.insights = generate_insights(trend_analysis, emotions, dominant_emotion)
                    self.last_insights_update = 0
                    
            # Prepare the response
            response = {
                "type": "emotion_update",
                "emotions": emotions,
                "dominant_emotion": dominant_emotion,
                "valence": valence,
                "engagement": engagement,
                "face_detection": face_detection
            }
            
            # Add trend analysis if available
            if trend_analysis:
                response["trend_analysis"] = trend_analysis
                
            # Add insights if available
            if self.insights:
                response["insights"] = self.insights
                
            # Check for significant emotional shifts
            if len(self.emotion_history) >= 3:
                prev_emotion = self.emotion_history[-2]["dominant_emotion"]
                prev_valence = self.emotion_history[-2]["valence"]
                
                # Detect shift from positive to negative or vice versa
                if ((prev_valence >= 0.3 and valence <= -0.3) or 
                    (prev_valence <= -0.3 and valence >= 0.3)):
                    response["warning"] = f"Significant emotional shift: {prev_emotion} → {dominant_emotion}"
                    
            # Send the response with face detection data
            await self.send(text_data=json.dumps({
                "type": "emotion_update",
                "emotions": emotions,
                "dominant_emotion": dominant_emotion,
                "valence": valence,
                "engagement": engagement,
                "face_detection": face_detection,
                "timestamp": data.get('timestamp', datetime.now().timestamp())
            }))
            
        except Exception as e:
            logger.error(f"Error analyzing frame: {str(e)}")
            await self.send(text_data=json.dumps({
                "type": "error",
                "message": f"Frame analysis error: {str(e)}"
            }))

    @database_sync_to_async
    def process_frame_async(self, frame):
        """Process frame in a non-blocking way"""
        try:
            # Using your existing analyze_image function
            result = analyze_image(frame, return_visualization=False)
            
            # Process for real-time efficiency
            return result
        except Exception as e:
            logger.error(f"Frame processing error: {str(e)}")
            return {"error": str(e)}