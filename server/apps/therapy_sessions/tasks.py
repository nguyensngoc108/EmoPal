import logging
from datetime import datetime, timedelta
from pymongo import MongoClient
from bson import ObjectId

# Import database connection
from database import db

logger = logging.getLogger(__name__)

def update_session_statuses():
    """
    Update session statuses based on their time and current status.
    This should be run as a scheduled task:
    - Mark sessions as in_progress when they start
    - Mark sessions as completed when they end
    - Mark sessions as missed when they are not attended
    """
    now = datetime.utcnow()
    
    # Get sessions collection
    sessions_collection = db.therapy_sessions
    
    try:
        # Find scheduled sessions that should be in progress
        # (start time has passed, but end time hasn't, and status is scheduled)
        in_progress_updates = sessions_collection.update_many(
            {
                "status": "scheduled",
                "start_time": {"$lte": now},
                "end_time": {"$gt": now}
            },
            {"$set": {"status": "in_progress", "updated_at": now}}
        )
        
        logger.info(f"Updated {in_progress_updates.modified_count} sessions to in_progress")
        
        # Find sessions that have ended (end time has passed) and mark as completed
        completed_updates = sessions_collection.update_many(
            {
                "status": "in_progress",
                "end_time": {"$lte": now}
            },
            {
                "$set": {
                    "status": "completed", 
                    "updated_at": now,
                    "has_active_conversation": False  # Disable active messaging
                }
            }
        )
        
        logger.info(f"Updated {completed_updates.modified_count} sessions to completed")
        
        # Find scheduled sessions that were missed (start time passed over 15 minutes ago)
        fifteen_min_ago = now - timedelta(minutes=15)
        missed_updates = sessions_collection.update_many(
            {
                "status": "scheduled",
                "start_time": {"$lt": fifteen_min_ago},
                "$or": [
                    {"therapist_joined_at": {"$exists": False}},
                    {"client_joined_at": {"$exists": False}}
                ]
            },
            {"$set": {"status": "missed", "updated_at": now}}
        )
        
        logger.info(f"Marked {missed_updates.modified_count} sessions as missed")
        
    except Exception as e:
        logger.error(f"Error updating session statuses: {str(e)}")