import os
from pymongo import MongoClient
import logging

logger = logging.getLogger(__name__)

def get_db_client():
    """Get MongoDB client with connection retry logic"""
    try:
        # Get connection string from environment or use default
        mongo_uri = os.environ.get('MONGO_URI', 'mongodb+srv://nguyensngoc12:65smbABwDralpSmf@individualserver.byohaww.mongodb.net/')
        
        # Connect with appropriate timeouts and retry options
        client = MongoClient(
            mongo_uri,
            serverSelectionTimeoutMS=5000,
            connectTimeoutMS=5000,
            socketTimeoutMS=10000,
            maxPoolSize=50
        )
        
        # Test connection
        client.admin.command('ping')
        logger.info("Connected to MongoDB successfully")
        return client
    except Exception as e:
        logger.error(f"MongoDB connection error: {str(e)}")
        raise

# Create connection
client = get_db_client()

# Get database instance
db = client[os.environ.get('MONGO_DB', 'therapy_app_db')]

# Define collections
users_collection = db["users"]
therapists_collection = db["therapists"]
sessions_collection = db["therapy_sessions"] 
messages_collection = db["messages"]
feedback_collection = db["therapist_feedback"]
emotion_analyses_collection = db["emotion_analyses"]
media_storage_collection = db["media_storage"]  # New collection

# Add this to your database initialization
try:
    db.payments.create_index([("checkout_session_id", 1)], unique=True)
    print("Created unique index on payments.checkout_session_id")
except Exception as e:
    print(f"Note: {str(e)}")