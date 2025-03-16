from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash
import sys
import os

# Ensure we can import database.py
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../../")))
from database import db  # Import MongoDB connection

# User Collection
users_collection = db["users"]

class User:
    def __init__(self, username, email, phone, address, password, gender, 
                first_name=None, last_name=None, role="user", profile_picture=None, 
                bio=None, preferences=None, notification_settings=None, is_verified=False, therapist_id=None):
        self.username = username
        self.email = email
        self.phone = phone
        self.address = address
        self.password = generate_password_hash(password)  # Encrypt password
        self.gender = gender
        self.first_name = first_name  # Added field
        self.last_name = last_name    # Added field
        self.role = role  # "user", "therapist", or "admin"
        self.profile_picture = profile_picture  # Cloudinary URL
        self.bio = bio
        self.preferences = preferences or {
            "preferred_therapist_gender": None,
            "preferred_session_time": None,
            "preferred_session_type": "video",
            "topics_of_interest": []
        }
        # Rest of the initialization remains the same
        self.notification_settings = notification_settings or {
            "email": True, 
            "sms": False,
            "session_reminders": True
        }
        self.token = None  # For JWT or session management
        self.is_verified = is_verified
        self.created_at = datetime.utcnow()
        self.last_login = datetime.utcnow()
        self.therapist_id = None  # Reference to therapist ID if applicable

    def save(self):
        """ Save a new user to MongoDB """
        user_data = self.__dict__
        users_collection.insert_one(user_data)
        return user_data.get('_id')
    @staticmethod
    def find_by_token(token):
        """Find user by JWT token"""
        return users_collection.find_one({"token": token})

    @staticmethod
    def find_by_email(email):
        """ Find user by email """
        return users_collection.find_one({"email": email})
        
    @staticmethod
    def find_by_id(user_id):
        """ Find user by ID """
        from bson.objectid import ObjectId
        return users_collection.find_one({"_id": ObjectId(user_id)})

    @staticmethod
    def check_password(email, password):
        """ Check if password matches for user """
        user = User.find_by_email(email)
        if user:
            return check_password_hash(user["password"], password)
        return False

    @staticmethod
    def update_profile(email, updated_data):
        """ Update user profile """
        # Don't allow password updates through this method
        if "password" in updated_data:
            del updated_data["password"]
            
        users_collection.update_one({"email": email}, {"$set": updated_data})

    @staticmethod
    def update_password(email, new_password):
        """ Update user password """
        hashed_password = generate_password_hash(new_password)
        users_collection.update_one(
            {"email": email}, 
            {"$set": {"password": hashed_password}}
        )

    @staticmethod
    def delete_user(email):
        """ Delete a user """
        users_collection.delete_one({"email": email})
        
    @staticmethod
    def record_login(email):
        """ Record user login time """
        users_collection.update_one(
            {"email": email},
            {"$set": {"last_login": datetime.utcnow()}}
        )

    def __repr__(self):
        return f"<User {self.username} ({self.email})>"
    
    
    # Add this method at the end of the User class before __repr__

    @staticmethod
    def update_last_seen(user_id):
        """Update user's last seen timestamp"""
        from bson.objectid import ObjectId
        
        if isinstance(user_id, str):
            user_id = ObjectId(user_id)
            
        result = users_collection.update_one(
            {"_id": user_id},
            {"$set": {"last_seen": datetime.utcnow()}}
        )
        
        return result.modified_count > 0
# Add after the other static methods:

# Add this method to the User class

    @staticmethod
    def update_token(user_id, token, expires_at=None):
        """Update user's authentication token"""
        from bson import ObjectId
        
        update_data = {"token": token}
        if expires_at:
            update_data["token_expires"] = expires_at
        
        try:
            if isinstance(user_id, str) and len(user_id) == 24:
                users_collection.update_one(
                    {"_id": ObjectId(user_id)},
                    {"$set": update_data}
                )
            else:
                # For handling non-ObjectId identifiers
                users_collection.update_one(
                    {"email": user_id},
                    {"$set": update_data}
                )
            return True
        except Exception as e:
            print(f"Error updating token: {str(e)}")
            return False
        # Add this method if it doesn't exist:

    @staticmethod
    def update_profile(email_or_id, update_data):
        """Update user profile information"""
        from bson import ObjectId
        
        # Determine if the identifier is an email or ID
        if isinstance(email_or_id, str) and '@' in email_or_id:
            # It's an email
            filter_query = {"email": email_or_id}
        elif isinstance(email_or_id, str) and len(email_or_id) == 24:
            # It's an ObjectId string
            filter_query = {"_id": ObjectId(email_or_id)}
        elif isinstance(email_or_id, ObjectId):
            # It's already an ObjectId
            filter_query = {"_id": email_or_id}
        else:
            # Default to username
            filter_query = {"username": email_or_id}
            
        # Update the user document
        result = users_collection.update_one(
            filter_query,
            {"$set": {
                **update_data,
                "updated_at": datetime.utcnow()
            }}
        )
        
        return result.modified_count > 0