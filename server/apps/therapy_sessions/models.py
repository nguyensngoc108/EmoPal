from datetime import datetime, timedelta
from enum import Enum
from bson import ObjectId
import sys
import os
import logging
import traceback

# Import MongoDB connection
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../../")))
from database import db
# Configure logger
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Collections
# Collections
sessions_collection = db["therapy_sessions"]
availability_collection = db["therapist_availability"]
bookings_collection = db["session_bookings"]


class TherapistAvailability:
    def __init__(self, therapist_id, day_of_week, start_time, end_time, recurring=True):
        """
        Create availability record
        day_of_week: 0-6 (Monday-Sunday)
        start_time/end_time: Time in format "HH:MM"
        recurring: True for weekly recurring, False for one-time
        """
        self.therapist_id = therapist_id
        self.day_of_week = day_of_week
        self.start_time = start_time
        self.end_time = end_time
        self.recurring = recurring
        self.created_at = datetime.utcnow()
        self.updated_at = datetime.utcnow()
    
    def save(self):
        """Save availability to database"""
        availability_data = self.__dict__
        result = availability_collection.insert_one(availability_data)
        return result.inserted_id
        
    @staticmethod
    def find_by_id(availability_id):
        """Find availability slot by ID"""
        if isinstance(availability_id, str):
            availability_id = ObjectId(availability_id)
        return availability_collection.find_one({"_id": availability_id})
        
    @staticmethod
    def get_therapist_availability(therapist_id):
        """Get all availability slots for a therapist"""
        return list(availability_collection.find({"therapist_id": therapist_id}).sort("day_of_week", 1))
    
    @staticmethod
    def update_availability(availability_id, start_time=None, end_time=None, recurring=None):
        """Update an availability slot"""
        update_data = {"updated_at": datetime.utcnow()}
        
        if start_time is not None:
            update_data["start_time"] = start_time
        if end_time is not None:
            update_data["end_time"] = end_time
        if recurring is not None:
            update_data["recurring"] = recurring
            
        availability_collection.update_one(
            {"_id": ObjectId(availability_id)},
            {"$set": update_data}
        )
        
        return True
    
    @staticmethod
    def find_by_therapist_and_day(therapist_id, day_of_week):
        """Find availability slots for a therapist on a specific day"""
        if isinstance(therapist_id, str):
            therapist_id = ObjectId(therapist_id)
        return list(availability_collection.find({
            "therapist_id": therapist_id,
            "day_of_week": day_of_week
        }))
    
    @staticmethod
    def delete_availability(availability_id):
        """Delete an availability slot"""
        if isinstance(availability_id, str):
            availability_id = ObjectId(availability_id)
        return availability_collection.delete_one({"_id": availability_id})
        
    @staticmethod
    def check_availability(therapist_id, start_time, end_time, check_extended=False):
        """Check if therapist is available during proposed time"""
        # Convert to datetime objects if they're strings
        if isinstance(start_time, str):
            start_time = datetime.fromisoformat(start_time)
        
        if isinstance(end_time, str):
            end_time = datetime.fromisoformat(end_time)
            
        # 1. Check if this overlaps with any existing sessions
        existing_sessions = sessions_collection.find({
            "therapist_id": therapist_id,
            "status": {"$in": [
                SessionStatus.SCHEDULED,
                SessionStatus.ACCEPTED,
                SessionStatus.IN_PROGRESS
            ]},
            # Either start or end time falls within the proposed time slot
            "$or": [
                {"start_time": {"$lt": end_time, "$gte": start_time}},
                {"end_time": {"$gt": start_time, "$lte": end_time}},
                # Or the proposed time is completely within an existing session
                {
                    "start_time": {"$lte": start_time},
                    "end_time": {"$gte": end_time}
                }
            ]
        }).count()
        
        if existing_sessions > 0:
            return False
            
        # 2. Check against therapist's availability settings
        day_of_week = start_time.weekday()  # 0-6 for Monday-Sunday
        
        # Format times for comparison
        start_time_str = start_time.strftime("%H:%M")
        end_time_str = end_time.strftime("%H:%M")
        
        # Query to find matching availability
        query = {
            "therapist_id": therapist_id,
            "day_of_week": day_of_week,
            "start_time": {"$lte": start_time_str},
            "end_time": {"$gte": end_time_str}
        }
        
        # For extended sessions, also check that the slot supports them
        if check_extended:
            query["$or"] = [
                {"extended_session": True},
                {"max_duration_hours": {"$gte": (end_time - start_time).total_seconds() / 3600}}
            ]
            
        # Check if within therapist's available hours
        available = availability_collection.find_one(query)
        
        return available is not None
    
    @staticmethod
    def get_calendar(therapist_id, start_date, end_date):
        """Get therapist availability in calendar format for date range"""
        # Implementation for the missing method
        days = []
        current_date = start_date
        
        # Convert to datetime objects if they're strings
        if isinstance(start_date, str):
            start_date = datetime.fromisoformat(start_date.split('T')[0] + 'T00:00:00')
            
        if isinstance(end_date, str):
            end_date = datetime.fromisoformat(end_date.split('T')[0] + 'T23:59:59')
            
        current_date = start_date
        while current_date <= end_date:
            day_of_week = current_date.weekday()  # 0-6 for Monday-Sunday
            
            # Get availability slots for this day of week
            availability_slots = TherapistAvailability.find_by_therapist_and_day(therapist_id, day_of_week)
            
            # Format date string
            date_str = current_date.strftime("%Y-%m-%d")
            
            # Add date information to each slot
            for slot in availability_slots:
                slot_info = {
                    "availability_id": str(slot["_id"]),
                    "therapist_id": str(slot["therapist_id"]),
                    "day_of_week": slot["day_of_week"],
                    "start_time": slot["start_time"],
                    "end_time": slot["end_time"],
                    "date": date_str
                }
                days.append(slot_info)
                
            # Move to next day
            current_date += timedelta(days=1)
            
        return days

    @staticmethod
    def get_available_slots(therapist_id, start_date, end_date):
        """Get available time slots for a therapist within a date range"""
        
        # Convert therapist_id to ObjectId if it's a string
        if isinstance(therapist_id, str):
            try:
                therapist_id = ObjectId(therapist_id)
            except:
                # If conversion fails, try to find the therapist by user_id
                from apps.therapists.models import Therapist
                therapist = Therapist.find_by_user_id(therapist_id)
                if therapist:
                    therapist_id = therapist.get("_id")
        
        # Get the therapist's recurring availability
        recurring_slots = list(availability_collection.find({
            "therapist_id": therapist_id,
            "recurring": True
        }))
        
        # Get specific non-recurring slots in this date range
        specific_slots = list(availability_collection.find({
            "therapist_id": therapist_id,
            "recurring": False,
            "date": {"$gte": start_date, "$lte": end_date}
        }))
        
        # Find already booked sessions in this time range
        # FIXED: Remove incorrect import and use the existing sessions_collection
        booked_sessions = list(sessions_collection.find({
            "therapist_id": therapist_id,
            "start_time": {"$gte": start_date, "$lte": end_date},
            "status": {"$nin": ["cancelled", "declined"]}
        }))
        
        # Generate available slots from recurring schedule
        available_slots = []
        current_date = start_date
        
        while current_date <= end_date:
            # Get day of week (0 = Monday, 6 = Sunday)
            day_of_week = current_date.weekday()
            
            # Find recurring slots for this day
            day_slots = [slot for slot in recurring_slots if slot.get("day_of_week") == day_of_week]
            
            for slot in day_slots:
                # Parse time strings
                start_time_str = slot.get("start_time", "08:00")
                end_time_str = slot.get("end_time", "09:00")
                
                # Create datetime objects for this specific date
                start_hours, start_minutes = map(int, start_time_str.split(":"))
                end_hours, end_minutes = map(int, end_time_str.split(":"))
                
                slot_start = current_date.replace(hour=start_hours, minute=start_minutes)
                slot_end = current_date.replace(hour=end_hours, minute=end_minutes)
                
                # Skip if the slot is in the past
                if slot_start < datetime.now():
                    continue
                    
                # Check if this slot overlaps with any booked sessions
                is_available = True
                for session in booked_sessions:
                    session_start = session.get("start_time")
                    session_end = session.get("end_time")
                    
                    if (slot_start < session_end and slot_end > session_start):
                        is_available = False
                        break
                        
                if is_available:
                    available_slots.append({
                        "availability_id": slot.get("_id"),
                        "therapist_id": therapist_id,
                        "start_time": slot_start,
                        "end_time": slot_end,
                        "recurring": True,
                        "extended_session": slot.get("extended_session", False),  # Include extended session flag
                        "max_duration_hours": slot.get("max_duration_hours", 1),  # Include max duration
                        "session_types": slot.get("session_types", ["video"])  # Include supported session types
                    })
            
            # Add any non-recurring specific slots for this date
            for slot in specific_slots:
                slot_date = slot.get("date")
                if slot_date.date() == current_date.date():
                    available_slots.append({
                        "availability_id": slot.get("_id"),
                        "therapist_id": therapist_id,
                        "start_time": slot_date,
                        "end_time": slot_date + timedelta(hours=1),  # Assuming 1 hour sessions
                        "recurring": False
                    })
            
            # Move to next day
            current_date += timedelta(days=1)
        
        return available_slots


class SessionStatus(Enum):
    PROPOSED = "proposed"
    ACCEPTED = "accepted"
    PENDING_PAYMENT = "pending_payment"  # New status
    SCHEDULED = "scheduled"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    MISSED = "missed"

# Session type enum
class SessionType:
    VIDEO_MESSAGING = "video"
    VOICE_CALL = "voice"
    TEXT_CHAT = "text"

class TherapySession:
    collection = db.therapy_sessions
    
    def __init__(self,
                user_id,
                therapist_id,
                start_time,
                end_time,
                session_type,
                status=None,
                initiator="user",
                price=None,
                duration_hours=None):
        self.user_id = user_id
        self.therapist_id = therapist_id
        self.start_time = start_time
        self.end_time = end_time
        self.session_type = session_type
        # Set status directly to "pending_payment" to bypass therapist approval
        self.status = status or SessionStatus.PENDING_PAYMENT.value  
        self.initiator = initiator
        self.price = price
        self.duration_hours = duration_hours or (end_time - start_time).total_seconds() / 3600
        self.created_at = datetime.utcnow()
        self.updated_at = datetime.utcnow()
        self.notes = []
        self.tags = []
        
    def save(self):
        result = self.collection.insert_one(self.__dict__)
        return result.inserted_id
        
    @classmethod
    def find_by_id(cls, session_id):
        try:
            return cls.collection.find_one({"_id": ObjectId(session_id)})
        except Exception as e:
            print(f"Error finding session: {str(e)}")
            return None
    
    @classmethod
    def get_upcoming_sessions(cls, user_id, is_therapist=False):
        """Get upcoming sessions for a user or therapist"""
        try:
            now = datetime.now()
            
            # Define query based on user role
            query = {
                "therapist_id" if is_therapist else "user_id": ObjectId(user_id),
                "start_time": {"$gt": now},  # Sessions that haven't started yet
                "status": {"$in": ["scheduled", "accepted"]}  # Only include confirmed sessions
            }
            
            # Sort by soonest first
            cursor = cls.collection.find(query).sort("start_time", 1)
            
            # Return as list
            sessions = list(cursor)
            
            print(f"Found {len(sessions)} upcoming sessions")
            
            # Return empty list if no sessions found
            if not sessions:
                return []
                
            return sessions
        except Exception as e:
            # Log the error and return empty list as fallback
            print(f"Error in get_upcoming_sessions: {str(e)}")
            return []
    
    @classmethod
    def get_past_sessions(cls, user_id, is_therapist=False):
        """Get past sessions for a user or therapist"""
        try:
            now = datetime.now()
            
            # Define query based on user role
            query = {
                "therapist_id" if is_therapist else "user_id": ObjectId(user_id),
                "end_time": {"$lt": now}  # Sessions that have already ended
            }
            
            print(f"Querying past sessions with: {query}")
            
            # Sort by most recent first
            cursor = cls.collection.find(query).sort("end_time", -1)
            
            # Return as list
            sessions = list(cursor)
            
            print(f"Found {len(sessions)} past sessions")
            
            # Handle the case when no sessions found
            if not sessions:
                return []
                
            return sessions
        except Exception as e:
            print(f"Error in get_past_sessions: {str(e)}")
            return []  # Return empty list on error as a fallback
    
    def save(self):
        """Save session to database"""
        session_data = self.__dict__
        result = sessions_collection.insert_one(session_data)
        self.session_id = result.inserted_id
        return self.session_id
    
    @staticmethod
    def create_therapist_proposed_session(therapist_id, user_id, start_time, end_time,
                                         session_type, price):
        """Therapist proposes a session"""
        session = TherapySession(
            user_id=user_id,
            therapist_id=therapist_id,
            start_time=start_time,
            end_time=end_time,
            session_type=session_type,
            price=price,
            initiator="therapist",
            status=SessionStatus.PROPOSED
        )
        
        session_id = session.save()
        
        # Notify client (implementation depends on your notification system)
        # NotificationService.notify_client_new_session_proposal(session_id)
        
        return session_id
    
    @staticmethod
    def accept_proposed_session(session_id, accepted_by):
        """Accept a proposed session"""
   
        session = TherapySession.find_by_id(session_id)
        
        if not session:
            raise ValueError("Session not found")
            
        # Check if the right person is accepting
        if accepted_by == "user" and session.get("initiator") != "therapist":
            raise ValueError("Only users can accept therapist-proposed sessions")
            
        if accepted_by == "therapist" and session.get("initiator") != "user":
            raise ValueError("Only therapists can accept user-proposed sessions")
            
        # Update session status
        sessions_collection.update_one(
            {"_id": ObjectId(session_id)},
            {"$set": {
                "status": SessionStatus.ACCEPTED,
                "updated_at": datetime.utcnow()
            }}
        )
        
        # If accepted by therapist, the next step is user payment
        if accepted_by == "therapist":
            # NotificationService.notify_client_to_pay(session_id)
            pass
        
        return True
    
    @staticmethod
    def confirm_payment(session_id):
        """Update session status to scheduled after payment confirmed"""
        try:
            # Make sure we're working with string ID for consistency
            if not isinstance(session_id, str):
                session_id = str(session_id)
                
            logger.info(f"Confirming payment for session {session_id}")
                
            # Convert to ObjectId for MongoDB
            from bson import ObjectId
            obj_id = ObjectId(session_id)
                
            # Update the session status
            result = db.therapy_sessions.update_one(
                {"_id": obj_id},
                {
                    "$set": {
                        "status": "scheduled",
                        "payment_confirmed": True,
                        "updated_at": datetime.utcnow()
                    }
                }
            )
            
            # Check result
            if result.matched_count == 0:
                logger.error(f"No session found with ID {session_id}")
                return False
                
            if result.modified_count == 0:
                logger.warning(f"Session {session_id} found but status not updated")
                return False
                
            logger.info(f"Session {session_id} status updated to SCHEDULED after payment")
            return True
        except Exception as e:
            logger.error(f"Error confirming payment for session {session_id}: {str(e)}")
            return False
    
    @staticmethod
    def cancel_session(session_id, cancelled_by):
        """Cancel a session"""
        session = TherapySession.find_by_id(session_id)
        
        if not session:
            raise ValueError("Session not found")
            
        # Check cancellation deadline if already scheduled
        if session.get("status") == SessionStatus.SCHEDULED:
            now = datetime.utcnow()
            deadline = session.get("cancellation_deadline")
            
            if now > deadline:
                raise ValueError("Cannot cancel sessions less than 24 hours before start time")
        
        # Update session status
        sessions_collection.update_one(
            {"_id": ObjectId(session_id)},
            {"$set": {
                "status": SessionStatus.CANCELLED,
                "cancelled_by": cancelled_by,
                "cancelled_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }}
        )
        
        # Handle any refund logic here if needed
        
        # Notify the other party
        other_party = "therapist" if cancelled_by == "user" else "user"
        # NotificationService.notify_session_cancelled(session_id, other_party)
        
        return True
    
    @staticmethod
    def reschedule_session(session_id, new_start_time, new_end_time, requested_by):
        """Reschedule a session"""
        session = TherapySession.find_by_id(session_id)
        
        if not session:
            raise ValueError("Session not found")
            
        # Check rescheduling deadline if already scheduled
        if session.get("status") == SessionStatus.SCHEDULED:
            now = datetime.utcnow()
            deadline = session.get("start_time") - timedelta(hours=24)
            
            if now > deadline:
                raise ValueError("Cannot reschedule sessions less than 24 hours before start time")
        
        # If requested by user and therapist is initiator (or vice versa),
        # the request needs approval
        needs_approval = session.get("initiator") != requested_by
        
        new_status = session.get("status")
        if needs_approval:
            new_status = SessionStatus.PROPOSED
        
        # Update session with new times
        sessions_collection.update_one(
            {"_id": ObjectId(session_id)},
            {"$set": {
                "start_time": new_start_time,
                "end_time": new_end_time,
                "cancellation_deadline": new_start_time - timedelta(hours=24),
                "status": new_status,
                "rescheduled_by": requested_by,
                "rescheduled_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }}
        )
        
        # Notify the other party if approval needed
        if needs_approval:
            other_party = "therapist" if requested_by == "user" else "user"
            # NotificationService.notify_reschedule_request(session_id, other_party)
        
        return True
        
    @staticmethod
    def find_by_id(session_id):
        """Find a session by ID"""
        print(f"Finding session {session_id}")
        
        return sessions_collection.find_one({"_id": ObjectId(session_id)})
        
    @staticmethod
    def get_user_sessions(user_id, limit=10, skip=0):
        """Get sessions for a specific user"""
        if not isinstance(user_id, ObjectId):
            user_id = ObjectId(user_id)
            
        return list(sessions_collection.find(
            {"user_id": user_id}
        ).sort("start_time", -1).skip(skip).limit(limit))
        
    @staticmethod
    def get_therapist_sessions(therapist_id, limit=10, skip=0):
        """Get sessions for a specific therapist"""
        if not isinstance(therapist_id, ObjectId):
            therapist_id = ObjectId(therapist_id)
            
        return list(sessions_collection.find(
            {"therapist_id": therapist_id}
        ).sort("start_time", -1).skip(skip).limit(limit))
        
    @staticmethod
    def update_status(session_id, status):
        """Update session status"""
        sessions_collection.update_one(
            {"_id": ObjectId(session_id)},
            {"$set": {
                "status": status,
                "updated_at": datetime.utcnow()
            }}
        )
        
    @staticmethod
    def add_recording(session_id, recording_url):
        """Add recording URL to session"""
        sessions_collection.update_one(
            {"_id": ObjectId(session_id)},
            {"$set": {
                "recording_url": recording_url,
                "updated_at": datetime.utcnow()
            }}
        )
        
    @staticmethod
    def add_notes(session_id, notes):
        """Add therapist notes to session"""
        sessions_collection.update_one(
            {"_id": ObjectId(session_id)},
            {"$set": {
                "notes": notes,
                "updated_at": datetime.utcnow()
            }}
        )
        
    @staticmethod
    def add_feedback(session_id, feedback):
        """Add user feedback to session"""
        sessions_collection.update_one(
            {"_id": ObjectId(session_id)},
            {"$set": {
                "feedback": feedback,
                "updated_at": datetime.utcnow()
            }}
        )
        
    @staticmethod
    def find_by_user(user_id, status=None, limit=10, skip=0):
        """Find sessions for a specific user"""
        if isinstance(user_id, str):
            user_id = ObjectId(user_id)
            
        query = {"user_id": user_id}
        if status:
            query["status"] = status
            
        return list(sessions_collection.find(query).sort("start_time", -1).skip(skip).limit(limit))

    @staticmethod
    def find_by_therapist(therapist_id, status=None, limit=10, skip=0):
        """Find sessions for a specific therapist"""
        if isinstance(therapist_id, str):
            therapist_id = ObjectId(therapist_id)
            
        query = {"therapist_id": therapist_id}
        if status:
            query["status"] = status
            
        return list(sessions_collection.find(query).sort("start_time", -1).skip(skip).limit(limit))

    @staticmethod
    def setup_chat_for_session(session_id, user_id, therapist_id):
        """Creates a conversation for a therapy session after payment"""
        try:
            from apps.chat_messages.models import Conversation, Message
            from apps.users.models import User
            
            # Check if conversation already exists for this session
            existing = db.conversations.find_one({
                "session_id": session_id,
                "conversation_type": "therapy_session"
            })
            
            if existing:
                print(f"Using existing conversation: {existing['_id']} for session {session_id}")
                return str(existing["_id"])
            
            print(f"Creating new conversation for session {session_id}")
            
            # Important: Get the therapist's user_id instead of using therapist_id directly
            therapist_user_id = None
            
            # First try to find a user with this therapist_id in the "therapist_id" field
            therapist_user = db.users.find_one({"therapist_id": therapist_id})
            if therapist_user:
                therapist_user_id = str(therapist_user["_id"])
                print(f"Found therapist user via therapist_id reference: {therapist_user_id}")
            else:
                # If not found, try to find the therapist document and get its user_id
                therapist = db.therapists.find_one({"_id": ObjectId(therapist_id)})
                if therapist and "user_id" in therapist:
                    therapist_user_id = str(therapist["user_id"])
                    print(f"Found therapist user_id from therapists collection: {therapist_user_id}")
                else:
                    # Fallback - use therapist_id directly if we can't find a matching user
                    # (not ideal but prevents conversation creation failure)
                    therapist_user_id = therapist_id
                    print(f"Warning: Using therapist_id directly as fallback: {therapist_id}")
            
            # Create new conversation with user IDs for both participants
            conversation = Conversation(
                participants=[user_id, therapist_user_id],  # Both are user IDs now
                conversation_type="therapy_session",
                session_id=session_id
            )
            
            conversation_id = conversation.save()
            
            # Create welcome system message
            session = TherapySession.find_by_id(session_id)
            if session:
                session_date = session.get("start_time").strftime("%A, %B %d at %I:%M %p")
                welcome_message = Message(
                    conversation_id=conversation_id,
                    sender_id="system",
                    content=f"Your therapy session has been confirmed for {session_date}. You can use this chat to communicate before and after your session.",
                    message_type="system"
                )
                welcome_message.save()
            
            # Update session to include conversation ID
            db.therapy_sessions.update_one(
                {"_id": ObjectId(session_id)},
                {
                    "$set": {
                        "conversation_id": conversation_id,
                        "has_active_conversation": True,
                        "updated_at": datetime.utcnow()
                    }
                }
            )
            
            print(f"Created conversation {conversation_id} for session {session_id} between user {user_id} and therapist user {therapist_user_id}")
            return conversation_id
            
        except Exception as e:
            print(f"Error setting up chat for session {session_id}: {str(e)}")
            traceback.print_exc()  # Add full traceback for better debugging
            return None
        
    @staticmethod
    def create_user_proposed_session(user_id, therapist_id, start_time, end_time, 
                                    session_type, price=None, duration_hours=1):
        """Client requests a session"""
        # Validate session type and duration
        if duration_hours > 1 and session_type != "text":
            raise ValueError("Extended sessions are only available for messaging format")
        
        # Validate availability first with the full duration
        if not TherapistAvailability.check_availability(therapist_id, start_time, end_time, check_extended=duration_hours > 1):
            raise ValueError("Therapist is not available during the requested time")
            
        session = TherapySession(
            user_id=user_id,
            therapist_id=therapist_id,
            start_time=start_time,
            end_time=end_time,
            session_type=session_type,
            price=price,
            initiator="user",
            status=SessionStatus.PROPOSED,
            duration_hours=duration_hours
        )
        
        session_id = session.save()
        
        # Notify therapist (implementation depends on your notification system)
        # NotificationService.notify_therapist_new_session_request(session_id)
        
        return session_id

    @staticmethod
    def update_conversation_id(session_id, conversation_id):
        """Update session with conversation ID reference"""
        try:
            if isinstance(session_id, str):
                session_id = ObjectId(session_id)
                
            db.therapy_sessions.update_one(
                {"_id": session_id},
                {
                    "$set": {
                        "conversation_id": str(conversation_id),
                        "has_active_conversation": True,
                        "updated_at": datetime.utcnow()
                    }
                }
            )
            return True
        except Exception as e:
            print(f"Error updating session with conversation ID: {e}")
            return False

    @staticmethod
    def find_by_id(session_id):
        """Find session by ID"""
        from bson import ObjectId
        
        # Handle both string and ObjectId
        if isinstance(session_id, str):
            try:
                session_id = ObjectId(session_id)
            except:
                # If conversion fails, keep as string
                pass
        
        return db.therapy_sessions.find_one({"_id": session_id})

# Add these additional enums
class PlanType:
    TEXT_ONLY = "text_only"        # Just messaging
    STANDARD = "standard"          # Messaging + limited video 
    PREMIUM = "premium"            # Messaging + more video

class PlanDuration:
    WEEKLY = "weekly"              # 7 days
    BI_WEEKLY = "bi_weekly"        # 14 days
    MONTHLY = "monthly"            # 30 days

class TherapyPlan:
    def __init__(self, user_id, therapist_id, plan_type, duration, 
                 video_sessions_allowed=0, start_date=None):
        self.user_id = ObjectId(user_id)
        self.therapist_id = ObjectId(therapist_id)
        self.plan_type = plan_type
        self.duration = duration
        self.video_sessions_allowed = video_sessions_allowed
        self.video_sessions_used = 0
        self.start_date = start_date or datetime.utcnow()
        self.end_date = self.calculate_end_date()
        self.status = "active"
        self.created_at = datetime.utcnow()
        self.payment_id = None

    def calculate_end_date(self):
        if self.duration == PlanDuration.WEEKLY:
            return self.start_date + timedelta(days=7)
        elif self.duration == PlanDuration.BI_WEEKLY:
            return self.start_date + timedelta(days=14)
        elif self.duration == PlanDuration.MONTHLY:
            return self.start_date + timedelta(days=30)
        return self.start_date + timedelta(days=7)  # Default to weekly
        
    def save(self):
        plan_data = self.__dict__
        result = db["therapy_plans"].insert_one(plan_data)
        return result.inserted_id

    @staticmethod
    def get_active_plan(user_id, therapist_id):
        """Get active therapy plan between user and therapist"""
        now = datetime.utcnow()
        return db["therapy_plans"].find_one({
            "user_id": ObjectId(user_id),
            "therapist_id": ObjectId(therapist_id),
            "status": "active",
            "end_date": {"$gt": now}
        })

    @staticmethod
    def schedule_video_session(plan_id, start_time, duration=1):
        """Create a video session within an existing plan"""
        plan = db["therapy_plans"].find_one({"_id": ObjectId(plan_id)})
        
        if not plan:
            raise ValueError("Plan not found")
            
        if plan["video_sessions_used"] >= plan["video_sessions_allowed"]:
            raise ValueError("All allowed video sessions have been used")
            
        # Create a session
        session = TherapySession(
            user_id=plan["user_id"],
            therapist_id=plan["therapist_id"],
            start_time=start_time,
            end_time=start_time + timedelta(hours=duration),
            session_type=SessionType.VIDEO_MESSAGING,
            status=SessionStatus.SCHEDULED,
            plan_id=plan_id
        )
        
        session_id = session.save()
        
        # Update used session count
        db["therapy_plans"].update_one(
            {"_id": ObjectId(plan_id)},
            {"$inc": {"video_sessions_used": 1}}
        )
        
        return session_id

# Add a new model for session notes with type support
class SessionNote:
    def __init__(self, session_id, author_id, content, note_type='post_session'):
        self.session_id = session_id
        self.author_id = author_id
        self.content = content
        self.note_type = note_type  # 'preparation', 'in_session', 'post_session'
        self.created_at = datetime.utcnow()
        
    def save(self):
        note_data = self.__dict__
        result = db.session_notes.insert_one(note_data)
        return result.inserted_id
        
    @staticmethod
    def find_by_session(session_id):
        """Get all notes for a specific session"""
        return list(db.session_notes.find({"session_id": session_id}).sort("created_at", 1))