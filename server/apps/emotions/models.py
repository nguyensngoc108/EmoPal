from datetime import datetime
import sys
import os

# Ensure we can import database.py
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../../")))
from database import db  # Import MongoDB connection

# Emotion Analysis Collection
emotion_analyses_collection = db["emotion_analyses"]

class EmotionAnalysis:
    def __init__(self, user_id, media_url, media_type, session_id=None,
                 results=None, media_metadata=None):
        self.user_id = user_id
        self.media_url = media_url  # Cloudinary URL
        self.media_type = media_type  # image or video
        self.session_id = session_id  # Optional link to therapy session
        self.media_metadata = media_metadata or {
            "public_id": None,
            "format": None,
            "width": None,
            "height": None,
            "duration": None,  # For videos
            "resource_type": None
        }
        
        # Enhanced results structure
        self.results = results or {
            "emotions": {
                "angry": 0,
                "disgust": 0,
                "fear": 0,
                "happy": 0, 
                "neutral": 0,
                "sad": 0,
                "surprise": 0
            },
            "dominant_emotion": "neutral",
            "confidence": 0,
            "valence": 0,  # Emotional positivity/negativity (-1 to 1)
            "engagement": 0,  # Emotional expressiveness (0-100%)
            "face_count": 0,  # Number of faces detected
            "faces": [],  # Individual face data
            "overall": {  # Aggregated metrics (for videos or multi-face images)
                "dominant_emotion": "neutral",
                "avg_valence": 0,
                "avg_engagement": 0
            }
        }
        
        # Store visualization URLs
        self.visualizations = {
            "analyzed_image": None,  # Image with emotion annotations
            "emotion_graph": None,   # Chart of emotion distribution
            "timeline_graph": None,   # Video timeline (for videos only)
            "annotated_video": None  # Video with emotion annotations
        }
        
        # Add therapeutic context
        self.therapeutic_context = {
            "suggested_approach": None,
            "warning_flags": [],
            "therapy_notes": None
        }
        
        self.created_at = datetime.utcnow()

    def save(self):
        """ Save emotion analysis to MongoDB """
        analysis_data = self.__dict__
        result = emotion_analyses_collection.insert_one(analysis_data)
        return result.inserted_id
    
    def update(self):
        """ Update existing analysis record """
        analysis_data = self.__dict__
        result = emotion_analyses_collection.update_one(
            {"_id": self._id},
            {"$set": analysis_data}
        )
        return result.modified_count
        
    @staticmethod
    def find_by_id(analysis_id):
        """ Find analysis by ID """
        from bson.objectid import ObjectId
        return emotion_analyses_collection.find_one({"_id": ObjectId(analysis_id)})
        
    @staticmethod
    def find_by_user(user_id, limit=10, skip=0):
        """ Find analyses for a specific user """
        from bson.objectid import ObjectId
        if isinstance(user_id, str):
            user_id = ObjectId(user_id)
            
        return list(emotion_analyses_collection.find(
            {"user_id": user_id}
        ).sort("created_at", -1).skip(skip).limit(limit))
        
    @staticmethod
    def find_by_session(session_id):
        """ Find analyses for a specific therapy session """
        from bson.objectid import ObjectId
        if isinstance(session_id, str):
            session_id = ObjectId(session_id)
            
        return list(emotion_analyses_collection.find(
            {"session_id": session_id}
        ).sort("created_at", 1))
        
    @staticmethod
    def find_by_date_range(user_id, start_date, end_date):
        """ Find analyses for a user within a date range """
        from bson.objectid import ObjectId
        if isinstance(user_id, str):
            user_id = ObjectId(user_id)
            
        return list(emotion_analyses_collection.find({
            "user_id": user_id,
            "created_at": {
                "$gte": start_date,
                "$lte": end_date
            }
        }).sort("created_at", 1))
        
    @staticmethod
    def find_by_emotion(user_id, emotion, threshold=0.5, limit=10):
        """ Find analyses where a specific emotion is prominent """
        from bson.objectid import ObjectId
        if isinstance(user_id, str):
            user_id = ObjectId(user_id)
            
        query_field = f"results.emotions.{emotion}"
        
        return list(emotion_analyses_collection.find({
            "user_id": user_id,
            query_field: {"$gte": threshold}
        }).sort(query_field, -1).limit(limit))
        
    @staticmethod
    def get_emotion_trends(user_id, days=30):
        """ Get emotion trends over time for a user """
        from bson.objectid import ObjectId
        if isinstance(user_id, str):
            user_id = ObjectId(user_id)
            
        # Calculate date range (last N days)
        end_date = datetime.utcnow()
        start_date = end_date - datetime.timedelta(days=days)
        
        # Get all analyses in date range
        analyses = list(emotion_analyses_collection.find({
            "user_id": user_id,
            "created_at": {
                "$gte": start_date,
                "$lte": end_date
            }
        }).sort("created_at", 1))
        
        # Extract emotion trends
        trend_data = {
            "dates": [],
            "emotions": {
                "angry": [],
                "disgust": [],
                "fear": [],
                "happy": [],
                "neutral": [],
                "sad": [],
                "surprise": []
            },
            "valence": [],
            "engagement": []
        }
        
        for analysis in analyses:
            trend_data["dates"].append(analysis["created_at"].strftime("%Y-%m-%d"))
            
            for emotion, value in analysis["results"]["emotions"].items():
                if emotion in trend_data["emotions"]:
                    trend_data["emotions"][emotion].append(value)
            
            if "valence" in analysis["results"]:
                trend_data["valence"].append(analysis["results"]["valence"])
                
            if "engagement" in analysis["results"]:
                trend_data["engagement"].append(analysis["results"]["engagement"])
        
        return trend_data
    
    @staticmethod
    def delete_analysis(analysis_id, user_id=None):
        """ Delete an analysis """
        from bson.objectid import ObjectId
        if isinstance(analysis_id, str):
            analysis_id = ObjectId(analysis_id)
        
        query = {"_id": analysis_id}
        if user_id:
            if isinstance(user_id, str):
                user_id = ObjectId(user_id)
            query["user_id"] = user_id
            
        return emotion_analyses_collection.delete_one(query)