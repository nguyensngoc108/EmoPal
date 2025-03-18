from datetime import datetime
import sys
import os

# Import MongoDB connection
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../../")))
from database import db

# Feedback collection
feedback_collection = db["therapist_feedback"]

class Feedback:
    def __init__(self, user_id, therapist_id, session_id=None, rating=0, 
                 comment=None, is_anonymous=False):
        self.user_id = user_id  # User who provided feedback
        self.therapist_id = therapist_id  # Therapist who received feedback
        self.session_id = session_id  # Optional reference to specific session
        self.rating = rating  # Rating from 0-5
        self.comment = comment  # Text feedback
        self.is_anonymous = is_anonymous  # Whether to hide user identity
        self.created_at = datetime.utcnow()
        
    def save(self):
        feedback_data = self.__dict__
        result = feedback_collection.insert_one(feedback_data)
        return result.inserted_id
        
    @staticmethod
    def find_by_id(feedback_id):
        from bson import ObjectId
        return feedback_collection.find_one({"_id": ObjectId(feedback_id)})
        
    @staticmethod
    def find_by_therapist(therapist_id, limit=10, skip=0):
        """Get feedback for a specific therapist"""
        return list(feedback_collection.find(
            {"therapist_id": therapist_id}
        ).sort("created_at", -1).skip(skip).limit(limit))
        
    @staticmethod
    def find_by_user(user_id, limit=10, skip=0):
        """Get feedback left by a specific user"""
        return list(feedback_collection.find(
            {"user_id": user_id}
        ).sort("created_at", -1).skip(skip).limit(limit))
        
    @staticmethod
    def calc_average_rating(therapist_id):
        """Calculate average rating for a therapist"""
        pipeline = [
            {"$match": {"therapist_id": therapist_id}},
            {"$group": {"_id": None, "avgRating": {"$avg": "$rating"}}}
        ]
        result = list(feedback_collection.aggregate(pipeline))
        return result[0]["avgRating"] if result else 0
        
    @staticmethod
    def update_feedback(feedback_id, user_id, updated_data):
        """Update feedback (only allows the original user to update)"""
        from bson import ObjectId
        return feedback_collection.update_one(
            {"_id": ObjectId(feedback_id), "user_id": user_id}, 
            {"$set": updated_data}
        )
        
    @staticmethod
    def delete_feedback(feedback_id, user_id):
        """Delete feedback (only allows the original user to delete)"""
        from bson import ObjectId
        return feedback_collection.delete_one(
            {"_id": ObjectId(feedback_id), "user_id": user_id}
        )

    @staticmethod
    def find_by_session(session_id):
        """Get feedback for a specific session"""
        return feedback_collection.find_one({"session_id": session_id})
    
    @staticmethod
    def find_feedback_stats(therapist_id):
        """Get statistics about therapist feedback"""
        pipeline = [
            {"$match": {"therapist_id": therapist_id}},
            {"$group": {
                "_id": None,
                "avgRating": {"$avg": "$rating"},
                "count": {"$sum": 1},
                "rating5": {"$sum": {"$cond": [{"$eq": ["$rating", 5]}, 1, 0]}},
                "rating4": {"$sum": {"$cond": [{"$eq": ["$rating", 4]}, 1, 0]}},
                "rating3": {"$sum": {"$cond": [{"$eq": ["$rating", 3]}, 1, 0]}},
                "rating2": {"$sum": {"$cond": [{"$eq": ["$rating", 2]}, 1, 0]}},
                "rating1": {"$sum": {"$cond": [{"$eq": ["$rating", 1]}, 1, 0]}},
            }}
        ]
        result = list(feedback_collection.aggregate(pipeline))
        return result[0] if result else {
            "avgRating": 0,
            "count": 0,
            "rating5": 0,
            "rating4": 0,
            "rating3": 0,
            "rating2": 0,
            "rating1": 0
        }