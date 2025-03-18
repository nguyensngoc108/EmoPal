import json
import asyncio
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from datetime import datetime
import sys
import os
from bson import ObjectId
import logging
import traceback
from database import db  # Import MongoDB connection

# Import models
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../../")))
from apps.chat_messages.models import Message, Conversation
from apps.users.models import User
from apps.therapy_sessions.models import TherapySession
from apps.ai_services.help_assistant import HelpAssistant
import uuid

logger = logging.getLogger(__name__)

class ChatConsumer(AsyncWebsocketConsumer):
    """
    Enhanced WebSocket consumer for handling real-time chat functionality
    Features:
    - Message sending and receiving
    - Typing indicators
    - Message history loading
    - Read receipts
    - Online status indicators
    - Support for both consultation and session chats
    """
    
# Update connect method to use URL parameters directly

    async def connect(self):
        """Handle WebSocket connection and setup initial state"""
        # Get user ID from URL parameters, which is more reliable than auth
        self.user_id = self.scope['url_route']['kwargs'].get('user_id')
        
        # Initialize room_group_name early to avoid the disconnect issue
        self.room_group_name = None
        
        if not self.user_id:
            print("WebSocket rejected - no user ID in URL")
            await self.close(code=4002)
            return
        
        # Try to get user from scope (auth middleware)
        self.user = self.scope.get("user")
        
        # If no authenticated user but we have user_id in URL, try to get user from database
        if not self.user and self.user_id:
            try:
                self.user = await self.get_user_by_id(self.user_id)
            except Exception as e:
                print(f"Error getting user: {str(e)}")
        
        # If we still don't have a valid user, reject
        if not self.user:
            print("WebSocket rejected - unable to authenticate user")
            await self.close(code=4001)
            return
        
        # Extract user IDs from URL route
        self.other_user_id = self.scope['url_route']['kwargs']['other_user_id']
        
        # Get session ID from URL parameters if present (for session chats)
        self.session_id = self.scope['url_route']['kwargs'].get('session_id')
    
    # Rest of connect method...
        
        # Determine conversation type based on presence of session_id
        # IMPORTANT: Use "therapy_session" to match your existing data
        self.conversation_type = "therapy_session" if self.session_id else "consultation"
        
        # Create a room name based on conversation participants
        users = sorted([self.user_id, self.other_user_id])
        base_room_name = f"chat_{users[0]}_{users[1]}"
        
        if self.conversation_type == "session":
            # For session chats, include session_id in room name
            self.room_name = f"{base_room_name}_session_{self.session_id}"
        else:
            # For consultation chats
            self.room_name = base_room_name
        
        # Set the room group name
        self.room_group_name = f"chat_{self.room_name}"
        
        # Get or create conversation
        self.conversation_id = await self.get_or_create_conversation()
        if not self.conversation_id:
            # Failed to create/retrieve conversation
            await self.close(code=4001)
            return
            
        # Store user info for presence tracking
        self.user_info = await self.get_user_info(self.user_id)
        self.other_user_info = await self.get_user_info(self.other_user_id)
        
        # Join room group
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        
        # Add user to presence group
        await self.channel_layer.group_add(
            f"presence_{self.user_id}",
            self.channel_name
        )
        
        # Accept the WebSocket connection
        await self.accept()
        
        # Send connection acknowledgment
        await self.send(text_data=json.dumps({
            'type': 'connection_established',
            'message': 'Connected to chat',
            'user_id': self.user_id,
            'other_user_id': self.other_user_id,
            'conversation_id': str(self.conversation_id),
            'conversation_type': self.conversation_type,
            'session_id': self.session_id,
            'timestamp': datetime.utcnow().isoformat(),
            'recipient_info': self.other_user_info  # Include full recipient info
        }))
        
        # Send presence status to room
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'user_online',
                'user_id': self.user_id,
                'status': 'online',
                'timestamp': datetime.utcnow().isoformat()
            }
        )
        
        # Load message history
        await self.send_message_history()
        
        # Check if other user is online
        other_user_status = await self.get_user_status(self.other_user_id)
        await self.send(text_data=json.dumps({
            'type': 'user_status',
            'user_id': self.other_user_id,
            'status': other_user_status,
            'timestamp': datetime.utcnow().isoformat()
        }))
        
        logger.info(f"Chat WebSocket connected: user={self.user_id}, conversation_type={self.conversation_type}")
    
    async def disconnect(self, close_code):
        """Handle WebSocket disconnection and cleanup"""
        try:
            # Initialize these attributes if they were never set
            if not hasattr(self, 'room_group_name'):
                print(f"Disconnect called before room_group_name was set, code: {close_code}")
                return
                
            # Send offline status to room
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'user_offline',
                    'user_id': getattr(self, 'user_id', 'unknown'),
                    'status': 'offline',
                    'timestamp': datetime.utcnow().isoformat()
                }
            )
            
            # Leave room group - with safety checks
            if hasattr(self, 'room_group_name') and self.room_group_name:
                await self.channel_layer.group_discard(
                    self.room_group_name,
                    self.channel_name
                )
            
            # Leave presence group - with safety checks
            if hasattr(self, 'user_id') and self.user_id:
                await self.channel_layer.group_discard(
                    f"presence_{self.user_id}",
                    self.channel_name
                )
            
            # Update last seen timestamp
            if hasattr(self, 'user_id') and self.user_id:
                await self.update_last_seen(self.user_id)
            
            logger.info(f"Chat WebSocket disconnected: user={getattr(self, 'user_id', 'unknown')}, code={close_code}")
        except Exception as e:
            logger.error(f"Error during WebSocket disconnect: {str(e)}")
            traceback.print_exc()
    
# Update the receive method to consistently use the user's ID for the sender_id

    async def receive(self, text_data):
        """Handle incoming WebSocket messages"""
        try:
            data = json.loads(text_data)
            message_type = data.get('type', '')
            
            if message_type == 'chat_message':
                # Get the message content
                message_content = data.get('message', '')
                if not message_content.strip():
                    return  # Don't process empty messages
                
                # IMPORTANT CHANGE: Always use the authenticated user's ID as sender_id
                # This ensures therapists send messages with their user ID, not therapist_id
                user = self.scope.get('user', {})
                sender_id = str(user.get('_id'))  # Use user ID consistently
                
                # Log the sender for debugging
                print(f"Using sender_id for message: {sender_id} from user: {user.get('username', 'Unknown')}")
                
                # Create message data
                message_data = {
                    "content": message_content,
                    "sender_id": sender_id,  # Always use the user ID
                    "conversation_id": self.conversation_id,
                    "message_type": data.get('message_type', 'text'),
                    "metadata": data.get('metadata', {})
                }
                
                # Add session ID if this is a session chat
                if self.session_id:
                    message_data["session_id"] = self.session_id
                
                # Save to database
                message_id = await self.save_message(message_data)
                
                if message_id:
                    # Retrieve the saved message to get any additional data
                    saved_message = await self.get_message_by_id(message_id)
                    server_timestamp = saved_message.get("sent_at").isoformat() if saved_message else datetime.utcnow().isoformat()
                    
                    # Broadcast to room - IMPORTANT: use same sender_id consistently
                    await self.channel_layer.group_send(
                        self.room_group_name,
                        {
                            'type': 'chat_message',
                            'message': message_content,
                            'sender_id': sender_id,  # Use the authenticated user's ID
                            'message_id': str(message_id),
                            'conversation_id': str(self.conversation_id),
                            'timestamp': server_timestamp,
                            'message_type': data.get('message_type', 'text'),
                            'metadata': data.get('metadata', {}),
                            'sequence': saved_message.get("sequence", 0) if saved_message else 0
                        }
                    )
            
            elif message_type == 'mark_read':
                # Add mark read handler for unread messages
                message_ids = data.get('message_ids', [])
                if message_ids:
                    await self.mark_messages_read(message_ids)
                    
                    # Notify other clients about read status
                    await self.channel_layer.group_send(
                        self.room_group_name,
                        {
                            'type': 'read_receipt',
                            'message_ids': message_ids,
                            'reader_id': self.user_id
                        }
                    )
            
            
        except Exception as e:
            print(f"Error in WebSocket receive: {str(e)}")
            traceback.print_exc()

    #
    # Message handlers
    #
    
    async def handle_chat_message(self, content):
        """Handle incoming chat messages"""
        try:
            # Get user information
            user = self.scope.get('user')
            if not user:
                print("No authenticated user found for message")
                return
            
            # Determine the correct sender_id to use
            user_id = str(user.get("_id"))
            user_role = user.get("role", "user")
            sender_id = user_id  # Default to user_id
            sender_name = user.get("username") or f"{user.get('first_name', '')} {user.get('last_name', '')}".strip()
            
            # For therapists, use therapist_id in messages if it exists
            if user_role == "therapist":
                # First check if therapist_id exists in user document
                therapist_id = user.get("therapist_id")
                
                # If not, try to find the therapist document
                if not therapist_id:
                    from apps.therapists.models import Therapist
                    therapist = await self.get_therapist_by_user_id(user_id)
                    if therapist:
                        therapist_id = str(therapist.get("_id"))
                
                # If we found a therapist ID, use it as the sender
                if therapist_id:
                    sender_id = str(therapist_id)
                    print(f"Using therapist_id {therapist_id} as sender_id for WebSocket message")
            
            # Create message document
            message = {
                "content": content["message"],
                "sender_id": sender_id,
                "conversation_id": self.conversation_id,
                "message_type": content.get("message_type", "text"),
                "sent_at": datetime.utcnow(),
                "read": False,
                "metadata": content.get("metadata", {})
            }
            
            # Add session ID if this is a session chat
            if self.session_id:
                message["session_id"] = self.session_id
                
            # Save to database
            message_id = await self.save_message(message)
            message["_id"] = message_id
            
            # Broadcast to group
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'chat_message',
                    'message': content["message"],
                    'sender_id': sender_id,
                    'sender_name': sender_name,
                    'message_id': str(message_id),
                    'timestamp': message["sent_at"].isoformat(),
                    'message_type': message["message_type"],
                    'metadata': message.get("metadata", {}),
                    'conversation_id': str(self.conversation_id)
                }
            )
            
        except Exception as e:
            print(f"Error handling chat message: {str(e)}")
            import traceback
            traceback.print_exc()
    
    async def handle_typing_indicator(self, data):
        """Handle typing indicator events"""
        is_typing = data.get('is_typing', True)
        
        # Broadcast typing status to the room
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'typing_indicator',
                'sender_id': self.user_id,
                'is_typing': is_typing,
                'timestamp': datetime.utcnow().isoformat()
            }
        )
    
    async def handle_read_receipt(self, data):
        """Handle read receipt events"""
        message_ids = data.get('message_ids', [])
        
        if not message_ids:
            return
            
        # Update read status in database
        await self.mark_messages_read(message_ids)
        
        # Send read receipt to room group
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'read_receipt',
                'reader_id': self.user_id,
                'message_ids': message_ids,
                'timestamp': datetime.utcnow().isoformat()
            }
        )
    
    async def handle_reaction(self, data):
        """Handle message reaction events"""
        message_id = data.get('message_id')
        reaction = data.get('reaction')
        
        if not message_id or not reaction:
            return
            
        # Save reaction to database
        success = await self.save_reaction(message_id, self.user_id, reaction)
        
        if not success:
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': "Cannot add reaction: message not found"
            }))
            return
            
        # Send reaction to room group
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'message_reaction',
                'message_id': message_id,
                'user_id': self.user_id,
                'reaction': reaction,
                'timestamp': datetime.utcnow().isoformat()
            }
        )
    
    async def handle_edit_message(self, data):
        """Handle message edit events"""
        message_id = data.get('message_id')
        new_content = data.get('content')
        
        if not message_id or not new_content:
            return
            
        # Update message in database
        success = await self.update_message(message_id, self.user_id, new_content)
        
        if not success:
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': "Cannot edit message: not found or not authorized"
            }))
            return
            
        # Send edit notification to room group
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'message_edited',
                'message_id': message_id,
                'sender_id': self.user_id,
                'content': new_content,
                'timestamp': datetime.utcnow().isoformat()
            }
        )
    
    async def handle_delete_message(self, data):
        """Handle message deletion events"""
        message_id = data.get('message_id')
        
        if not message_id:
            return
            
        # Delete message from database
        success = await self.delete_message(message_id, self.user_id)
        
        if not success:
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': "Cannot delete message: not found or not authorized"
            }))
            return
            
        # Send delete notification to room group
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'message_deleted',
                'message_id': message_id,
                'sender_id': self.user_id,
                'timestamp': datetime.utcnow().isoformat()
            }
        )
    
    async def send_message_history(self, limit=50):
        """Load and send message history"""
        history = await self.get_message_history(limit)
        
        if history:
            await self.send(text_data=json.dumps({
                'type': 'message_history',
                'messages': history,
                'conversation_id': str(self.conversation_id)
            }))
            
            # Mark messages as read
            message_ids = [msg['id'] for msg in history 
                           if msg['sender_id'] != self.user_id and not msg['read']]
            
            if message_ids:
                await self.mark_messages_read(message_ids)
                
                # Send read receipt to other users
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'read_receipt',
                        'reader_id': self.user_id,
                        'message_ids': message_ids,
                        'timestamp': datetime.utcnow().isoformat()
                    }
                )
    
    async def handle_system_message(self, data):
        """Handle system-generated messages (help bot, notifications)"""
        message_type = data.get('message_type', 'system')
        content = data.get('content', '')
        metadata = data.get('metadata', {})
        
        # Generate system message ID
        system_message_id = str(uuid.uuid4())
        
        timestamp = datetime.utcnow().isoformat()
        
        # Save to database if persistence is needed
        if data.get('persist', False):
            message_id = await self.save_message(
                sender_id="system",  # Special sender ID for system
                conversation_id=self.conversation_id,
                content=content,
                message_type=message_type,
                metadata=metadata
            )
            system_message_id = str(message_id)
        
        # Send directly to this user only (not to the group)
        await self.send(text_data=json.dumps({
            'type': 'chat_message',
            'message': content,
            'sender_id': 'system',
            'message_id': system_message_id,
            'message_type': message_type,
            'timestamp': timestamp,
            'metadata': metadata
        }))

    async def handle_help_request(self, data):
        """Process help requests and generate AI responses"""
        query = data.get('query', '')
        context = data.get('context', {})
        
        # Use the AI help assistant to generate a response
        help_assistant = HelpAssistant()
        response = await database_sync_to_async(help_assistant.get_response)(query, context)
        
        # Send the help response as a system message
        await self.handle_system_message({
            'content': response.get('message', 'I couldn\'t find an answer to your question.'),
            'message_type': 'help',
            'metadata': {
                'suggestions': response.get('suggestions', []),
                'actions': response.get('actions', []),
                'source': 'ai_help'
            }
        })

    #
    # Event handlers for channel layer messages
    #
    
    async def chat_message(self, event):
        """
        Broadcast message to client
        """
        try:
            # Make a copy of the event to avoid modifying the original
            data_to_send = event.copy()
            
            # Get current user IDs
            user_id = str(self.scope.get('user', {}).get('_id', ''))
            therapist_id = str(self.scope.get('user', {}).get('therapist_id', ''))
            
            # Debug log with more ID details
            print(f"Broadcasting message {event.get('message_id')} to client with user_id={user_id}, therapist_id={therapist_id}")
            print(f"Message sender_id={event.get('sender_id')}")
            
            # Send message to WebSocket with consistent sender_id
            await self.send(text_data=json.dumps(data_to_send))
            
        except Exception as e:
            print(f"Error broadcasting message: {str(e)}")
            import traceback
            traceback.print_exc()
    
    async def typing_indicator(self, event):
        """Send typing indicator to WebSocket"""
        await self.send(text_data=json.dumps({
            'type': 'typing_indicator',
            'sender_id': event['sender_id'],
            'is_typing': event['is_typing'],
            'timestamp': event['timestamp']
        }))
    
    async def read_receipt(self, event):
        """Send read receipt to WebSocket clients"""
        await self.send(text_data=json.dumps({
            'type': 'read_receipt',
            'message_ids': event['message_ids'],
            'reader_id': event['reader_id'],
            'timestamp': datetime.utcnow().isoformat()
        }))
    
    async def message_reaction(self, event):
        """Send message reaction to WebSocket"""
        await self.send(text_data=json.dumps({
            'type': 'message_reaction',
            'message_id': event['message_id'],
            'user_id': event['user_id'],
            'reaction': event['reaction'],
            'timestamp': event['timestamp']
        }))
    
    async def message_edited(self, event):
        """Send message edit notification to WebSocket"""
        await self.send(text_data=json.dumps({
            'type': 'message_edited',
            'message_id': event['message_id'],
            'sender_id': event['sender_id'],
            'content': event['content'],
            'timestamp': event['timestamp']
        }))
    
    async def message_deleted(self, event):
        """Send message deletion notification to WebSocket"""
        await self.send(text_data=json.dumps({
            'type': 'message_deleted',
            'message_id': event['message_id'],
            'sender_id': event['sender_id'],
            'timestamp': event['timestamp']
        }))
    
    async def user_online(self, event):
        """Send user online status to WebSocket"""
        await self.send(text_data=json.dumps({
            'type': 'user_status',
            'user_id': event['user_id'],
            'status': 'online',
            'timestamp': event['timestamp']
        }))
    
    async def user_offline(self, event):
        """Send user offline status to WebSocket"""
        await self.send(text_data=json.dumps({
            'type': 'user_status',
            'user_id': event['user_id'],
            'status': 'offline',
            'timestamp': event['timestamp']
        }))
    
    #
    # Database operations
    #
    
    @database_sync_to_async
    def get_or_create_conversation(self):
        """Get or create conversation between users"""
        participants = [self.user_id, self.other_user_id]
        conversation_id = Conversation.get_or_create(
            participants=participants,
            conversation_type=self.conversation_type,
            session_id=self.session_id
        )
        
        # Log the conversation details for debugging
        conversation = Conversation.find_by_id(conversation_id)
        print(f"Using conversation: {conversation_id}, type: {conversation.get('conversation_type')}, session: {conversation.get('session_id')}")
        
        return conversation_id
    
    # Update the save_message method to ensure consistent UTC timestamps

    @database_sync_to_async
    def save_message(self, content=None, message_type='text', metadata=None, **kwargs):
        """Save message and update conversation's last_message"""
        try:
            # Support both direct parameters and message_data dictionary
            if isinstance(content, dict):
                # This is a message_data object
                message_data = content
                content = message_data.get("content")
                message_type = message_data.get("message_type", 'text')
                metadata = message_data.get("metadata")
                sender_id = message_data.get("sender_id", self.user_id)
                conversation_id = message_data.get("conversation_id", self.conversation_id)
                session_id = message_data.get("session_id")
            else:
                # Using direct parameters
                sender_id = kwargs.get("sender_id", self.user_id)
                conversation_id = kwargs.get("conversation_id", self.conversation_id)
                session_id = kwargs.get("session_id")
            
            # Get current UTC time - this ensures all messages use the same time reference
            timestamp = datetime.utcnow()
            
            # Convert conversation_id to ObjectId if it's a string
            if isinstance(conversation_id, str):
                conversation_id = ObjectId(conversation_id)
            
            # Get the next sequence number (synchronously)
            sequence_number = self.get_next_sequence_number_sync(conversation_id)
            
            # Create new message with proper fields
            message = {
                "_id": ObjectId(),
                "conversation_id": conversation_id,
                "sender_id": sender_id,
                "content": content,
                "message_type": message_type,
                "metadata": metadata or {},
                "sent_at": timestamp,  # Always UTC
                "read": False,
                "read_at": None,
                "sequence": sequence_number  # Add sequence number
            }
            
            # Add session_id if provided
            if session_id:
                message["session_id"] = session_id
                
            # Insert message
            message_id = db.messages.insert_one(message).inserted_id
            
            # Update conversation's last_message
            last_message = {
                "content": content,
                "sender_id": sender_id,
                "sent_at": timestamp,  # Always UTC
                "message_type": message_type
            }
            
            # Make sure we use ObjectId for conversation update
            db.conversations.update_one(
                {"_id": conversation_id},
                {
                    "$set": {
                        "last_message": last_message,
                        "updated_at": timestamp  # Always UTC
                    }
                }
            )
            
            print(f"Saved message {message_id} to conversation {conversation_id}")
            return str(message_id)
        except Exception as e:
            print(f"Error saving message: {str(e)}")
    @database_sync_to_async
    def get_next_sequence_number(self, conversation_id):
        """Get the next sequence number for a message in this conversation (async version)"""
        # Find the highest sequence number so far
        last_message = db.messages.find_one(
            {"conversation_id": conversation_id},
            sort=[("sequence", -1)]
        )
        
        # Start from 1 or increment from last
        if last_message and "sequence" in last_message:
            return last_message["sequence"] + 1
        return 1
        
    def get_next_sequence_number_sync(self, conversation_id):
        """Get the next sequence number for a message in this conversation (synchronous version)"""
        # Find the highest sequence number so far
        last_message = db.messages.find_one(
            {"conversation_id": conversation_id},
            sort=[("sequence", -1)]
        )
        
        # Start from 1 or increment from last
        if last_message and "sequence" in last_message:
            return last_message["sequence"] + 1
        return 1
        if last_message and "sequence" in last_message:
            return last_message["sequence"] + 1
        return 1
    
    @database_sync_to_async
    def get_message_history(self, limit=50):
        """Get conversation history from database"""
        messages = Message.get_messages_by_conversation(self.conversation_id, limit)
        
        # Convert to serializable format
        history = []
        for msg in messages:
            history.append({
                'id': str(msg.get('_id', '')),
                'sender_id': msg.get('sender_id', ''),
                'conversation_id': str(msg.get('conversation_id', '')),
                'content': msg.get('content', ''),
                'message_type': msg.get('message_type', 'text'),
                'timestamp': msg.get('sent_at').isoformat() if msg.get('sent_at') else '',
                'read': msg.get('read', False),
                'edited': msg.get('edited', False),
                'reactions': msg.get('reactions', []),
                'attachment_url': msg.get('attachment_url'),
                'is_deleted': msg.get('is_deleted', False),
                'session_id': msg.get('session_id')
            })
            
        return history
    
    @database_sync_to_async
    def mark_messages_read(self, message_ids):
        """Mark multiple messages as read"""
        try:
            for msg_id in message_ids:
                if isinstance(msg_id, str):
                    msg_id = ObjectId(msg_id)
                    
                db.messages.update_one(
                    {"_id": msg_id},
                    {"$set": {
                        "read": True,
                        "read_at": datetime.utcnow()
                    }}
                )
            return True
        except Exception as e:
            print(f"Error marking messages as read: {str(e)}")
            return False
    
    @database_sync_to_async
    def save_reaction(self, message_id, user_id, reaction):
        """Save reaction to message"""
        return Message.add_reaction(message_id, user_id, reaction)
    
    @database_sync_to_async
    def update_message(self, message_id, sender_id, new_content):
        """Update message content"""
        return Message.update_content(message_id, sender_id, new_content)
    
    @database_sync_to_async
    def delete_message(self, message_id, sender_id):
        """Delete a message"""
        return Message.soft_delete(message_id, sender_id)
    
    @database_sync_to_async
    def get_user_info(self, user_id):
        """Get user info from database"""
        user = User.find_by_id(user_id)
        # print(f"User info: {user}")
        if not user:
            return {"id": user_id, "name": "Unknown User"}
            
        return {
            "id": user_id,
            "name": f"{user.get('first_name', '')} {user.get('last_name', '')}".strip(),
            "avatar": user.get('avatar_url', None),
            "role": user.get('role', 'user')
        }
    
    @database_sync_to_async
    def update_last_seen(self, user_id):
        """Update user's last seen timestamp"""
        return User.update_last_seen(user_id)
    
    @database_sync_to_async
    def get_user_status(self, user_id):
        """Check if user is online based on presence channels"""
        # This is a simple implementation - you might want to use Redis presence for production
        from channels.layers import get_channel_layer
        channel_layer = get_channel_layer()
        
        # Check if user has any active connections
        # In a real implementation, you'd query an active connections list in Redis
        # For now, we'll just return 'offline' as a placeholder
        return 'offline'
    
    @database_sync_to_async
    def get_therapist_by_user_id(self, user_id):
        """Get therapist document by user_id"""
        from apps.therapists.models import Therapist
        return Therapist.find_by_user_id(user_id)

    @database_sync_to_async
    def get_message_by_id(self, message_id):
        """Get a specific message by ID"""
        try:
            if isinstance(message_id, str):
                message_id = ObjectId(message_id)
            
            message = db.messages.find_one({"_id": message_id})
            return message
        except Exception as e:
            print(f"Error fetching message {message_id}: {str(e)}")
            return None

class HelpChatConsumer(AsyncWebsocketConsumer):
    """WebSocket consumer for AI help assistant interactions"""
    
    async def connect(self):
        """Handle WebSocket connection for help assistant"""
        self.user_id = self.scope['url_route']['kwargs']['user_id']
        self.room_name = f"help_{self.user_id}"
        self.room_group_name = self.room_name
        
        # Add channel to user-specific group
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        
        # Accept connection
        await self.accept()
        logger.info(f"Help WebSocket connected: user={self.user_id}")
        
        # Send welcome message
        await self.send_welcome_message()
    
    async def disconnect(self, close_code):
        """Handle WebSocket disconnection"""
        # Leave room group
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )
        
        logger.info(f"Help WebSocket disconnected: user={self.user_id}, code={close_code}")
    
    async def receive(self, text_data):
        """Process incoming help requests"""
        try:
            data = json.loads(text_data)
            message_type = data.get('type', 'help_request')
            
            if message_type == 'help_request':
                await self.handle_help_request(data)
            elif message_type == 'ping':
                await self.send(text_data=json.dumps({
                    'type': 'pong',
                    'timestamp': datetime.utcnow().isoformat()
                }))
            else:
                logger.warning(f"Unknown message type in help chat: {message_type}")
                await self.send(text_data=json.dumps({
                    'type': 'error',
                    'message': f"Unknown message type: {message_type}"
                }))
                
        except Exception as e:
            logger.error(f"Error in help chat receive: {str(e)}")
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': str(e)
            }))
    
    async def send_welcome_message(self):
        """Send initial welcome message when user connects"""
        try:
            # Get user info to personalize the message
            user = await database_sync_to_async(User.find_by_id)(self.user_id)
            
            # Get context to determine if new user
            is_new_user = False
            if user and user.get('created_at'):
                created_at = user.get('created_at')
                if isinstance(created_at, str):
                    created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                
                # Check if user was created in the last 24 hours
                is_new_user = (datetime.utcnow() - created_at).total_seconds() < 86400
            
            # Get welcome message from help assistant
            help_assistant = HelpAssistant()
            welcome = await database_sync_to_async(help_assistant.get_response)(
                "",  # Empty query for welcome message
                {"is_new_user": is_new_user}
            )
            
            # Send as system message
            await self.send(text_data=json.dumps({
                'type': 'chat_message',
                'message': welcome.get('message', 'Welcome to AI Face Present! How can I help you today?'),
                'sender_id': 'system',
                'message_id': str(uuid.uuid4()),
                'message_type': 'help',
                'timestamp': datetime.utcnow().isoformat(),
                'metadata': {
                    'suggestions': welcome.get('suggestions', []),
                    'actions': welcome.get('actions', [])
                }
            }))
            
        except Exception as e:
            logger.error(f"Error sending welcome message: {str(e)}")
    
    async def handle_help_request(self, data):
        """Handle help request and generate response"""
        query = data.get('query', '')
        context = data.get('context', {})
        
        # Use Help Assistant to generate response
        help_assistant = HelpAssistant()
        response = await database_sync_to_async(help_assistant.get_response)(query, context)
        
        # Generate a unique ID for this message
        message_id = str(uuid.uuid4())
        timestamp = datetime.utcnow().isoformat()
        
        # Send response as system message
        await self.send(text_data=json.dumps({
            'type': 'chat_message',
            'message': response.get('message', 'I couldn\'t find an answer to your question.'),
            'sender_id': 'system',
            'message_id': message_id,
            'message_type': 'help',
            'timestamp': timestamp,
            'metadata': {
                'suggestions': response.get('suggestions', []),
                'actions': response.get('actions', []),
                'source': 'ai_help'
            }
        }))
        
        # Optionally save the conversation if persistence is needed
        if data.get('persist', True):
            # Create a help conversation if needed
            try:
                # Check if the user has a help conversation
                conversation_id = await database_sync_to_async(self.get_or_create_help_conversation)(self.user_id)
                
                # Save user's question
                await database_sync_to_async(self.save_help_message)(
                    conversation_id=conversation_id,
                    sender_id=self.user_id,
                    content=query,
                    message_type='question'
                )
                
                # Save system's response
                await database_sync_to_async(self.save_help_message)(
                    conversation_id=conversation_id,
                    sender_id='system',
                    content=response.get('message', ''),
                    message_type='help',
                    metadata={
                        'suggestions': response.get('suggestions', []),
                        'actions': response.get('actions', []),
                        'source': 'ai_help'
                    }
                )
            except Exception as e:
                logger.error(f"Error saving help conversation: {str(e)}")
    
    @staticmethod
    def get_or_create_help_conversation(user_id):
        """Get or create a help conversation for this user"""
        from apps.chat_messages.models import Conversation, ConversationType
        
        # Look for existing help conversation
        existing = Conversation.find_one({
            "participants": [user_id, "system"],
            "conversation_type": "help",
            "is_active": True
        })
        
        if existing:
            return str(existing["_id"])
        
        # Create a new conversation
        conversation = Conversation(
            participants=[user_id, "system"],
            conversation_type="help",
            metadata={"source": "help_assistant"}
        )
        
        return conversation.save()
    
    @staticmethod
    def save_help_message(conversation_id, sender_id, content, message_type='text', metadata=None):
        """Save a message in the help conversation"""
        from apps.chat_messages.models import Message
        
        message = Message(
            sender_id=sender_id,
            conversation_id=conversation_id,
            content=content,
            message_type=message_type,
            metadata=metadata or {}
        )
        
        return message.save()