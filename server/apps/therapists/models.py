from datetime import datetime
import sys
import os

# Ensure we can import database.py
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../../")))
from database import db  # Import MongoDB connection

# Therapist Collection
therapists_collection = db["therapists"]

class Therapist:
    def __init__(self, user_id, hourly_rate, license_number, education, 
                experience=0, languages=None, specialization=None,
                bio=None, available_slots=None, rating=0, 
                is_verified=False, license_expiry=None):
        self.user_id = user_id  # Reference to the user ID
        self.specialization = specialization or []
        self.education = education  # List of education details
        self.license_number = license_number
        self.license_expiry = license_expiry
        self.hourly_rate = hourly_rate
        self.bio = bio
        self.languages = languages or ["English"]
        self.available_slots = available_slots or []  # List of time slots
        self.rating = rating  # Average rating from reviews
        self.rating_count = 0  # Number of ratings received
        self.is_verified = is_verified  # Admin verification flag
        self.focus_areas = []  # ["love", "anxiety", "work_stress", "depression", etc.]
        self.approach_methods = []  # ["cognitive_behavioral", "psychodynamic", etc.]
        self.success_stories = []  # Brief anonymized success stories
        self.certifications = []  # Additional certifications beyond education
        self.session_formats = ["video_messaging", "messaging_only"]  # Supported formats
        self.years_experience = experience  # Rename existing field for clarity
        self.created_at = datetime.utcnow()
        self.updated_at = datetime.utcnow()

    def save(self):
        """ Save therapist to MongoDB """
        therapist_data = self.__dict__
        result = therapists_collection.insert_one(therapist_data)
        return result.inserted_id
    
    
    @staticmethod  
    def find_by_id(therapist_id):
        """ Find therapist by ID """
        from bson.objectid import ObjectId
        if not isinstance(therapist_id, ObjectId):
            therapist_id = ObjectId(therapist_id)
        return therapists_collection.find_one({"_id": therapist_id})
        
    @staticmethod
    def find_by_user_id(user_id):
        """ Find therapist by user ID """
        from bson.objectid import ObjectId
        if not isinstance(user_id, ObjectId):
            user_id = ObjectId(user_id)
        return therapists_collection.find_one({"user_id": user_id})
        
    @staticmethod
    def get_all_therapists(limit=20, skip=0):
        """ Get all verified therapists """
        return list(therapists_collection.find(
            {"is_verified": True}
        ).skip(skip).limit(limit))
        
    @staticmethod
    def search_therapists(query, limit=20, skip=0):
        """ Search therapists by specialization or name """
        # This needs to join with users collection for name search
        return list(therapists_collection.find({
            "$or": [
                {"specializations": {"$regex": query, "$options": "i"}},
                {"languages": {"$regex": query, "$options": "i"}}
            ],
            "is_verified": True
        }).skip(skip).limit(limit))
        
    @staticmethod
    def update_availability(user_id, available_slots):
        """ Update therapist's availability schedule """
        from bson.objectid import ObjectId
        if not isinstance(user_id, ObjectId):
            user_id = ObjectId(user_id)
            
        therapists_collection.update_one(
            {"user_id": user_id},
            {"$set": {
                "available_slots": available_slots,
                "updated_at": datetime.utcnow()
            }}
        )
        
    @staticmethod
    def update_profile(user_id, update_data):
        """ Update therapist profile """
        from bson.objectid import ObjectId
        if not isinstance(user_id, ObjectId):
            user_id = ObjectId(user_id)
            
        if "hourly_rate" in update_data:
            update_data["hourly_rate"] = float(update_data["hourly_rate"])
            
        update_data["updated_at"] = datetime.utcnow()
        therapists_collection.update_one(
            {"user_id": user_id},
            {"$set": update_data}
        )
        
    @staticmethod
    def verify_therapist(user_id, verified=True):
        """ Admin function to verify therapist credentials """
        from bson.objectid import ObjectId
        if not isinstance(user_id, ObjectId):
            user_id = ObjectId(user_id)
            
        therapists_collection.update_one(
            {"user_id": user_id},
            {"$set": {
                "is_verified": verified,
                "updated_at": datetime.utcnow()
            }}
        )
        
    @staticmethod
    def add_rating(user_id, rating):
        """ Add a new rating to therapist profile """
        from bson.objectid import ObjectId
        if not isinstance(user_id, ObjectId):
            user_id = ObjectId(user_id)
            
        therapist = Therapist.find_by_user_id(user_id)
        if therapist:
            current_rating = therapist.get("rating", 0)
            count = therapist.get("rating_count", 0)
            
            # Calculate new average rating
            new_count = count + 1
            new_rating = ((current_rating * count) + rating) / new_count
            
            therapists_collection.update_one(
                {"user_id": user_id},
                {"$set": {
                    "rating": new_rating,
                    "rating_count": new_count,
                    "updated_at": datetime.utcnow()
                }}
            )
            return new_rating
        return None
    
    @staticmethod
    def update_therapist(user_id, updated_data):
        """Update therapist information"""
        return therapists_collection.update_one(
            {"user_id": user_id}, 
            {"$set": updated_data}
        )
        
        
    @staticmethod
    def update_rating(user_id, new_rating):
        """Update therapist rating"""
        return therapists_collection.update_one(
            {"user_id": user_id}, 
            {"$set": {"rating": new_rating}}
        )

    @staticmethod
    def find_by_user_id(user_id):
        """Find a therapist by their user ID"""
        from bson.objectid import ObjectId
        # Convert string ID to ObjectId if needed
        if isinstance(user_id, str) and ObjectId.is_valid(user_id):
            user_id = ObjectId(user_id)
            
        therapist = db.therapists.find_one({"user_id": user_id})
        
        # Also try with string ID if ObjectId search fails
        if not therapist and isinstance(user_id, ObjectId):
            therapist = db.therapists.find_one({"user_id": str(user_id)})
            
        return therapist

class TherapistAvailability:
    # Add working hours to availability model
    @staticmethod
    def get_working_hours(therapist_id):
        """Get therapist's defined working hours"""
        therapist = Therapist.find_by_id(therapist_id)
        if not therapist or not therapist.get("working_hours"):
            # Default working hours if not specified
            return {
                "monday": {"start": "09:00", "end": "17:00"},
                "tuesday": {"start": "09:00", "end": "17:00"},
                "wednesday": {"start": "09:00", "end": "17:00"},
                "thursday": {"start": "09:00", "end": "17:00"},
                "friday": {"start": "09:00", "end": "17:00"},
                "saturday": None,
                "sunday": None
            }
        return therapist.get("working_hours")
        
    @staticmethod
    def is_working_hours(therapist_id):
        """Check if current time is within therapist's working hours"""
        working_hours = TherapistAvailability.get_working_hours(therapist_id)
        
        # Get current day and time
        now = datetime.utcnow()
        day = now.strftime("%A").lower()
        
        # Check if day has working hours
        if not working_hours.get(day):
            return False
            
        # Parse working hours
        start_time = datetime.strptime(working_hours[day]["start"], "%H:%M").time()
        end_time = datetime.strptime(working_hours[day]["end"], "%H:%M").time()
        current_time = now.time()
        
        # Check if current time is within working hours
        return start_time <= current_time <= end_time