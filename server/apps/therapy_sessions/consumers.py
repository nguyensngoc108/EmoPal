import json
import logging
import os
import sys
import time
import asyncio
from datetime import datetime
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from bson import ObjectId
from dotenv import load_dotenv
# from agora_token_builder import RtcTokenBuilder, Role_Publisher
from apps.utils.agora_token_helper import generate_rtc_token
from apps.utils.emotion_analysis import analyze_image
from apps.emotions.models import EmotionAnalysis
from apps.utils.emotion_analysis.trend_analyzer import EmotionTrendAnalyzer
from apps.utils.emotion_analysis.session_summary import SessionSummaryGenerator
from PIL import Image
import base64
import io
import numpy as np
import cv2
import numpy as np
from collections import deque
import time
# Load environment variables
load_dotenv()

# Import models - ensuring proper paths for imports
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../../")))
from apps.therapy_sessions.models import TherapySession
from apps.users.models import User

# Setup logger
logger = logging.getLogger(__name__)

# Optional: Import Agora token builder if installed
try:
    from apps.utils.RtcTokenBuilder2 import RtcTokenBuilder, Role_Publisher
    AGORA_TOKEN_AVAILABLE = True
    logger = logging.getLogger(__name__)
    logger.info("Successfully imported local RtcTokenBuilder")
except ImportError:
    logger.warning("Local RtcTokenBuilder not available")
    AGORA_TOKEN_AVAILABLE = False

    
class VideoSessionConsumer(AsyncWebsocketConsumer):
    """Enhanced WebSocket consumer for video therapy sessions"""
    
    async def connect(self):
        """Handle WebSocket connection and setup session"""
        logger.info("VideoSessionConsumer: Connection attempt")
        try:
            # Extract parameters from URL route
            self.session_id = self.scope['url_route']['kwargs']['session_id']
            self.user_id = self.scope['url_route']['kwargs']['user_id']
            
            # Set a default user_role (important for disconnect handler)
            self.user_role = 'unknown'
            
            # Get session info and verify user access
            self.session_info = await self.get_session_info()
            if not self.session_info:
                logger.warning(f"Access denied: session={self.session_id}, user={self.user_id}")
                await self.close(code=4003)
                return
                
            # FIXED: More accurate role determination
            from database import db
            users_collection = db["users"]
            user = await database_sync_to_async(users_collection.find_one)({"_id": ObjectId(self.user_id)})
            
            # Check if this is a therapist account
            if user.get('role') == 'therapist':
                therapist_id_from_user = user.get('therapist_id')
                session_therapist_id = self.session_info.get('therapist_id')
                
                # Double-check therapist_id matches session's therapist_id
                if str(therapist_id_from_user) == str(session_therapist_id):
                    self.user_role = 'therapist'
                    self.other_user_id = str(self.session_info.get('user_id', ''))
                    logger.info(f"User {self.user_id} identified as therapist for session {self.session_id}")
                else:
                    logger.warning(f"Therapist ID mismatch: user has {therapist_id_from_user}, session expects {session_therapist_id}")
                    self.user_role = 'client'  # Default to client if there's a mismatch
                    self.other_user_id = str(self.session_info.get('therapist_id', ''))
            else:
                # Must be a client
                self.user_role = 'client'
                
                # Get the therapist_id from session
                therapist_id = str(self.session_info.get('therapist_id', ''))
                
                # FIXED: For clients, we need to find the therapist's user_id
                from database import db
                therapist = db.therapists.find_one({"_id": ObjectId(therapist_id)})
                
                if therapist and "user_id" in therapist:
                    # Use therapist's user_id from the therapists collection
                    self.other_user_id = str(therapist["user_id"])
                    logger.info(f"Client {self.user_id} mapped therapist_id {therapist_id} to user_id {self.other_user_id}")
                else:
                    # Fallback to therapist_id if mapping can't be found
                    self.other_user_id = therapist_id
                    logger.warning(f"Could not find user_id for therapist {therapist_id}, using therapist_id directly")
                
                logger.info(f"User {self.user_id} identified as client for session {self.session_id}")
            
            # Set session variables
            self.room_name = f"video_{self.session_id}"
            self.room_group_name = self.room_name
            self.emotion_history = {emotion: deque(maxlen=30) for emotion in ['angry', 'disgust', 'fear', 'happy', 'neutral', 'sad', 'surprise']}
            self.valence_history = deque(maxlen=30)
            self.engagement_history = deque(maxlen=30)
            self.last_analysis_time = 0
            self.analysis_interval = 1.0  # Process at most 1 frame per second
            self.emotional_shift_detected = False
            self.session_start_time = datetime.utcnow()
            self.warning_threshold = 0.7  # Alert on high negative emotions
            self.emotion_data = []  # Store emotion data during session
            self.frame_count = 0
            self.trend_analyzer = EmotionTrendAnalyzer()
            self.summary_generator = SessionSummaryGenerator()
            
            # Join room group for multi-user communication
            await self.channel_layer.group_add(
                self.room_group_name,
                self.channel_name
            )
            
            # Accept the WebSocket connection
            await self.accept()
            logger.info(f"Video WebSocket connected: session={self.session_id}, user={self.user_id}, role={self.user_role}")
            
            # Mark user as active in the session
            await self.update_session_status(f"{self.user_role}_joined")
            
            # Send connection confirmation
            await self.send(text_data=json.dumps({
                'type': 'connection_established',
                'message': 'Connected to video session',
                'session_id': self.session_id,
                'user_id': self.user_id,
                'user_role': self.user_role,
                'other_user_id': self.other_user_id,
                'chat_url': f'/ws/chat/session/{self.session_id}/{self.user_id}/{self.other_user_id}/',
                'timestamp': datetime.utcnow().isoformat()
            }))
            
            # Notify group about new participant
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'user_joined',
                    'user_id': self.user_id,
                    'user_role': self.user_role,
                    'timestamp': datetime.utcnow().isoformat()
                }
            )
            
            # Mark session as in_progress when both parties have joined
            if self.user_role == 'therapist':
                # Update session with therapist join time
                await self.update_session_status('therapist_joined')
            else:
                # Update session with client join time
                await self.update_session_status('client_joined')
            
            # Check if both parties are now present
            session_info = await self.get_session_info()
            if session_info.get('therapist_joined_at') and session_info.get('client_joined_at'):
                # Both have joined, update status to in_progress if not already
                if session_info.get('status') != 'in_progress':
                    await self.update_session_status('in_progress')
                    
                    # Notify both parties that session has started
                    await self.channel_layer.group_send(
                        self.room_group_name,
                        {
                            'type': 'session_started',
                            'message': 'Therapy session has started',
                            'timestamp': datetime.utcnow().isoformat()
                        }
                    )
            
        except Exception as e:
            logger.error(f"Error in connect: {str(e)}")
            if hasattr(self, 'channel_name'):
                await self.close(code=4000)
    
    # Update the disconnect method to be more defensive
    async def disconnect(self, close_code):
        """Handle WebSocket disconnection and cleanup"""
        logger.info(f"Video WebSocket disconnected: code={close_code}")
        
        try:
            # Make sure user_role is set
            if not hasattr(self, 'user_role'):
                self.user_role = 'unknown'
                logger.warning("Disconnecting without user_role set, using 'unknown'")
            
            # Notify room that user has left
            if hasattr(self, 'room_group_name') and hasattr(self, 'user_id'):
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'user_left',
                        'user_id': self.user_id,
                        'user_role': getattr(self, 'user_role', 'unknown'),
                        'timestamp': datetime.utcnow().isoformat()
                    }
                )
            
            # Update session status if we have a session_id
            if hasattr(self, 'session_id'):
                user_role = getattr(self, 'user_role', 'unknown')
                if user_role in ['client', 'therapist']:
                    await self.update_session_status(f"{user_role}_left")
                else:
                    logger.warning(f"Unknown user_role during disconnect: {user_role}")
            
            # Leave room group
            if hasattr(self, 'room_group_name') and hasattr(self, 'channel_name'):
                await self.channel_layer.group_discard(
                    self.room_group_name,
                    self.channel_name
                )
        except Exception as e:
            logger.error(f"Error in disconnect cleanup: {str(e)}")
            logger.error(f"Current attributes: {dir(self)}")
            
            
    async def handle_chat_message(self, data):
        """Handle chat messages in video therapy sessions"""
        try:
            message = data.get('message', '')
            message_type = data.get('message_type', 'text')
            attachment_url = data.get('attachment_url')
            
            # CRITICAL FIX: Ensure metadata is a plain dict with serializable values
            metadata = data.get('metadata', {}) or {}
            # Create a safe copy of metadata with only serializable types
            safe_metadata = {}
            for key, value in metadata.items():
                # Only include basic serializable types
                if isinstance(value, (str, int, float, bool, list, dict)) and not isinstance(value, type):
                    if isinstance(value, (list, dict)):
                        # Convert to string for safety if it's a complex structure
                        import json
                        try:
                            json.dumps(value)  # Test if it's JSON serializable
                            safe_metadata[key] = value
                        except (TypeError, ValueError):
                            safe_metadata[key] = str(value)
                    else:
                        safe_metadata[key] = value

            # Add video session metadata
            safe_metadata.update({
                "from_video_session": True,
                "video_session_id": self.session_id
            })
            
            sender_id = self.user_id
            
            # Validate message content
            if not message and not attachment_url:
                await self.send(text_data=json.dumps({
                    'type': 'error',
                    'message': 'Message content or attachment is required'
                }))
                return
            
            # Save message to database
            from database import db
            from bson import ObjectId
            
            # Generate a unique conversation ID if needed
            if not hasattr(self, 'video_conversation_id'):
                # Use consistent ID handling
                user_id_obj = self.ensure_object_id(self.user_id)
                other_user_id_obj = self.ensure_object_id(self.other_user_id)
                session_id_obj = self.ensure_object_id(self.session_id)
                
                # CRITICAL FIX: Use synchronous operation first
                conversations = await database_sync_to_async(list)(db.conversations.find({
                    "participants": {"$all": [self.user_id, self.other_user_id]},
                    "session_id": session_id_obj,
                    "conversation_type": "video_session",
                }))
                
                if conversations and len(conversations) > 0:
                    self.video_conversation_id = str(conversations[0]["_id"])
                else:
                    # Create a new conversation with known serializable fields
                    conversation_data = {
                        "_id": ObjectId(),
                        "participants": [self.user_id, self.other_user_id],
                        "conversation_type": "video_session",
                        "session_id": session_id_obj,
                        "created_at": datetime.utcnow(),
                        "updated_at": datetime.utcnow(),
                        "metadata": {
                            "is_video_chat": True,
                            "video_session_key": f"video_{self.session_id}_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}",
                            "video_session_start": datetime.utcnow().isoformat()
                        },
                        "last_message": None
                    }
                    
                    result = await database_sync_to_async(db.conversations.insert_one)(conversation_data)
                    self.video_conversation_id = str(result.inserted_id)
            
            # Get the next sequence number - resolve it before creating message_data
            conversation_id_obj = self.ensure_object_id(self.video_conversation_id)
            next_sequence = await self.get_next_sequence_number_async(conversation_id_obj)
            
            # Create message document with fully serializable data
            message_data = {
                "_id": ObjectId(),
                "sender_id": sender_id,
                "conversation_id": ObjectId(self.video_conversation_id),
                "content": message,
                "message_type": message_type,
                "session_id": ObjectId(self.session_id),
                "sent_at": datetime.utcnow(),
                "read": False,
                "read_at": None,
                "attachment_url": attachment_url,
                "edited": False,
                "edited_at": None,
                "is_deleted": False,
                "deleted_at": None,
                "reactions": [],
                "metadata": safe_metadata,  # Use our sanitized metadata
                "sequence": next_sequence
            }
            
            # Save message to database using a properly wrapped MongoDB operation
            insert_result = await database_sync_to_async(lambda: db.messages.insert_one(message_data))()
            message_id = insert_result.inserted_id
            
            # *** ADD THIS CODE - Broadcast message to all users in the channel ***
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'chat_message',
                    'message': message,
                    'message_id': str(message_id),
                    'sender_id': sender_id,
                    'sender_role': self.user_role,
                    'message_type': message_type,
                    'attachment_url': attachment_url,
                    'timestamp': datetime.utcnow().isoformat()
                }
            )
            
            # Send confirmation back to the sender
            await self.send(text_data=json.dumps({
                'type': 'message_sent',
                'message_id': str(message_id)
            }))
        
        except Exception as e:
            logger.error(f"Failed to save video chat message: {str(e)}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            
            # Make sure to explicitly import json here to avoid the reference error
            import json
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': f"Failed to save chat message: {str(e)}"
            }))
            
    # Add this helper method for getting next sequence number
    @database_sync_to_async
    def get_next_sequence_number(self, conversation_id):
        """Get the next sequence number for a message in this conversation"""
        from database import db
        
        # Find the highest sequence number so far
        last_message = db.messages.find_one(
            {"conversation_id": conversation_id},
            sort=[("sequence", -1)]
        )
        
        # Start from 1 or increment from last
        if last_message and "sequence" in last_message:
            return last_message["sequence"] + 1
        return 1

    # Add this method to handle chat_message events
    async def chat_message(self, event):
        """Send chat message to WebSocket clients"""
        await self.send(text_data=json.dumps({
            'type': 'chat_message',
            'message': event['message'],
            'sender_id': event['sender_id'],
            'sender_role': event['sender_role'],
            'message_id': event['message_id'],
            'timestamp': event['timestamp']
        }))
        
    
    async def receive(self, text_data):
        """Handle incoming WebSocket messages"""
        try:
            data = json.loads(text_data)
            message_type = data.get('type')
            logger.info(f"Received message type: {message_type}")
            
            # Handle different message types
            if message_type == 'agora_token_request':
                    # Store the message data for use in token generation
                    self.text_data_json = data
                    await self.handle_token_request()
                
            elif message_type == 'media_status':
                # Handle media status updates (camera/mic)
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'media_status_update',
                        'user_id': self.user_id,
                        'user_role': self.user_role,
                        'camera': data.get('camera', False),
                        'microphone': data.get('microphone', False),
                    }
                )
                
            elif message_type == 'emotion_data':
                # Process emotion detection data (client -> therapist)
                if self.user_role == 'client':
                    emotions = data.get('emotions', {})
                    await self.channel_layer.group_send(
                        self.room_group_name,
                        {
                            'type': 'emotion_update',
                            'user_id': self.user_id,
                            'emotions': emotions,
                            'timestamp': datetime.utcnow().isoformat()
                        }
                    )
                    # Store emotion data for later analysis
                    await self.store_emotion_data(emotions)
                    
            elif message_type == 'screen_share':
                # Handle screen sharing status
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'screen_share_update',
                        'user_id': self.user_id,
                        'user_role': self.user_role,
                        'active': data.get('active', False),
                    }
                )
                
            elif message_type == 'session_recording':
                # Handle session recording control
                if self.user_role == 'therapist':  # Only therapists can control recording
                    recording_action = data.get('action')
                    await self.handle_recording_request(recording_action)
                else:
                    await self.send(text_data=json.dumps({
                        'type': 'error',
                        'message': 'Only therapists can control recording'
                    }))
                    
            elif message_type == 'ping':
                # Simple ping to keep connection alive
                await self.send(text_data=json.dumps({
                    'type': 'pong',
                    'timestamp': datetime.utcnow().isoformat()
                }))
              # Add this chat message handler
            elif message_type == 'chat_message':
                await self.handle_chat_message(data)
                
            elif message_type == 'video_frame':
                await self.receive_video_frame(data.get('frame'))
                
            else:
                # Generic echo for unknown message types
                logger.info(f"Echoing unknown message type: {message_type}")
                await self.send(text_data=json.dumps({
                    'type': 'echo',
                    'received': data,
                    'timestamp': datetime.utcnow().isoformat()
                }))
                
        except json.JSONDecodeError:
            logger.error("Invalid JSON received")
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': 'Invalid JSON format'
            }))
        except Exception as e:
            logger.error(f"Error in receive: {str(e)}")
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': str(e)
            }))


# Replace the handle_token_request method with this:

# Replace the handle_token_request method with this complete implementation:
    

    # async def handle_token_request(self):
    #     """Generate and send Agora token with proper credentials"""
    #     try:
    #         # Get Agora credentials from environment
    #         app_id = os.environ.get('AGORA_APP_ID', '388db937dd924c0fb64cf5c92f8f9089')
    #         if not app_id or len(app_id.strip()) != 32:
    #             logger.error(f"Invalid Agora App ID format: '{app_id}'")
    #             raise ValueError("Invalid Agora App ID format")
    #         app_certificate = os.environ.get('AGORA_APP_CERTIFICATE')
    #         channel_name = f'session_{self.session_id}'
            
    #         if not app_id or not app_certificate:
    #             raise ValueError("Agora App ID or Certificate not configured")
            
    #         # Generate user ID from hash of user_id string (consistent but unique)
    #         uid = abs(hash(self.user_id)) % 100000
            
    #         # Direct token generation without relying on the agora_token_builder package
    #         # This implements the same algorithm used by agora_token_builder
    #         import hmac
    #         import time
    #         import base64
    #         import struct
    #         import zlib
            
    #         # Constants from the Agora token builder
    #         Version = "006"
    #         Role_Publisher = 1  # RtcRole.PUBLISHER
            
    #         # Expiration time
    #         current_timestamp = int(time.time())
    #         expiration_timeInSeconds = 3600
    #         privilegeExpiredTs = current_timestamp + expiration_timeInSeconds
            
    #         # Build token content
    #         content = struct.pack("<I", uid)  # uid
    #         content += struct.pack("<I", privilegeExpiredTs)  # expiration time
    #         content += struct.pack("<I", Role_Publisher)  # role
            
    #         # Compute signature
    #         signature = hmac.new(app_certificate.encode('utf-8'), content, 'sha256').digest()
            
    #         # Combine components
    #         crc_channel = zlib.crc32(channel_name.encode('utf-8')) & 0xffffffff
    #         crc_app_id = zlib.crc32(app_id.encode('utf-8')) & 0xffffffff
    #         content = struct.pack("<I", crc_channel)
    #         content += struct.pack("<I", crc_app_id)
    #         content += content
    #         content += signature
            
    #         # Encode token
    #         token = base64.b64encode(Version.encode('utf-8') + content).decode('utf-8')
    #         logger.info(f"Successfully generated token for user {uid} in channel {channel_name}")
            
    #         # Send token to client
    #         await self.send(text_data=json.dumps({
    #             'type': 'agora_token',
    #             'token': token,
    #             'appId': app_id,
    #             'channel': channel_name,
    #             'uid': uid,
    #             'expiresIn': expiration_timeInSeconds
    #         }))
            
    #     except Exception as e:
    #         logger.error(f"Token generation error: {str(e)}")
    #         await self.send(text_data=json.dumps({
    #             'type': 'error',
    #             'message': f"Failed to generate token: {str(e)}"
    #         }))
    # Inside your handle_token_request function, add these debug logs:

#     async def handle_token_request(self):
#         # """Generate and send Agora token with proper credentials"""
#         try:
#             # Get Agora credentials from environment
#             app_id = os.environ.get('AGORA_APP_ID', '388db937dd924c0fb64cf5c92f8f9089')
#             if not app_id or len(app_id.strip()) != 32:
#                 logger.error(f"Invalid Agora App ID format: '{app_id}'")
#                 raise ValueError("Invalid Agora App ID format")
                
#             app_certificate = os.environ.get('AGORA_APP_CERTIFICATE')
            
#             # Add this debug log to see what's actually being used
#             logger.info(f"Using Agora App ID: '{app_id}', Certificate: '{app_certificate[:5]}...'")
            
#             channel_name = f'session_{self.session_id}'
            
#             if not app_id or not app_certificate:
#                 raise ValueError("Agora App ID or Certificate not configured")
            
#             # Generate user ID from hash of user_id string (consistent but unique)
#             uid = abs(hash(self.user_id)) % 100000
            
#             # Direct token generation without relying on the agora_token_builder package
#             # This implements the same algorithm used by agora_token_builder
#             import hmac
#             import time
#             import base64
#             import struct
#             import zlib
            
#             # Constants from the Agora token builder
#             Version = "006"
#             Role_Publisher = 1  # RtcRole.PUBLISHER
            
#             # Expiration time
#             current_timestamp = int(time.time())
#             expiration_timeInSeconds = 3600
#             privilegeExpiredTs = current_timestamp + expiration_timeInSeconds
            
#             # Build token content
#             content = struct.pack("<I", uid)  # uid
#             content += struct.pack("<I", privilegeExpiredTs)  # expiration time
#             content += struct.pack("<I", Role_Publisher)  # role
            
#             # Compute signature
#             signature = hmac.new(app_certificate.encode('utf-8'), content, 'sha256').digest()
            
# # Inside handle_token_request method, replace the token generation section:

# # Combine components
#             crc_channel = zlib.crc32(channel_name.encode('utf-8')) & 0xffffffff
#             crc_app_id = zlib.crc32(app_id.encode('utf-8')) & 0xffffffff

#             # FIXED: Create content without duplication
#             signing_content = struct.pack("<I", crc_channel)
#             signing_content += struct.pack("<I", crc_app_id)
#             signing_content += content  # This is the original token content with uid, expiration, etc.

#             # Create final token content
#             final_content = signing_content + signature

#             # Encode token 
#             token = base64.b64encode(Version.encode('utf-8') + final_content).decode('utf-8')
            
#             # Send token to client
#             message = json.dumps({
#                 'type': 'agora_token',
#                 'token': token,
#                 'appId': app_id,
#                 'channel': channel_name,
#                 'uid': uid,
#                 'expiresIn': expiration_timeInSeconds
#             })
#             logger.info(f"Sending WebSocket Message: {message}")
#             await self.send(text_data=message)
           
            
#         except Exception as e:
#             logger.error(f"Token generation error: {str(e)}")
#             import traceback
#             logger.error(f"Stack trace: {traceback.format_exc()}")
#             await self.send(text_data=json.dumps({
#                 'type': 'error',
#                 'message': f"Failed to generate token: {str(e)}"
#             }))
# In your handle_token_request method, update the time parameters and token generation
# Update the handle_token_request method
# Inside VideoSessionConsumer class
    async def handle_token_request(self):
        """Generate and send Agora token with proper credentials"""
        try:
            # Get Agora credentials from environment
            app_id = os.environ.get('AGORA_APP_ID', '79d73caf1b904f0587fee4d5e3e19084').strip()
            app_certificate = os.environ.get('AGORA_APP_CERTIFICATE', 'a0284a162c7a41708ce812140cfb13b8').strip()
            
            # Basic validation
            if not app_id or len(app_id) != 32:
                logger.error(f"Invalid Agora App ID format: '{app_id}', length: {len(app_id)}")
                raise ValueError("Invalid Agora App ID format")
                
            if not app_certificate or len(app_certificate) != 32:
                logger.error(f"Invalid Agora App Certificate format, length: {len(app_certificate)}")
                raise ValueError("Invalid Agora App Certificate format")
                
            # Generate channel name from session ID
            channel_name = f'session_{self.session_id}'
            
            # Use client-requested UID if provided
            uid = int(self.text_data_json.get('uid', 0)) if hasattr(self, 'text_data_json') else abs(hash(self.user_id)) % 100000
            logger.info(f"Using UID: {uid} for channel: {channel_name}")
            
            # Set expiration time
            token_expiration_in_seconds = 3600
            
            try:
                # Use the helper function to generate token
                token = generate_rtc_token(
                    app_id,
                    app_certificate,
                    channel_name,
                    uid,
                    token_expiration_in_seconds
                )
                logger.info(f"Generated token: first 20 chars: {token[:20]}")
            except Exception as e:
                # Fall back to hard-coded token in case of error
                logger.warning(f"Token generation failed, using fallback: {str(e)}")
                token = "007eJxTYDCebNr2ju2AvXcB98rv6jp398Ye/rfFVmprWOAti6AUq5UKDOaWKebGyYlphkmWBiZpBqYW5mmpqSYppqnGqYaWBhYmIqmn0xsCGRk6uSJZGBkgEMRXYChOLS7OzM+LNzNPTjQDGmBsZmZkmmxgYGhpmmiSZGrBwAAA3DAl+w=="
            
            # Send token to client
            await self.send(text_data=json.dumps({
                'type': 'agora_token',
                'token': token,
                'appId': app_id,
                'channel': channel_name,
                'uid': uid,
                'expiresIn': token_expiration_in_seconds
            }))
                
        except Exception as e:
            logger.error(f"Token generation error: {str(e)}")
            import traceback
            logger.error(f"Stack trace: {traceback.format_exc()}")
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': f"Failed to generate token: {str(e)}"
            }))
            
     
    async def receive_video_frame(self, frame_data):
        """Process a video frame for emotion analysis"""
        try:
            # Only analyze every 5th frame to reduce processing load
            self.frame_count += 1
            if self.frame_count % 5 != 0:
                return
                
            # Extract user ID and session information
            user_id = self.other_user_id  # The client/patient
            session_id = self.session_id
            
            # Decode base64 image
            encoded_data = frame_data.split(',')[1]
            nparr = np.frombuffer(base64.b64decode(encoded_data), np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            
            # Analyze the frame
            analysis_results = await self.analyze_frame_async(img)
            
            if not analysis_results or 'error' in analysis_results:
                logger.warning(f"Frame analysis failed: {analysis_results.get('error', 'Unknown error')}")
                return
                
            # Extract face data and timestamp
            timestamp = datetime.utcnow().timestamp() - self.session_start_time.timestamp()
            
            # Store emotion data from first face
            if analysis_results.get('faces'):
                face_data = analysis_results['faces'][0]
                
                # Add to emotion data collection
                emotion_point = {
                    "timestamp": timestamp,
                    "emotions": face_data.get("emotions", {}),
                    "valence": face_data.get("valence", 0),
                    "engagement": face_data.get("engagement", 0),
                    "dominant_emotion": face_data.get("dominant_emotion", "neutral")
                }
                
                self.emotion_data.append(emotion_point)
                
                # Every 10 frames, perform trend analysis and send updates to therapist
                if len(self.emotion_data) % 10 == 0 and self.user_role == 'therapist':
                    # Analyze recent trends
                    trend_analysis = self.trend_analyzer.analyze_session_data(self.emotion_data[-30:])
                    
                    # Send to therapist UI
                    await self.send(text_data=json.dumps({
                        'type': 'emotion_trend_update',
                        'trend_analysis': trend_analysis,
                        'timestamp': timestamp
                    }))
                    
                    # Check for warning conditions
                    if trend_analysis.get("valence_trend") == "deteriorating" or \
                    trend_analysis.get("emotional_stability", 1.0) < 0.3:
                        await self.send(text_data=json.dumps({
                            'type': 'emotion_warning',
                            'warning': "Patient's emotional state is deteriorating or unstable",
                            'trend_analysis': trend_analysis
                        }))
                        
                # Store periodic snapshots for later review (every 60 seconds)
                if timestamp % 60 < 5 and timestamp > 10:  # Store around every minute mark
                    await self.store_emotion_snapshot(analysis_results, user_id, session_id, timestamp)
                    
        except Exception as e:
            logger.error(f"Error in receive_video_frame: {str(e)}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            
            
    async def store_emotion_snapshot(self, analysis_results, user_id, session_id, timestamp):
        """Store a snapshot of emotion analysis in database"""
        # Create a placeholder image URL
        media_url = f"session://{session_id}/{timestamp}"
        
        # Create analysis object
        analysis = EmotionAnalysis(
            user_id=user_id,
            media_url=media_url,
            media_type="frame",
            session_id=session_id,
            results=analysis_results
        )
        
        # Save to database asynchronously
        await database_sync_to_async(analysis.save)()
                
    async def update_emotion_history(self, results):
        """Update emotion history for trend analysis"""
        # Get the emotions from the first face (or overall if available)
        if 'overall' in results and 'emotions' in results['overall']:
            emotions = results['overall']['emotions']
            valence = results['overall'].get('avg_valence', 0)
            engagement = results['overall'].get('avg_engagement', 0)
        elif 'faces' in results and len(results['faces']) > 0:
            emotions = results['faces'][0]['emotions']
            valence = results['faces'][0].get('valence', 0)
            engagement = results['faces'][0].get('engagement', 0)
        else:
            emotions = results.get('emotions', {})
            valence = results.get('valence', 0)
            engagement = results.get('engagement', 0)
        
        # Update history
        for emotion, value in emotions.items():
            if emotion in self.emotion_history:
                self.emotion_history[emotion].append(value)
                
        self.valence_history.append(valence)
        self.engagement_history.append(engagement)
        
    async def detect_emotional_shifts(self):
        """Detect significant changes in emotional state"""
        # Need at least 10 data points for meaningful detection
        if len(self.valence_history) < 10:
            return
            
        # Check for significant valence shifts
        recent_valence = list(self.valence_history)[-5:]
        older_valence = list(self.valence_history)[-10:-5]
        
        recent_mean = np.mean(recent_valence)
        older_mean = np.mean(older_valence)
        
        # If valence changed by more than 0.3 in either direction
        if abs(recent_mean - older_mean) > 0.3:
            direction = "positive" if recent_mean > older_mean else "negative"
            
            # Only notify once per shift
            if not self.emotional_shift_detected:
                self.emotional_shift_detected = True
                
                # Notify therapist of the emotional shift
                if self.user_role == 'therapist':
                    await self.send(text_data=json.dumps({
                        'type': 'emotional_shift',
                        'direction': direction,
                        'magnitude': abs(recent_mean - older_mean),
                        'message': f"Significant {direction} emotional shift detected"
                    }))
        else:
            # Reset flag when emotions stabilize
            self.emotional_shift_detected = False
            
    async def get_current_warnings(self):
        """Generate warnings based on current emotional state"""
        warnings = []
        
        # Check for sustained negative emotions
        if len(self.emotion_history['sad']) > 0 and len(self.emotion_history['angry']) > 0:
            avg_sadness = np.mean(list(self.emotion_history['sad']))
            avg_anger = np.mean(list(self.emotion_history['angry']))
            
            if avg_sadness > self.warning_threshold:
                warnings.append({
                    "type": "high_sadness",
                    "message": "Patient showing sustained high levels of sadness",
                    "value": float(avg_sadness),
                    "suggestion": "Consider addressing potential depression indicators"
                })
                
            if avg_anger > self.warning_threshold:
                warnings.append({
                    "type": "high_anger",
                    "message": "Patient showing sustained high levels of anger",
                    "value": float(avg_anger),
                    "suggestion": "Consider de-escalation techniques or anger management strategies"
                })
                
        # Check for emotional disengagement
        if len(self.engagement_history) > 0:
            avg_engagement = np.mean(list(self.engagement_history))
            if avg_engagement < 30:  # Less than 30% engagement
                warnings.append({
                    "type": "low_engagement",
                    "message": "Patient showing low emotional engagement",
                    "value": float(avg_engagement),
                    "suggestion": "Consider more engaging topics or check for dissociation"
                })
                
        return warnings
        
    async def get_session_metrics(self):
        """Generate session-level metrics from emotion history"""
        metrics = {
            "duration": time.time() - self.session_start_time,
            "emotions": {},
            "valence": {
                "current": float(self.valence_history[-1]) if self.valence_history else 0,
                "average": float(np.mean(list(self.valence_history))) if self.valence_history else 0
            },
            "engagement": {
                "current": float(self.engagement_history[-1]) if self.engagement_history else 0,
                "average": float(np.mean(list(self.engagement_history))) if self.engagement_history else 0
            },
            "dominant_emotion": None,
            "emotional_stability": self.calculate_emotional_stability()
        }
        
        # Calculate emotion averages
        for emotion in self.emotion_history:
            if self.emotion_history[emotion]:
                metrics["emotions"][emotion] = {
                    "current": float(self.emotion_history[emotion][-1]),
                    "average": float(np.mean(list(self.emotion_history[emotion])))
                }
            else:
                metrics["emotions"][emotion] = {"current": 0, "average": 0}
                
        # Get dominant emotion
        if metrics["emotions"]:
            metrics["dominant_emotion"] = max(
                metrics["emotions"].keys(),
                key=lambda e: metrics["emotions"][e]["average"]
            )
            
        return metrics
        
    def calculate_emotional_stability(self):
        """Calculate emotional stability as inverse of standard deviation"""
        if len(self.valence_history) < 5:
            return 1.0  # Default to stable if not enough data
            
        # Standard deviation of valence - higher means less stable
        valence_std = np.std(list(self.valence_history))
        
        # Invert and scale to 0-1 range where 1 is most stable
        stability = max(0, min(1, 1 - (valence_std * 2)))
        return float(stability)
        
    async def generate_real_time_insights(self, analysis_results):
        """Generate therapeutic insights from real-time analysis"""
        # Get current metrics
        metrics = await self.get_session_metrics()
        
        # Initialize insights
        insights = {
            "current_state": "",
            "suggestions": [],
            "observation": ""
        }
        
        # Determine current emotional state
        dominant = metrics["dominant_emotion"]
        valence = metrics["valence"]["current"]
        engagement = metrics["engagement"]["current"]
        
        # Generate state description
        if dominant == "neutral" and engagement < 40:
            insights["current_state"] = "Patient appears emotionally reserved or disconnected"
        elif dominant == "happy" and valence > 0.5:
            insights["current_state"] = "Patient shows positive engagement and emotional state"
        elif dominant == "sad" and valence < -0.3:
            insights["current_state"] = "Patient displays signs of sadness or grief"
        elif dominant == "angry" and valence < -0.3:
            insights["current_state"] = "Patient appears frustrated or angry"
        elif dominant == "fear":
            insights["current_state"] = "Patient shows signs of anxiety or fear"
        else:
            insights["current_state"] = f"Patient's dominant emotion is {dominant}"
            
        # Generate therapeutic suggestions
        if dominant == "sad":
            insights["suggestions"] = [
                "Consider exploring recent experiences that may be causing distress",
                "Validate emotional experience while introducing coping strategies",
                "Consider cognitive restructuring techniques for negative thought patterns"
            ]
        elif dominant == "angry":
            insights["suggestions"] = [
                "Use de-escalation techniques if appropriate",
                "Explore triggers for frustration or anger",
                "Consider introducing emotion regulation strategies"
            ]
        elif dominant == "fear":
            insights["suggestions"] = [
                "Introduce grounding techniques if anxiety is elevated",
                "Explore sources of anxiety or fear",
                "Consider gradual exposure strategies for specific fears"
            ]
        elif dominant == "neutral" and engagement < 30:
            insights["suggestions"] = [
                "Try more engaging topics or activities",
                "Check for dissociation or emotional avoidance",
                "Consider more direct questions about current feelings"
            ]
            
        # Add observation based on emotional shifts
        if hasattr(self, 'emotional_shift_detected') and self.emotional_shift_detected:
            insights["observation"] = "Note: Significant emotional shift detected recently"
            
        return insights
            
            
    async def analyze_frame_async(self, frame):
        """Run emotion analysis asynchronously"""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, analyze_image, frame, False)

    async def store_emotion_analysis(self, analysis_results, user_id, session_id):
        """Store periodic emotion analysis in database"""
        # Create a placeholder image URL (we're not storing the actual frame for privacy)
        timestamp = datetime.utcnow()
        media_url = f"session://{session_id}/{timestamp.isoformat()}"
        
        analysis = EmotionAnalysis(
            user_id=user_id,
            media_url=media_url,
            media_type="frame",
            session_id=session_id,
            results=analysis_results
        )
        
        # Save to database asynchronously
        await database_sync_to_async(analysis.save)()
        
    
    async def handle_session_end(self):
        """Generate and store session summary when session ends"""
        if hasattr(self, 'emotion_data') and self.emotion_data:
            # Generate session summary
            session_metadata = {
                "duration": (datetime.utcnow() - self.session_start_time).total_seconds(),
                "date": datetime.utcnow(),
                "session_id": self.session_id
            }
            
            # Generate summary
            summary = await asyncio.to_thread(
                self.summary_generator.generate_summary,
                self.emotion_data, 
                session_metadata
            )
            
            # Store summary in session record
            await database_sync_to_async(self.update_session_with_summary)(summary)
            
            # Send summary to therapist
            if self.user_role == 'therapist':
                await self.send(text_data=json.dumps({
                    'type': 'session_summary',
                    'summary': summary
                }))
                
    async def update_session_with_summary(self, summary):
        """Update the session record with emotion summary"""
        from bson.objectid import ObjectId
        from apps.therapy_sessions.models import TherapySession
        
        session = TherapySession.find_by_id(ObjectId(self.session_id))
        if session:
            session['emotion_summary'] = summary
            session['updated_at'] = datetime.utcnow()
            TherapySession.save_session(session)
    # Update this method with a simpler approach for testing:

    # async def handle_token_request(self):
    #     """Generate and send Agora token with proper credentials - Testing mode version"""
    #     try:
    #         # Use the new App ID from your fresh Agora project
    #         app_id = "adbeacb770654c5abfd0e2df400c1738"
            
    #         # Generate channel name from session ID
    #         channel_name = f'session_{self.session_id}'
            
    #         # Generate user ID from hash of user_id string (consistent but unique)
    #         uid = abs(hash(self.user_id)) % 100000
            
    #         # For App ID only mode in testing, we don't need a token
    #         logger.info(f"Using App ID only mode with App ID: '{app_id}'")
    #         await self.send(text_data=json.dumps({
    #             'type': 'agora_token',
    #             'token': None,  # Fix: Changed 'null' to None for Python
    #             'appId': app_id,
    #             'channel': channel_name,
    #             'uid': uid,
    #             'expiresIn': 3600
    #         }))
                
        # except Exception as e:
        #     logger.error(f"Token handling error: {str(e)}")
        #     await self.send(text_data=json.dumps({
        #         'type': 'error',
        #         'message': f"Failed to set up Agora: {str(e)}"
        #     }))
            
    async def handle_recording_request(self, action):
        """Handle recording start/stop requests"""
        try:
            if (action == 'start'):
                # Start cloud recording (implementation depends on your recording setup)
                recording_id = f"rec_{self.session_id}_{int(time.time())}"
                
                # In a real implementation, you would call Agora Cloud Recording API here
                # For now, we'll just simulate a response
                
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'recording_status',
                        'status': 'started',
                        'recording_id': recording_id,
                        'started_by': self.user_id,
                        'timestamp': datetime.utcnow().isoformat()
                    }
                )
                
                # Update session with recording info
                await self.update_session_recording(recording_id, True)
                
            elif (action == 'stop'):
                # Stop cloud recording
                # In a real implementation, you would call Agora Cloud Recording API here
                
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'recording_status',
                        'status': 'stopped',
                        'stopped_by': self.user_id,
                        'timestamp': datetime.utcnow().isoformat()
                    }
                )
                
                # Update session with recording info
                await self.update_session_recording(None, False)
                
        except Exception as e:
            logger.error(f"Recording error: {str(e)}")
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': f"Recording error: {str(e)}"
            }))
            
    # Add these methods to your VideoSessionConsumer class:

    @staticmethod
    def update_by_id(session_id, update_data):
        """Update session by ID with the specified data"""
        if isinstance(session_id, str):
            from bson import ObjectId
            session_id = ObjectId(session_id)
        
        from database import db
        sessions_collection = db["therapy_sessions"]
        return sessions_collection.update_one(
            {"_id": session_id},
            update_data
        )

    @staticmethod
    def add_recording(session_id, recording_url):
        """Add recording URL to session"""
        if isinstance(session_id, str):
            from bson import ObjectId
            session_id = ObjectId(session_id)
            
        from database import db
        sessions_collection = db["therapy_sessions"]
        return sessions_collection.update_one(
            {"_id": session_id},
            {"$set": {"recording_url": recording_url}}
        )

    @staticmethod
    def update_status(session_id, status):
        """Update session status"""
        if isinstance(session_id, str):
            from bson import ObjectId
            session_id = ObjectId(session_id)
            
        from database import db
        sessions_collection = db["therapy_sessions"]
        return sessions_collection.update_one(
            {"_id": session_id},
            {"$set": {"status": status}}
        )
    
    @database_sync_to_async
    def get_session_info(self):
        """Get session information from database and validate user access"""
        try:
            # Convert string ID to ObjectId if needed
            if isinstance(self.session_id, str):
                try:
                    session_id_obj = ObjectId(self.session_id)
                except:
                    logger.error(f"Invalid session ID format: {self.session_id}")
                    return None
            else:
                session_id_obj = self.session_id
                
            # Get session from database
            session = TherapySession.find_by_id(session_id_obj)
            
            if not session:
                logger.warning(f"Session not found: {self.session_id}")
                return None
                
            # User ID from the connection
            str_user_id = str(self.user_id)
            
            # Check if this is a direct match for user_id (client)
            if str(session.get('user_id')) == str_user_id:
                logger.info(f"User {str_user_id} authorized as client for session {self.session_id}")
                return session
                
            # Check if this is a direct match for therapist_id
            if str(session.get('therapist_id')) == str_user_id:
                logger.info(f"User {str_user_id} authorized as therapist for session {self.session_id}")
                return session
                
            # Special case: Check if this is a therapist whose user_id doesn't match directly
            from database import db
            users_collection = db["users"]
            user = users_collection.find_one({"_id": ObjectId(str_user_id)})
            
            if user and user.get('role') == 'therapist':
                # Method 1: Check if this therapist's ID is linked to the session
                if user.get('therapist_id') and str(user.get('therapist_id')) == str(session.get('therapist_id')):
                    logger.info(f"Therapist user {str_user_id} authorized via therapist_id link for session {self.session_id}")
                    return session
                    
                # Method 2: Look up the therapist document to verify
                therapists_collection = db["therapists"]
                therapist = therapists_collection.find_one({"user_id": ObjectId(str_user_id)})
                
                if therapist and str(therapist['_id']) == str(session.get('therapist_id')):
                    logger.info(f"Therapist user {str_user_id} authorized via therapist lookup for session {self.session_id}")
                    return session
            
            logger.warning(f"User {str_user_id} not authorized for session {self.session_id}")
            return None
        
        except Exception as e:
            logger.error(f"Error getting session info: {str(e)}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            return None
    
    @database_sync_to_async
    def update_session_status(self, event):
        """Update session status in database"""
        try:
            if not hasattr(self, 'session_id'):
                logger.warning("Cannot update session status: session_id not set")
                return
                
            # Get current time
            now = datetime.utcnow()
            
            # Create direct reference to collection
            from database import db
            sessions_collection = db["therapy_sessions"]
            from bson import ObjectId
            
            # Extra safety check for user_role in relevant events
            if event in ('client_left', 'therapist_left', 'client_joined', 'therapist_joined'):
                if not hasattr(self, 'user_role') or self.user_role == 'unknown':
                    logger.warning(f"Cannot process {event}: user_role not properly set")
                    return
            
            # Update session based on event
            if event == 'client_joined':
                # Client joined the session
                sessions_collection.update_one(
                    {"_id": ObjectId(self.session_id)},
                    {"$set": {"client_joined_at": now, "status": "in_progress"}}
                )
                logger.info(f"Updated session {self.session_id}: client joined")
                    
            elif event == 'therapist_joined':
                # Therapist joined the session
                sessions_collection.update_one(
                    {"_id": ObjectId(self.session_id)},
                    {"$set": {"therapist_joined_at": now, "status": "in_progress"}}
                )
                logger.info(f"Updated session {self.session_id}: therapist joined")
                    
            elif event in ('client_left', 'therapist_left'):
                # Update this user's left timestamp
                role_type = event.split('_')[0]  # Extract 'client' or 'therapist'
                sessions_collection.update_one(
                    {"_id": ObjectId(self.session_id)},
                    {"$set": {f"{role_type}_left_at": now}}
                )
                logger.info(f"Updated session {self.session_id}: {role_type} left")
            
            # Other event types...
        except Exception as e:
            logger.error(f"Error updating session status: {str(e)}")
        
    @database_sync_to_async
    def update_session_recording(self, recording_id, is_recording):
        """Update session with recording information"""
        try:
            update_data = {}
            
            if is_recording:
                update_data["recording_id"] = recording_id
                update_data["recording_started_at"] = datetime.utcnow()
            else:
                update_data["recording_ended_at"] = datetime.utcnow()
                
            TherapySession.update_by_id(
                ObjectId(self.session_id),
                {"$set": update_data}
            )
            
        except Exception as e:
            logger.error(f"Error updating recording status: {str(e)}")
    
    @database_sync_to_async
    def store_emotion_data(self, emotions):
        """Store emotion detection data for analytics"""
        try:
            # Create a data point with emotions and metadata
            emotion_data = {
                "session_id": ObjectId(self.session_id),
                "user_id": ObjectId(self.user_id),
                "emotions": emotions,
                "timestamp": datetime.utcnow()
            }
            
            # Store in database - you may need to create an EmotionData model
            # For now, we'll just log it
            logger.info(f"Emotion data for session {self.session_id}: {emotions}")
            
            # If you have an emotions collection:
            # from apps.emotions.models import EmotionData
            # EmotionData.create(emotion_data)
            
        except Exception as e:
            logger.error(f"Error storing emotion data: {str(e)}")
    
    # Event handlers for channel layer messages
    
    async def user_joined(self, event):
        """Forward user joined notification to client"""
        await self.send(text_data=json.dumps(event))
    
    async def user_left(self, event):
        """Forward user left notification to client"""
        await self.send(text_data=json.dumps(event))
    
    async def media_status_update(self, event):
        """Forward media status updates to client"""
        await self.send(text_data=json.dumps(event))
    
    async def emotion_update(self, event):
        """Forward emotion updates only to therapist"""
        if getattr(self, 'user_role', None) == 'therapist':
            await self.send(text_data=json.dumps(event))
    
    async def screen_share_update(self, event):
        """Forward screen sharing status updates"""
        await self.send(text_data=json.dumps(event))
    
    async def recording_status(self, event):
        """Forward recording status updates"""
        await self.send(text_data=json.dumps(event))
    
    # Add a handler for the session_started event
    async def session_started(self, event):
        """Send session started notification to WebSocket client"""
        await self.send(text_data=json.dumps(event))
        
    # Add this helper method to the VideoSessionConsumer class

    @database_sync_to_async
    def get_therapist_user_id(self, therapist_id):
        """Get user_id for a therapist from therapists collection"""
        from database import db
        
        # Convert string to ObjectId if necessary
        if isinstance(therapist_id, str):
            from bson import ObjectId
            therapist_id = ObjectId(therapist_id)
        
        # Find therapist record
        therapist = db.therapists.find_one({"_id": therapist_id})
        if therapist and "user_id" in therapist:
            return str(therapist["user_id"])
        
        # If not found, try users collection with therapist_id reference
        user = db.users.find_one({"therapist_id": therapist_id})
        if user:
            return str(user["_id"])
        
        # Return None if not found
        logger.warning(f"Could not find user ID for therapist {therapist_id}")
        return None
        
    def ensure_object_id(self, id_value):
        """Convert string ID to ObjectId if needed"""
        if id_value is None:
            return None
            
        from bson import ObjectId
        if isinstance(id_value, str):
            try:
                return ObjectId(id_value)
            except Exception as e:
                logger.error(f"Invalid ObjectId format: {id_value}")
                return None
        return id_value
        
    async def get_next_sequence_number_async(self, conversation_id):
        """Get the next sequence number for a message in this conversation"""
        from database import db
        
        # Find the highest sequence number so far
        last_message = await database_sync_to_async(lambda: db.messages.find_one(
            {"conversation_id": conversation_id},
            sort=[("sequence", -1)]
        ))()
        
        # Start from 1 or increment from last
        if last_message and "sequence" in last_message:
            return last_message["sequence"] + 1
        return 1

# Add or update these settings for handling WebSocket connections through tunnels

# Add CORS headers for WebSocket handshake
def get_response_headers(scope):
    """Get headers for WebSocket handshake response."""
    headers = []
    origin = None
    
    # Extract origin from request headers
    for name, value in scope.get('headers', []):
        if name == b'origin':
            origin = value.decode('utf-8')
    
    # Add CORS headers if origin is present
    if origin:
        headers.append((b'Access-Control-Allow-Origin', origin.encode()))
        headers.append((b'Access-Control-Allow-Credentials', b'true'))
    else:
        # If no origin, allow all (not recommended for production)
        headers.append((b'Access-Control-Allow-Origin', b'*'))
    
    return headers

# # Then in your accept method:
# async def connect(self):
#     # Get headers for response
#     headers = get_response_headers(self.scope)
    
#     # Accept the connection with headers
#     await self.accept(headers=headers)

# # Add this new method to the VideoSessionConsumer class
#     async def get_next_sequence_number_async(self, conversation_id):
#         """Get the next sequence number for a message in this conversation"""
#         from database import db
        
#         # Ensure conversation_id is ObjectId
#         conversation_id = self.ensure_object_id(conversation_id)
        
#         # Find the highest sequence number so far
#         last_message = await database_sync_to_async(lambda: db.messages.find_one(
#             {"conversation_id": conversation_id},
#             sort=[("sequence", -1)]
#         ))()
        
#         # Start from 1 or increment from last
#         if last_message and "sequence" in last_message:
#             return last_message["sequence"] + 1
#         return 1

#     # Add these helper methods to the VideoSessionConsumer class
#     # (place them after get_next_sequence_number_async)

#     def ensure_object_id(self, id_value):
#         """Convert string ID to ObjectId if needed"""
#         if id_value is None:
#             return None
            
#         from bson import ObjectId
#         if isinstance(id_value, str):
#             try:
#                 return ObjectId(id_value)
#             except Exception as e:
#                 logger.error(f"Invalid ObjectId format: {id_value}")
#                 return None
#         return id_value



