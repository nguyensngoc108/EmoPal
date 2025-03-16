from datetime import datetime
from bson import ObjectId
import logging
import os
import sys
from enum import Enum

# Import MongoDB connection
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../../")))
from database import db

# Set up logger
logger = logging.getLogger(__name__)

# Collections
conversations_collection = db["conversations"]
messages_collection = db["messages"]


class ConversationType(Enum):
    INITIAL_CONSULTATION = "initial_consultation"  # Pre-booking discussions
    THERAPY_SESSION = "therapy_session"  # During an actual session
    FOLLOW_UP = "follow_up"  # Post-session communication


class Conversation:
    """Conversation model to group messages between users"""
    collection = db.conversations
    def __init__(self, participants, conversation_type, session_id=None, metadata=None):
        """
        Initialize a new conversation
        
        Args:
            participants (list): List of user IDs participating in the conversation
            conversation_type (str): Type of conversation - "consultation" or "session"
            session_id (str, optional): Session ID for session conversations
            metadata (dict, optional): Additional metadata for the conversation
        """
        self.conversation_id = ObjectId()
        self.participants = sorted(participants)  # Always sort to ensure consistent lookup
        self.conversation_type = conversation_type
        self.session_id = session_id
        self.created_at = datetime.utcnow()
        self.updated_at = datetime.utcnow()
        self.last_message = None
        self.metadata = metadata or {}
        
    def to_dict(self):
        """Convert to dictionary for database storage"""
        return {
            "_id": self.conversation_id,
            "participants": self.participants,
            "conversation_type": self.conversation_type,
            "session_id": self.session_id,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "last_message": self.last_message,
            "metadata": self.metadata
        }
    
    def save(self):
        """Save conversation to MongoDB"""
        try:
            conversation_dict = self.to_dict()
            conversations_collection.insert_one(conversation_dict)
            return self.conversation_id
        except Exception as e:
            logger.error(f"Error saving conversation: {e}")
            return None
    
    @classmethod
    def get_or_create(cls, participants, conversation_type=None, session_id=None):
        """Get or create a conversation between participants"""
        # Sort participants for consistent matching
        sorted_participants = sorted(participants)
        
        # Try to find by session_id first (most specific match)
        if session_id:
            existing = conversations_collection.find_one({
                "session_id": session_id,
                "conversation_type": "therapy_session"
            })
            if existing:
                print(f"Found conversation by session_id: {existing['_id']}")
                return str(existing["_id"])
        
        # Then try to find by participants and type
        query = {
            "participants": {"$all": sorted_participants, "$size": len(sorted_participants)}
        }
        
        if conversation_type:
            query["conversation_type"] = conversation_type
            
        existing = conversations_collection.find_one(query)
        if existing:
            print(f"Found conversation by participants: {existing['_id']}")
            return str(existing["_id"])
        
        # Create new conversation if none exists
        conversation = cls(
            participants=sorted_participants,
            conversation_type=conversation_type,
            session_id=session_id
        )
        new_id = conversation.save()
        print(f"Created new conversation: {new_id}")
        return new_id
    
    @staticmethod
    def find_by_id(conversation_id):
        """Find conversation by ID"""
        if isinstance(conversation_id, str):
            conversation_id = ObjectId(conversation_id)
            
        return conversations_collection.find_one({"_id": conversation_id})
    
    @staticmethod
    def list_for_user(user_id, conversation_type=None, limit=20, skip=0):
        """List all conversations for a user"""
        query = {"participants": user_id}
        
        # Filter by conversation type if provided
        if conversation_type:
            query["conversation_type"] = conversation_type
            
        return list(conversations_collection.find(
            query
        ).sort("updated_at", -1).skip(skip).limit(limit))
    
    @staticmethod
    def update_last_message(conversation_id, message_data):
        """Update conversation with last message info"""
        if isinstance(conversation_id, str):
            conversation_id = ObjectId(conversation_id)
            
        return conversations_collection.update_one(
            {"_id": conversation_id},
            {
                "$set": {
                    "last_message": message_data,
                    "updated_at": datetime.utcnow()
                }
            }
        )
    
    @staticmethod
    def get_session_conversation(session_id):
        """Get conversation associated with a session"""
        return conversations_collection.find_one({
            "conversation_type": "session",
            "session_id": session_id
        })
    
    @staticmethod
    def get_consultation_conversation(user_id, therapist_id):
        """Get consultation conversation between user and therapist"""
        participants = sorted([user_id, therapist_id])
        
        return conversations_collection.find_one({
            "participants": participants,
            "conversation_type": "consultation"
        })
        
    @staticmethod
    def find_by_participant(participant_id, limit=20, skip=0):
        """Find all conversations where user is a participant"""
        if isinstance(participant_id, ObjectId):
            participant_id = str(participant_id)
            
        query = {"participants": participant_id,
            "conversation_type": "therapy_session"}
        
        
        # Execute query with sorting and pagination
        results = list(conversations_collection.find(
            query
        ).sort("updated_at", -1).skip(skip).limit(limit))
        
        print(f"Found {len(results)} conversations for participant {participant_id}")
        return results


class Message:
    """Message model for individual chat messages"""
    
    def __init__(self, sender_id, conversation_id, content="", 
                 message_type="text", session_id=None,
                 attachment_url=None, metadata=None):
        """
        Initialize a new message
        
        Args:
            sender_id (str): ID of the message sender
            conversation_id (ObjectId): ID of the conversation this message belongs to
            content (str): Text content of the message
            message_type (str): Type of message - "text", "image", etc.
            session_id (str, optional): Session ID for session messages
            attachment_url (str, optional): URL to attachment if any
            metadata (dict, optional): Additional message metadata
        """
        self.message_id = ObjectId()
        self.sender_id = sender_id
        self.conversation_id = conversation_id
        self.content = content
        self.message_type = message_type
        self.session_id = session_id
        self.sent_at = datetime.utcnow()
        self.read = False
        self.read_at = None
        self.attachment_url = attachment_url
        self.edited = False
        self.edited_at = None
        self.is_deleted = False
        self.deleted_at = None
        self.reactions = []
        self.metadata = metadata or {}
        
    def to_dict(self):
        """Convert to dictionary for database storage"""
        return {
            "_id": self.message_id,
            "sender_id": self.sender_id,
            "conversation_id": self.conversation_id,
            "content": self.content,
            "message_type": self.message_type,
            "session_id": self.session_id,
            "sent_at": self.sent_at,
            "read": self.read,
            "read_at": self.read_at,
            "attachment_url": self.attachment_url,
            "edited": self.edited,
            "edited_at": self.edited_at,
            "is_deleted": self.is_deleted,
            "deleted_at": self.deleted_at,
            "reactions": self.reactions,
            "metadata": self.metadata
        }
    
    def save(self):
        """Save message to MongoDB and update conversation"""
        try:
            message_dict = self.to_dict()
            messages_collection.insert_one(message_dict)
            
            # Update conversation last message info
            last_message_data = {
                "content": self.content[:100] if self.content else "",
                "sender_id": self.sender_id,  # This will now be correct (user_id or therapist_id)
                "sent_at": self.sent_at,
                "message_type": self.message_type
            }
            
            Conversation.update_last_message(self.conversation_id, last_message_data)
            return self.message_id
            
        except Exception as e:
            logger.error(f"Error saving message: {e}")
            return None
    
    @staticmethod
    def find_by_id(message_id):
        """Find message by ID"""
        if isinstance(message_id, str):
            message_id = ObjectId(message_id)
            
        return messages_collection.find_one({"_id": message_id})
    
    @classmethod
    def get_messages_by_conversation(cls, conversation_id, limit=50, skip=0):
        """Get messages for a specific conversation"""
        try:
            # Convert string ID to ObjectId if needed
            if isinstance(conversation_id, str):
                conversation_id = ObjectId(conversation_id)
            
            print(f"Fetching messages for conversation {conversation_id}, limit={limit}, skip={skip}")
            
            # Important: Query both string and ObjectId versions to find all messages
            messages = list(db.messages.find({
                "$or": [
                    {"conversation_id": conversation_id},  # Match ObjectId
                    {"conversation_id": str(conversation_id)}  # Match string ID
                ]
            }).sort("sent_at", 1).skip(skip).limit(limit))
            
            print(f"Found {len(messages)} messages")
            return messages
        except Exception as e:
            print(f"Error retrieving messages: {str(e)}")
            import traceback
            traceback.print_exc()
            return []
    
    @staticmethod
    def get_messages_by_session(session_id, limit=100, skip=0):
        """Get messages for a specific therapy session"""
        # Query messages and sort by sent time
        return list(messages_collection.find(
            {"session_id": session_id, "is_deleted": False}
        ).sort("sent_at", 1).skip(skip).limit(limit))
    
    @staticmethod
    def mark_as_read(message_ids, reader_id):
        """Mark messages as read by a specific user"""
        if not isinstance(message_ids, list):
            message_ids = [message_ids]
            
        # Convert string IDs to ObjectId
        object_ids = [ObjectId(id) if isinstance(id, str) else id for id in message_ids]
        
        result = messages_collection.update_many(
            {"_id": {"$in": object_ids}, "read": False},
            {"$set": {"read": True, "read_at": datetime.utcnow()}}
        )
        
        return result.modified_count > 0
    
    @staticmethod
    def add_reaction(message_id, user_id, reaction):
        """Add reaction to a message"""
        if isinstance(message_id, str):
            message_id = ObjectId(message_id)
            
        # First remove any existing reaction from this user
        messages_collection.update_one(
            {"_id": message_id},
            {"$pull": {"reactions": {"user_id": user_id}}}
        )
        
        # Then add the new reaction
        result = messages_collection.update_one(
            {"_id": message_id},
            {"$push": {"reactions": {
                "user_id": user_id,
                "reaction": reaction,
                "created_at": datetime.utcnow()
            }}}
        )
        
        return result.modified_count > 0
    
    @staticmethod
    def update_content(message_id, sender_id, new_content):
        """Update message content (edit message)"""
        if isinstance(message_id, str):
            message_id = ObjectId(message_id)
            
        # Ensure only sender can edit their message
        result = messages_collection.update_one(
            {"_id": message_id, "sender_id": sender_id},
            {"$set": {
                "content": new_content,
                "edited": True,
                "edited_at": datetime.utcnow()
            }}
        )
        
        return result.modified_count > 0
    
    @staticmethod
    def soft_delete(message_id, sender_id):
        """Soft delete a message (mark as deleted)"""
        if isinstance(message_id, str):
            message_id = ObjectId(message_id)
            
        # Ensure only sender can delete their message
        result = messages_collection.update_one(
            {"_id": message_id, "sender_id": sender_id},
            {"$set": {
                "is_deleted": True,
                "deleted_at": datetime.utcnow(),
                "content": "[This message was deleted]"
            }}
        )
        
        return result.modified_count > 0
    
    @staticmethod
    def get_unread_count(user_id, conversation_id=None):
        """Get count of unread messages for a user in one or all conversations"""
        query = {
            "read": False,
            "sender_id": {"$ne": user_id}  # Not sent by this user
        }
        
        if conversation_id:
            if isinstance(conversation_id, str):
                conversation_id = ObjectId(conversation_id)
            query["conversation_id"] = conversation_id
        else:
            # Get all conversations where user is a participant
            conversation_ids = [
                conv["_id"] for conv in 
                list(conversations_collection.find(
                    {"participants": user_id},
                    {"_id": 1}
                ))
            ]
            query["conversation_id"] = {"$in": conversation_ids}
            
        return messages_collection.count_documents(query)