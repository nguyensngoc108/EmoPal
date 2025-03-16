from datetime import datetime
import sys
import os

# Import MongoDB connection
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../../")))
from database import db

# Media storage collection
media_storage_collection = db["media_storage"]

class MediaStorage:
    def __init__(self, user_id, media_type, media_url, public_id, 
                 media_category, filename=None, metadata=None,
                 analysis_id=None, session_id=None):
        self.user_id = user_id  # User who owns this media
        self.media_type = media_type  # "image" or "video"
        self.media_url = media_url  # Cloudinary URL
        self.public_id = public_id  # Cloudinary public_id
        self.media_category = media_category  # "emotion_analysis", "session_recording", "profile", etc.
        self.filename = filename  # Original filename
        self.metadata = metadata or {
            "width": None,
            "height": None,
            "duration": None,
            "format": None,
            "size": None
        }
        self.analysis_id = analysis_id  # Reference to emotion analysis if applicable
        self.session_id = session_id  # Reference to session if applicable
        self.created_at = datetime.utcnow()
        
    def save(self):
        """Save media record to MongoDB"""
        media_data = self.__dict__
        result = media_storage_collection.insert_one(media_data)
        return result.inserted_id
        
    @staticmethod
    def find_by_id(media_id):
        """Find media by ID"""
        from bson import ObjectId
        return media_storage_collection.find_one({"_id": ObjectId(media_id)})
        
    @staticmethod
    def find_by_user(user_id, media_category=None, media_type=None, limit=10, skip=0):
        """Find media for a specific user with optional filters"""
        from bson import ObjectId
        if isinstance(user_id, str):
            user_id = ObjectId(user_id)
            
        query = {"user_id": user_id}
        if media_category:
            query["media_category"] = media_category
        if media_type:
            query["media_type"] = media_type
            
        return list(media_storage_collection.find(query)
                   .sort("created_at", -1)
                   .skip(skip)
                   .limit(limit))
                   
    @staticmethod
    def find_by_session(session_id, limit=50, skip=0):
        """Find media for a specific session"""
        from bson import ObjectId
        if isinstance(session_id, str):
            session_id = ObjectId(session_id)
            
        return list(media_storage_collection.find({"session_id": session_id})
                   .sort("created_at", 1)
                   .skip(skip)
                   .limit(limit))
                   
    @staticmethod
    def find_by_analysis(analysis_id):
        """Find media associated with an analysis"""
        from bson import ObjectId
        if isinstance(analysis_id, str):
            analysis_id = ObjectId(analysis_id)
            
        return media_storage_collection.find_one({"analysis_id": analysis_id})
        
    @staticmethod
    def delete_media(media_id, user_id=None):
        """Delete media record"""
        from bson import ObjectId
        query = {"_id": ObjectId(media_id)}
        
        # Add user_id to query if provided (for security)
        if user_id:
            if isinstance(user_id, str):
                user_id = ObjectId(user_id)
            query["user_id"] = user_id
            
        return media_storage_collection.delete_one(query)
    # Add this method to your MediaStorage class:

    # Add this method to your MediaStorage class:

    @staticmethod
    def delete_by_analysis(analysis_id):
       """Delete media records associated with an analysis"""
       from bson import ObjectId
       if isinstance(analysis_id, str):
        analysis_id = ObjectId(analysis_id)
        
       return media_storage_collection.delete_many({"analysis_id": analysis_id})