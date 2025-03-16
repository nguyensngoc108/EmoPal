import json
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
from bson import ObjectId
import sys
import os
from datetime import datetime, timedelta
import logging

# Configure logger
logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.ERROR)

# Add this import at the top with other imports
from apps.payments.services import PaymentService

# Import models
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../../")))
from apps.users.models import User
from apps.therapists.models import Therapist
from apps.therapy_sessions.models import TherapySession, TherapistAvailability, SessionStatus, SessionType
from apps.utils.media_helper import MediaStorage
from apps.utils.image_helper import upload_to_cloudinary
from apps.utils.auth import get_user_from_request
from apps.utils.image_helper import get_file_extension, determine_media_type
from database import db  # Import MongoDB connection
# # Helper functions
# def get_user_from_request(request):
#     """Extract user from session/token in request"""
#     user_id = request.session.get('user_id')
#     if user_id:
#         return User.find_by_id(user_id)
#     return None

# try:
#     from agora_token_builder import RtcTokenBuilder, RtcRole
#     AGORA_TOKEN_AVAILABLE = True
# except ImportError:
#     AGORA_TOKEN_AVAILABLE = False
    
def convert_objectid(obj):
    if isinstance(obj, dict):
        for k, v in obj.items():
            if isinstance(v, ObjectId):
                obj[k] = str(v)
            elif isinstance(v, dict):
                convert_objectid(v)
    return obj
    

def convert_object_ids(obj):
    """Convert MongoDB ObjectIds to strings"""
    if isinstance(obj, dict):
        for k, v in obj.items():
            if isinstance(v, ObjectId):
                obj[k] = str(v)
            elif isinstance(v, dict) or isinstance(v, list):
                convert_object_ids(v)
    elif isinstance(obj, list):
        for i, item in enumerate(obj):
            if isinstance(item, ObjectId):
                obj[i] = str(item)
            elif isinstance(item, dict) or isinstance(item, list):
                convert_object_ids(item)
    return obj


@csrf_exempt
@require_http_methods(["POST"])
def request_session(request):
    try:
        # Authenticate user
        current_user = get_user_from_request(request)
        if not current_user:
            return JsonResponse({
                "success": False,
                "message": "Authentication required"
            }, status=401)
        
        user_id = str(current_user.get("_id"))
        data = json.loads(request.body)
        
        # Required fields
        therapist_id = data.get("therapist_id")
        start_time = datetime.fromisoformat(data.get("start_time"))
        end_time = datetime.fromisoformat(data.get("end_time"))
        session_type = data.get("session_type")
        
        # Get duration in hours (new)
        duration_hours = data.get("duration_hours", 1)
        if not duration_hours:
            # Calculate from start and end time if not provided
            duration_hours = (end_time - start_time).total_seconds() / 3600
        
        # Validate session type and duration (new)
        if duration_hours > 1 and session_type != SessionType.TEXT_CHAT.value:
            return JsonResponse({
                "success": False,
                "message": "Extended sessions (over 1 hour) are only available for messaging format"
            }, status=400)
        
        # Check if requested duration exceeds maximum allowed (new)
        if duration_hours > 4:
            return JsonResponse({
                "success": False,
                "message": "Session duration cannot exceed 4 hours"
            }, status=400)
        
        # Optional fields
        proposed_price = data.get("proposed_price")
        
        # Validate basic inputs
        if not all([therapist_id, start_time, end_time, session_type]):
            return JsonResponse({
                "success": False,
                "message": "Missing required fields"
            }, status=400)
        
        # Validate session type
        if session_type not in [t.value for t in SessionType]:
            return JsonResponse({
                "success": False,
                "message": f"Invalid session type. Must be one of: {', '.join([t.value for t in SessionType])}"
            }, status=400)
        
        # Create proposed session with duration information
        session_id = TherapySession.create_user_proposed_session(
            user_id=user_id,
            therapist_id=therapist_id,
            start_time=start_time,
            end_time=end_time,
            session_type=session_type,
            price=proposed_price,
            duration_hours=duration_hours  # Pass duration to session creation
        )
        
        return JsonResponse({
            "success": True,
            "message": "Session request sent to therapist",
            "session_id": str(session_id)
        }, status=201)
        
    except ValueError as e:
        return JsonResponse({
            "success": False,
            "message": str(e)
        }, status=400)
    except Exception as e:
        return JsonResponse({
            "success": False,
            "message": str(e)
        }, status=500)

@csrf_exempt
@require_http_methods(["POST"])
def propose_session(request):
    """Therapist proposes a session to a client"""
    try:
        # Authenticate therapist
        current_user = get_user_from_request(request)
        if not current_user or current_user.get("role") != "therapist":
            return JsonResponse({
                "success": False,
                "message": "Authentication required as therapist"
            }, status=401)
        
        therapist_id = str(current_user.get("_id"))
        data = json.loads(request.body)
        
        # Required fields
        user_id = data.get("user_id")
        start_time = datetime.fromisoformat(data.get("start_time"))
        end_time = datetime.fromisoformat(data.get("end_time"))
        session_type = data.get("session_type")
        price = data.get("price")
        
        # Validate inputs
        if not all([user_id, start_time, end_time, session_type, price]):
            return JsonResponse({
                "success": False,
                "message": "Missing required fields"
            }, status=400)
        
        # Create proposed session
        session_id = TherapySession.create_therapist_proposed_session(
            therapist_id=therapist_id,
            user_id=user_id,
            start_time=start_time,
            end_time=end_time,
            session_type=session_type,
            price=price
        )
        
        return JsonResponse({
            "success": True,
            "message": "Session proposal sent to client",
            "session_id": str(session_id)
        }, status=201)
        
    except ValueError as e:
        return JsonResponse({
            "success": False,
            "message": str(e)
        }, status=400)
    except Exception as e:
        return JsonResponse({
            "success": False,
            "message": str(e)
        }, status=500)

@csrf_exempt
@require_http_methods(["POST"])
def accept_session(request, session_id):
    """Accept a proposed session"""
    try:
        # Authenticate user
        current_user = get_user_from_request(request)
        if not current_user:
            return JsonResponse({
                "success": False,
                "message": "Authentication required"
            }, status=401)
        
        user_id = str(current_user.get("_id"))
        role = current_user.get("role")
        
        # Get session
        session = TherapySession.find_by_id(session_id)
        if not session:
            return JsonResponse({
                "success": False,
                "message": "Session not found"
            }, status=404)
        
        # Check if user is authorized
        if role == "therapist" and str(session.get("therapist_id")) != user_id:
            return JsonResponse({
                "success": False,
                "message": "You are not the therapist for this session"
            }, status=403)
            
        if role == "user" and str(session.get("user_id")) != user_id:
            return JsonResponse({
                "success": False,
                "message": "You are not the client for this session"
            }, status=403)
        
        # Accept the session
        TherapySession.accept_proposed_session(
            session_id=session_id,
            accepted_by=role
        )
        
        return JsonResponse({
            "success": True,
            "message": "Session accepted successfully"
        })
        
    except ValueError as e:
        return JsonResponse({
            "success": False,
            "message": str(e)
        }, status=400)
    except Exception as e:
        return JsonResponse({
            "success": False,
            "message": str(e)
        }, status=500)

@csrf_exempt
@require_http_methods(["POST"])
def book_session(request):
    """Book a therapy session"""
    try:
        # Check authentication
        current_user = get_user_from_request(request)
        if not current_user:
            return JsonResponse({
                "success": False,
                "message": "Authentication required"
            }, status=401)
            
        user_id = str(current_user.get("_id"))
        data = json.loads(request.body)
        
        # Required fields
        therapist_id = data.get("therapist_id")
        start_time = data.get("start_time")
        end_time = data.get("end_time")
        session_type = data.get("session_type", "video")
        
        # Validation
        if not therapist_id or not start_time or not end_time:
            return JsonResponse({
                "success": False,
                "message": "Therapist ID, start time and end time are required"
            }, status=400)
            
        # Convert string dates to datetime objects
        start_time = datetime.fromisoformat(start_time.replace('Z', '+00:00'))
        end_time = datetime.fromisoformat(end_time.replace('Z', '+00:00'))
        
        # Find therapist
        therapist = None
        try:
            # Try by _id first
            therapist = db.therapists.find_one({"_id": ObjectId(therapist_id)})
            # If not found, try by user_id
            if not therapist:
                therapist = Therapist.find_by_user_id(therapist_id)
        except:
            # On any error, try as user_id
            therapist = Therapist.find_by_user_id(therapist_id)
            
        if not therapist:
            return JsonResponse({
                "success": False,
                "message": "Therapist not found"
            }, status=404)
        
        # Calculate session price
        hourly_rate = therapist.get("hourly_rate", 75)
        duration_hours = (end_time - start_time).total_seconds() / 3600
        session_price = hourly_rate * duration_hours
        
        # Create session with PENDING_PAYMENT status
        session = TherapySession(
            user_id=user_id,
            therapist_id=str(therapist.get("_id") if "_id" in therapist else therapist_id),
            start_time=start_time,
            end_time=end_time,
            session_type=session_type,
            status=SessionStatus.PENDING_PAYMENT.value,
            price=session_price,
            duration_hours=duration_hours
        )
        
        session_id = session.save()
        
        return JsonResponse({
            "success": True,
            "session_id": str(session_id),
            "message": "Session booked successfully"
        }, status=201)
        
    except Exception as e:
        return JsonResponse({
            "success": False,
            "message": str(e)
        }, status=500)

@require_http_methods(["GET"])
def get_user_sessions(request):
    """Get all sessions for the current user"""
    try:
        # Check authentication
        current_user = get_user_from_request(request)
        if not current_user:
            return JsonResponse({
                "success": False,
                "message": "Authentication required"
            }, status=401)
            
        user_id = str(current_user.get("_id"))
        
        # Get query parameters
        status = request.GET.get("status")
        limit = int(request.GET.get("limit", 10))
        skip = int(request.GET.get("skip", 0))
        
        # Get sessions
        sessions = TherapySession.find_by_user(user_id, status, limit, skip)
        
        # Convert ObjectIds
        result = []
        for session in sessions:
            session = convert_object_ids(session)
            
            # Add therapist info
            therapist_user = User.find_by_id(session["therapist_id"])
            if therapist_user:
                session["therapist_name"] = therapist_user.get("username")
                
            result.append(session)
        
        return JsonResponse({
            "success": True,
            "count": len(result),
            "sessions": result
        })
        
    except Exception as e:
        return JsonResponse({
            "success": False,
            "message": str(e)
        }, status=500)

@require_http_methods(["GET"])
def get_therapist_sessions(request):
    """Get all sessions for the therapist (if current user is a therapist)"""
    try:
        # Check authentication
        current_user = get_user_from_request(request)
        if not current_user:
            return JsonResponse({
                "success": False,
                "message": "Authentication required"
            }, status=401)
            
        user_id = str(current_user.get("_id"))
        
        # Check if user is a therapist
        if current_user.get("role") != "therapist":
            return JsonResponse({
                "success": False,
                "message": "Only therapists can access this endpoint"
            }, status=403)
            
        # Get query parameters
        status = request.GET.get("status")
        limit = int(request.GET.get("limit", 10))
        skip = int(request.GET.get("skip", 0))
        
        # Get sessions
        sessions = TherapySession.find_by_therapist(user_id, status, limit, skip)
        
        # Convert ObjectIds and add user info
        result = []
        for session in sessions:
            session = convert_object_ids(session)
            
            # Add client info
            client = User.find_by_id(session["user_id"])
            if client:
                session["client_name"] = client.get("username")
                
            result.append(session)
        
        return JsonResponse({
            "success": True,
            "count": len(result),
            "sessions": result
        })
        
    except Exception as e:
        return JsonResponse({
            "success": False,
            "message": str(e)
        }, status=500)

@require_http_methods(["GET"])
def get_session_details(request, session_id):
    """Get details for a specific session"""
    try:
        # Check authentication
        current_user = get_user_from_request(request)
        if not current_user:
            return JsonResponse({
                "success": False,
                "message": "Authentication required"
            }, status=401)
            
        user_id = str(current_user.get("_id"))
        user_role = current_user.get("role")
        
        print(f"User accessing session {session_id}: ID={user_id}, role={user_role}")
        
        # Get session
        session = TherapySession.find_by_id(session_id)
        if not session:
            print(f"Session {session_id} not found")
            return JsonResponse({
                "success": False,
                "message": "Session not found"
            }, status=404)
            
        # Convert IDs to strings for consistent comparison
        session_user_id = str(session.get("user_id"))
        session_therapist_id = str(session.get("therapist_id"))
        session_type = session.get("session_type")
        
        print(f"Session participants: user_id={session_user_id}, therapist_id={session_therapist_id}")
        
        # Initialize access flag
        has_access = False
        
        # Direct ID match for all users (standard check)
        if (user_id == session_user_id or user_id == session_therapist_id or user_role == "admin"):
            has_access = True
            print(f"Access granted via direct ID match: {user_id}")
        
        # If user is a therapist, we need special handling
        elif user_role == "therapist":
            print("Checking therapist access paths...")
            
            # Check for therapist_id in user document
            therapist_id = current_user.get("therapist_id")
            if therapist_id:
                therapist_id = str(therapist_id)
                print(f"Found therapist_id in user document: {therapist_id}")
                
                if therapist_id == session_therapist_id:
                    has_access = True
                    print(f"Access granted via therapist_id from user document: {therapist_id}")
            
            # If therapist_id not in user document, look it up in the therapists collection
            if not has_access:
                try:
                    from apps.therapists.models import Therapist
                    therapist = Therapist.find_by_user_id(user_id)
                    
                    if therapist:
                        therapist_id = str(therapist.get("_id"))
                        print(f"Found therapist_id from lookup: {therapist_id}")
                        
                        if therapist_id == session_therapist_id:
                            has_access = True
                            print(f"Access granted via therapist_id from lookup: {therapist_id}")
                except Exception as e:
                    print(f"Error during therapist lookup: {str(e)}")
        
        # Deny access if not authorized after all checks
        if not has_access:
            print(f"Access denied to session {session_id} for user {user_id}")
            return JsonResponse({
                "success": False,
                "message": "You're not authorized to view this session"
            }, status=403)
            
        # Convert ObjectIds to strings for JSON serialization
        session = convert_object_ids(session)
        
        # Add user info
        client = User.find_by_id(session["user_id"])
        
        # For the therapist info, first try using the therapist_id directly
        therapist_user = User.find_by_id(session["therapist_id"])
        
        # If not found, try to find the user associated with this therapist
        if not therapist_user:
            from apps.therapists.models import Therapist
            therapist = db.therapists.find_one({"_id": ObjectId(session["therapist_id"])})
            if therapist and "user_id" in therapist:
                therapist_user = User.find_by_id(therapist["user_id"])
        
        if client:
            session["client_name"] = client.get("username") or f"{client.get('first_name', '')} {client.get('last_name', '')}".strip()
        if therapist_user:
            session["therapist_name"] = therapist_user.get("username") or f"{therapist_user.get('first_name', '')} {therapist_user.get('last_name', '')}".strip()
            
        return JsonResponse({
            "success": True,
            "session": session
        })
        
    except Exception as e:
        print(f"Error in get_session_details: {str(e)}")
        import traceback
        traceback.print_exc()
        return JsonResponse({
            "success": False,
            "message": str(e)
        }, status=500)

@csrf_exempt
@require_http_methods(["PUT"])
def update_session_status(request, session_id):
    """Update session status"""
    try:
        # Check authentication
        current_user = get_user_from_request(request)
        if not current_user:
            return JsonResponse({
                "success": False,
                "message": "Authentication required"
            }, status=401)
            
        user_id = str(current_user.get("_id"))
        user_role = current_user.get("role")
        
        data = json.loads(request.body)
        new_status = data.get("status")
        
        if not new_status:
            return JsonResponse({
                "success": False,
                "message": "Status is required"
            }, status=400)
            
        # Get session
        session = TherapySession.find_by_id(session_id)
        if not session:
            return JsonResponse({
                "success": False,
                "message": "Session not found"
            }, status=404)
            
        # Check authorization - only the client, therapist, or admin can update session status
        # if (user_id != str(session["user_id"]) and 
        #     user_id != str(session["therapist_id"]) and 
        #     user_role != "admin"):
        #     return JsonResponse({
        #         "success": False,
        #         "message": "You're not authorized to update this session"
        #     }, status=403)
            
        # Update status
        TherapySession.update_status(session_id, new_status)
        
        return JsonResponse({
            "success": True,
            "message": f"Session status updated to {new_status}"
        })
        
    except Exception as e:
        return JsonResponse({
            "success": False,
            "message": str(e)
        }, status=500)

@csrf_exempt
@require_http_methods(["PUT"])
def add_session_notes(request, session_id):
    """Add therapist notes to a session"""
    try:
        # Check authentication
        current_user = get_user_from_request(request)
        if not current_user:
            return JsonResponse({
                "success": False,
                "message": "Authentication required"
            }, status=401)
            
        user_id = str(current_user.get("_id"))
        
        # Check if user is a therapist
        if current_user.get("role") != "therapist":
            return JsonResponse({
                "success": False,
                "message": "Only therapists can add session notes"
            }, status=403)
            
        data = json.loads(request.body)
        notes = data.get("notes")
        
        if not notes:
            return JsonResponse({
                "success": False,
                "message": "Notes are required"
            }, status=400)
            
        # Add notes
        result = TherapySession.add_notes(session_id, user_id, notes)
        
        if result.modified_count == 0:
            return JsonResponse({
                "success": False,
                "message": "Session not found or you're not the therapist for this session"
            }, status=404)
            
        return JsonResponse({
            "success": True,
            "message": "Session notes added successfully"
        })
        
    except Exception as e:
        return JsonResponse({
            "success": False,
            "message": str(e)
        }, status=500)

@csrf_exempt
@require_http_methods(["POST"])
def cancel_session(request, session_id):
    """Cancel a session"""
    try:
        # Check authentication
        current_user = get_user_from_request(request)
        if not current_user:
            return JsonResponse({
                "success": False,
                "message": "Authentication required"
            }, status=401)
            
        user_id = str(current_user.get("_id"))
        
        # Get session
        session = TherapySession.find_by_id(session_id)
        if not session:
            return JsonResponse({
                "success": False,
                "message": "Session not found"
            }, status=404)
            
        # Check authorization - only the client or therapist can cancel
        if user_id != str(session["user_id"]) and user_id != str(session["therapist_id"]):
            return JsonResponse({
                "success": False,
                "message": "You're not authorized to cancel this session"
            }, status=403)
            
        # Check if session status is "scheduled" (can only cancel upcoming sessions)
        if session["status"] != "scheduled":
            return JsonResponse({
                "success": False,
                "message": "Only scheduled sessions can be cancelled"
            }, status=400)
            
        # Cancel session
        result = TherapySession.cancel_session(session_id, user_id)
        
        if result.modified_count == 0:
            return JsonResponse({
                "success": False,
                "message": "Failed to cancel session"
            }, status=500)
            
        return JsonResponse({
            "success": True,
            "message": "Session cancelled successfully"
        })
        
    except Exception as e:
        return JsonResponse({
            "success": False,
            "message": str(e)
        }, status=500)
        

# Add this new function to the sessions views
@csrf_exempt
@require_http_methods(["POST"])
def upload_session_recording(request, session_id):
    """Upload a session recording"""
    try:
        # Check authentication
        current_user = get_user_from_request(request)
        if not current_user:
            return JsonResponse({
                "success": False,
                "message": "Authentication required"
            }, status=401)
            
        user_id = str(current_user.get("_id"))
        username = current_user.get("username")
        
        # Check if user is associated with this session
        session = TherapySession.find_by_id(session_id)
        if not session:
            return JsonResponse({
                "success": False,
                "message": "Session not found"
            }, status=404)
            
        # Only allow the therapist to upload recordings
        if str(session["therapist_id"]) != user_id:
            return JsonResponse({
                "success": False,
                "message": "Only the therapist can upload session recordings"
            }, status=403)
            
        if 'recording_file' in request.FILES:
            recording_file = request.FILES['recording_file']
            
            # Check file extension
            extension = get_file_extension(recording_file.name)
            media_type = determine_media_type(extension)
            
            if (media_type != "video"):
                return JsonResponse({
                    "success": False,
                    "message": "Only video files are allowed for session recordings"
                }, status=400)
                
            # Upload to Cloudinary
            upload_result = upload_to_cloudinary(
                recording_file, 
                username, 
                folder="session_recordings"
            )
            
            if not upload_result:
                return JsonResponse({
                    "success": False,
                    "message": "Failed to upload recording"
                }, status=500)
                
            # Save to media storage collection
            media_storage = MediaStorage(
                user_id=user_id,
                media_type="video",
                media_url=upload_result["url"],
                public_id=upload_result["public_id"],
                media_category="session_recording",
                filename=recording_file.name,
                metadata={
                    "width": upload_result.get("width"),
                    "height": upload_result.get("height"),
                    "format": upload_result.get("format"),
                    "size": recording_file.size,
                    "duration": upload_result.get("duration")
                },
                session_id=session_id
            )
            
            media_id = media_storage.save()
            
            # Update session with recording URL
            TherapySession.add_recording(session_id, upload_result["url"])
            
            return JsonResponse({
                "success": True,
                "media_id": str(media_id),
                "recording_url": upload_result["url"],
                "message": "Session recording uploaded successfully"
            })
            
        else:
            return JsonResponse({
                "success": False,
                "message": "No recording file provided"
            }, status=400)
            
    except Exception as e:
        return JsonResponse({
            "success": False,
            "message": str(e)
        }, status=500)
        
@csrf_exempt
@require_http_methods(["POST"])
def confirm_payment(request, session_id):
    """Confirm payment for a session"""
    try:
        # Check authentication
        current_user = get_user_from_request(request)
        if not current_user:
            return JsonResponse({
                "success": False,
                "message": "Authentication required"
            }, status=401)
            
        user_id = str(current_user.get("_id"))
        
        # Get session
        session = TherapySession.find_by_id(session_id)
        if not session:
            return JsonResponse({
                "success": False,
                "message": "Session not found"
            }, status=404)
        
        # Check authorization - only the client can confirm payment
        if user_id != str(session["user_id"]):
            return JsonResponse({
                "success": False,
                "message": "Only the client can confirm payment"
            }, status=403)
            
        # Check if session is in ACCEPTED state
        if session["status"] != SessionStatus.ACCEPTED.value:
            return JsonResponse({
                "success": False,
                "message": "Session must be in ACCEPTED state to process payment"
            }, status=400)
            
        # Process payment (in a real app, you'd integrate with a payment gateway)
        # For now, we'll just simulate successful payment
        
        # Update session status
        TherapySession.confirm_payment(session_id)
        
        return JsonResponse({
            "success": True,
            "message": "Payment confirmed, session scheduled"
        })
        
    except Exception as e:
        return JsonResponse({
            "success": False,
            "message": str(e)
        }, status=500)

@csrf_exempt
@require_http_methods(["POST"])
def reschedule_session(request, session_id):
    """Reschedule a session"""
    try:
        # Check authentication
        current_user = get_user_from_request(request)
        if not current_user:
            return JsonResponse({
                "success": False,
                "message": "Authentication required"
            }, status=401)
            
        user_id = str(current_user.get("_id"))
        user_role = "therapist" if current_user.get("role") == "therapist" else "user"
        
        # Get session
        session = TherapySession.find_by_id(session_id)
        if not session:
            return JsonResponse({
                "success": False,
                "message": "Session not found"
            }, status=404)
            
        # Check authorization - only client or therapist can reschedule
        if (user_id != str(session["user_id"]) and user_id != str(session["therapist_id"])):
            return JsonResponse({
                "success": False,
                "message": "You're not authorized to reschedule this session"
            }, status=403)
            
        # Parse request data
        data = json.loads(request.body)
        new_start_time = datetime.fromisoformat(data.get("start_time"))
        new_end_time = datetime.fromisoformat(data.get("end_time"))
        
        if not new_start_time or not new_end_time:
            return JsonResponse({
                "success": False,
                "message": "Start time and end time are required"
            }, status=400)
            
        # Check availability for therapist
        if not TherapistAvailability.check_availability(
            str(session["therapist_id"]), new_start_time, new_end_time):
            return JsonResponse({
                "success": False,
                "message": "Therapist is not available during the requested time"
            }, status=400)
        
        # Attempt to reschedule
        try:
            TherapySession.reschedule_session(
                session_id,
                new_start_time, 
                new_end_time,
                user_role
            )
            
            return JsonResponse({
                "success": True,
                "message": "Session rescheduled successfully"
            })
            
        except ValueError as e:
            return JsonResponse({
                "success": False,
                "message": str(e)
            }, status=400)
            
    except Exception as e:
        return JsonResponse({
            "success": False,
            "message": str(e)
        }, status=500)

@require_http_methods(["GET"])
def get_availability(request):
    """Get therapist availability"""
    try:
        # Check authentication
        current_user = get_user_from_request(request)
        if not current_user:
            return JsonResponse({
                "success": False,
                "message": "Authentication required"
            }, status=401)
        
        # Determine whose availability to get
        therapist_id = request.GET.get("therapist_id")
        
        if not therapist_id:
            # If no therapist_id provided, get current user's availability (if they're a therapist)
            if current_user.get("role") != "therapist":
                return JsonResponse({
                    "success": False,
                    "message": "Therapist ID is required"
                }, status=400)
            therapist_id = str(current_user.get("_id"))
            
        # Get availability
        availability = TherapistAvailability.get_therapist_availability(therapist_id)
        
        # Convert ObjectIds
        result = []
        for slot in availability:
            slot = convert_object_ids(slot)
            result.append(slot)
            
        return JsonResponse({
            "success": True,
            "availability": result
        })
        
    except Exception as e:
        return JsonResponse({
            "success": False,
            "message": str(e)
        }, status=500)

@csrf_exempt
@require_http_methods(["POST"])
def set_availability(request):
    """Set therapist availability"""
    try:
        # Check authentication
        current_user = get_user_from_request(request)
        if not current_user:
            return JsonResponse({
                "success": False,
                "message": "Authentication required"
            }, status=401)
            
        # Only therapists can set their availability
        if current_user.get("role") != "therapist":
            return JsonResponse({
                "success": False,
                "message": "Only therapists can set availability"
            }, status=403)
            
        therapist_id = str(current_user.get("_id"))
        data = json.loads(request.body)
        
        # Required fields
        day_of_week = data.get("day_of_week")  # 0-6 for Monday-Sunday
        start_time = data.get("start_time")  # Format: "HH:MM"
        end_time = data.get("end_time")  # Format: "HH:MM"
        recurring = data.get("recurring", True)  # Default to weekly recurring
        
        if day_of_week is None or not start_time or not end_time:
            return JsonResponse({
                "success": False,
                "message": "Day of week, start time and end time are required"
            }, status=400)
            
        # Validate day of week
        if not 0 <= day_of_week <= 6:
            return JsonResponse({
                "success": False,
                "message": "Day of week must be between 0 (Monday) and 6 (Sunday)"
            }, status=400)
            
        # Create availability slot
        availability = TherapistAvailability(
            therapist_id=therapist_id,
            day_of_week=day_of_week,
            start_time=start_time,
            end_time=end_time,
            recurring=recurring
        )
        
        availability_id = availability.save()
        
        return JsonResponse({
            "success": True,
            "availability_id": str(availability_id),
            "message": "Availability slot created"
        }, status=201)
        
    except Exception as e:
        return JsonResponse({
            "success": False,
            "message": str(e)
        }, status=500)

@csrf_exempt
@require_http_methods(["PUT"])
def update_availability(request, availability_id):
    """Update an availability slot"""
    try:
        # Check authentication
        current_user = get_user_from_request(request)
        if not current_user:
            return JsonResponse({
                "success": False,
                "message": "Authentication required"
            }, status=401)
            
        # Only therapists can update availability
        if current_user.get("role") != "therapist":
            return JsonResponse({
                "success": False,
                "message": "Only therapists can update availability"
            }, status=403)
            
        therapist_id = str(current_user.get("_id"))
        data = json.loads(request.body)
        
        # Optional fields that can be updated
        start_time = data.get("start_time")
        end_time = data.get("end_time")
        recurring = data.get("recurring")
        
        # Get the availability slot
        availability = TherapistAvailability.find_availability_by_id(availability_id)
        
        if not availability:
            return JsonResponse({
                "success": False,
                "message": "Availability slot not found"
            }, status=404)
            
        # Check if this slot belongs to the therapist
        if str(availability["therapist_id"]) != therapist_id:
            return JsonResponse({
                "success": False,
                "message": "You can only update your own availability"
            }, status=403)
            
        # Update the availability
        TherapistAvailability.update_availability(
            availability_id,
            start_time=start_time,
            end_time=end_time,
            recurring=recurring
        )
        
        return JsonResponse({
            "success": True,
            "message": "Availability updated successfully"
        })
        
    except Exception as e:
        return JsonResponse({
            "success": False,
            "message": str(e)
        }, status=500)
        
@require_http_methods(["GET"])
def get_video_session_info(request, session_id):
    """Get video configuration details for a specific therapy session"""
    try:
        # Check authentication
        current_user = get_user_from_request(request)
        if not current_user:
            return JsonResponse({
                "success": False,
                "message": "Authentication required"
            }, status=401)
            
        user_id = str(current_user.get("_id"))
        user_role = current_user.get("role")
        
        # Get session
        session = TherapySession.find_by_id(session_id)
        if not session:
            return JsonResponse({
                "success": False,
                "message": "Session not found"
            }, status=404)
            
        # Check authorization - only the client, therapist, or admin can access video session
        if (user_id != str(session["user_id"]) and 
            user_id != str(session["therapist_id"]) and 
            user_role != "admin"):
            return JsonResponse({
                "success": False,
                "message": "You're not authorized to access this session"
            }, status=403)
            
        # Check if session type supports video
        if session.get("session_type") != SessionType.VIDEO_MESSAGING.value:
            return JsonResponse({
                "success": False,
                "message": "This session does not support video"
            }, status=400)
            
        # Check if session is scheduled or in progress
        if session.get("status") not in [SessionStatus.SCHEDULED.value, SessionStatus.IN_PROGRESS.value]:
            return JsonResponse({
                "success": False,
                "message": "Video is only available for scheduled or in-progress sessions"
            }, status=400)
            
        # Get other participant info
        other_user_id = str(session["user_id"]) if user_id == str(session["therapist_id"]) else str(session["therapist_id"])
        other_user = User.find_by_id(other_user_id)
        
        # Determine user roles
        is_therapist = user_id == str(session["therapist_id"])
        
        # Get Agora app ID for client
        app_id = os.environ.get('AGORA_APP_ID', '79d73caf1b904f0587fee4d5e3e19084')
        
        # Return video session configuration
        return JsonResponse({
            "success": True,
            "session": convert_object_ids(session),
            "video_config": {
                "app_id": app_id,
                "channel_name": f"session_{session_id}",
                "user_role": "therapist" if is_therapist else "client",
                "other_user": {
                    "id": other_user_id,
                    "name": other_user.get("username", "Unknown User") if other_user else "Unknown User"
                },
                "features": {
                    "recording": is_therapist,  # Only therapists can record
                    "emotion_analysis": not is_therapist  # Only clients send emotion data
                }
            }
        })
        
    except Exception as e:
        return JsonResponse({
            "success": False,
            "message": str(e)
        }, status=500)
        
@csrf_exempt
@require_http_methods(["POST"])
def quick_book_session(request):
    """One-step session booking for users"""
    try:
        # Authenticate user
        current_user = get_user_from_request(request)
        if not current_user:
            return JsonResponse({
                "success": False,
                "message": "Authentication required"
            }, status=401)
            
        user_id = str(current_user.get("_id"))
        data = json.loads(request.body)
        
        # Required fields
        therapist_id = data.get("therapist_id")
        start_time = datetime.fromisoformat(data.get("start_time"))
        end_time = datetime.fromisoformat(data.get("end_time"))
        session_type = data.get("session_type", SessionType.VIDEO_MESSAGING.value)
        
        # Additional booking details
        presenting_issue = data.get("presenting_issue")  # Main reason for session
        goals = data.get("goals")  # What user wants to achieve 
        previous_therapy = data.get("previous_therapy", False)  # Previous therapy experience
        medical_conditions = data.get("medical_conditions", [])  # Relevant medical info
        
        # Calculate session price based on therapist hourly rate and duration
        hourly_rate = Therapist.get_hourly_rate(therapist_id)
        duration_hours = (end_time - start_time).total_seconds() / 3600
        session_price = hourly_rate * duration_hours
        
        # Create session with price field
        session = TherapySession(
            user_id=user_id,
            therapist_id=therapist_id,
            start_time=start_time,
            end_time=end_time,
            session_type=session_type,
            initiator="user",
            status=SessionStatus.ACCEPTED.value,
            price=session_price,  # Add calculated price
            duration_hours=duration_hours  # Ensure duration is set
        )
        
        # Add additional user-provided information
        session.presenting_issue = presenting_issue
        session.goals = goals
        session.previous_therapy = previous_therapy
        session.medical_conditions = medical_conditions
        
        # Validate therapist availability
        if not TherapistAvailability.check_availability(therapist_id, start_time, end_time):
            return JsonResponse({
                "success": False,
                "message": "Selected time is not available"
            }, status=400)
        
        session_id = session.save()
        
        # Generate payment session for Stripe
        stripe_session = create_stripe_checkout_session(
            session_id=str(session_id),
            user_id=user_id,
            therapist_id=therapist_id,
            session_type=session_type,
            amount=Therapist.get_session_price(therapist_id, session_type, (end_time - start_time).seconds / 3600)
        )
        
        # Return success with payment URL
        return JsonResponse({
            "success": True,
            "message": "Session created successfully",
            "session_id": str(session_id),
            "payment_url": stripe_session.url,
            "payment_session_id": stripe_session.id
        }, status=201)
        
    except ValueError as e:
        return JsonResponse({
            "success": False,
            "message": str(e)
        }, status=400)
    except Exception as e:
        return JsonResponse({
            "success": False,
            "message": str(e)
        }, status=500)
        
@require_http_methods(["GET"])
def get_therapist_calendar(request, therapist_id):
    """Get therapist availability in calendar format (next 2 weeks)"""
    try:
        # Date range defaults to next 14 days if not specified
        start_date_str = request.GET.get("start_date")
        end_date_str = request.GET.get("end_date")
        
        if start_date_str:
            start_date = datetime.fromisoformat(start_date_str)
        else:
            start_date = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
            
        if end_date_str:
            end_date = datetime.fromisoformat(end_date_str)
        else:
            end_date = start_date + timedelta(days=14)
        
        # Get all availability slots
        availability_slots = TherapistAvailability.get_calendar(
            therapist_id, 
            start_date, 
            end_date
        )
        
        # Get booked sessions in this date range
        booked_sessions = TherapySession.get_therapist_calendar(
            therapist_id,
            start_date,
            end_date
        )
        
        # Merge data for frontend calendar
        calendar_data = {
            "availability": convert_object_ids(availability_slots),
            "booked_sessions": convert_object_ids(booked_sessions)
        }
        
        return JsonResponse({
            "success": True,
            "calendar": calendar_data
        })
        
    except Exception as e:
        return JsonResponse({
            "success": False,
            "message": str(e)
        }, status=500)
        
@require_http_methods(["GET"])
def get_upcoming_sessions(request):
    """Get upcoming sessions for the current user"""
    try:
        # Check authentication
        current_user = get_user_from_request(request)
        if not current_user:
            return JsonResponse({
                "success": False,
                "message": "Authentication required"
            }, status=401)
            
        user_id = str(current_user.get("_id"))
        user_role = current_user.get("role")
        is_therapist = user_role == "therapist"
        
        print(f"User ID: {user_id}, Role: {user_role}")
        
        # Get limit parameter (optional)
        limit = request.GET.get("limit")
        if limit:
            try:
                limit = int(limit)
            except ValueError:
                limit = None
        
        # Get upcoming sessions
        try:
            sessions = TherapySession.get_upcoming_sessions(user_id, is_therapist=is_therapist)
            
            # Handle case where no sessions are found
            if not sessions:
                return JsonResponse({
                    "success": True,
                    "count": 0,
                    "message": "No upcoming sessions found",
                    "sessions": []
                })
                
            # Apply limit if specified
            if limit is not None:
                sessions = sessions[:limit]
            
            # Convert ObjectIds and add other user info
            result = []
            for session in sessions:
                session = convert_object_ids(session)
                
                # Add other party information
                if is_therapist:
                    client = User.find_by_id(session["user_id"])
                    if client:
                        session["client_name"] = client.get("username")
                        session["client_email"] = client.get("email")
                else:
                    therapist_user = User.find_by_id(session["therapist_id"])
                    if therapist_user:
                        session["therapist_name"] = therapist_user.get("username")
                        
                        # Get therapist profile info if available
                        therapist = Therapist.find_by_user_id(session["therapist_id"])
                        if therapist:
                            session["therapist_profile"] = {
                                "title": therapist.get("title"),
                                "display_name": therapist.get("display_name"),
                                "specialties": therapist.get("specialties", [])
                            }
                
                # Add if the session has a recording
                session["has_recording"] = bool(session.get("recording_url"))
                    
                result.append(session)
            
            return JsonResponse({
                "success": True,
                "count": len(result),
                "sessions": result
            })
            
        except Exception as e:
            # Handle database errors
            return JsonResponse({
                "success": False,
                "message": f"Error retrieving sessions: {str(e)}"
            }, status=500)
            
    except Exception as e:
        return JsonResponse({
            "success": False,
            "message": str(e)
        }, status=500)

@require_http_methods(["GET"])
def get_past_sessions(request):
    """Get past sessions for the current user"""
    try:
        # Check authentication
        current_user = get_user_from_request(request)
        if not current_user:
            return JsonResponse({
                "success": False,
                "message": "Authentication required"
            }, status=401)
            
        user_id = str(current_user.get("_id"))
        user_role = current_user.get("role")
        is_therapist = user_role == "therapist"
        
        # Get limit parameter (optional)
        limit = request.GET.get("limit")
        if limit:
            try:
                limit = int(limit)
            except ValueError:
                limit = None
        
        # Get past sessions
        sessions = TherapySession.get_past_sessions(user_id, is_therapist=is_therapist)
        
        # Apply limit if specified
        if limit is not None:
            sessions = sessions[:limit]
        
        # Convert ObjectIds and add other user info
        result = []
        for session in sessions:
            session = convert_object_ids(session)
            
            # Add other party information
            if is_therapist:
                client = User.find_by_id(session["user_id"])
                if client:
                    session["client_name"] = client.get("username")
                    session["client_email"] = client.get("email")
            else:
                therapist_user = User.find_by_id(session["therapist_id"])
                if therapist_user:
                    session["therapist_name"] = therapist_user.get("username")
                    
                    # Get therapist profile info if available
                    therapist = Therapist.find_by_user_id(session["therapist_id"])
                    if therapist:
                        session["therapist_profile"] = {
                            "title": therapist.get("title"),
                            "display_name": therapist.get("display_name"),
                            "specialties": therapist.get("specialties", [])
                        }
            
            # Add if the session has a recording
            session["has_recording"] = bool(session.get("recording_url"))
                
            result.append(session)
        
        return JsonResponse({
            "success": True,
            "count": len(result),
            "sessions": result
        })
        
    except Exception as e:
        return JsonResponse({
            "success": False,
            "message": str(e)
        }, status=500)
        
@require_http_methods(["GET"])
def get_therapist_availability(request, therapist_id):
    """Get availability slots for a specific therapist"""
    try:
        # Get date range parameters
        start_date_str = request.GET.get("start_date")
        end_date_str = request.GET.get("end_date")
        
        # Parse dates or use defaults
        if start_date_str:
            start_date = datetime.fromisoformat(start_date_str)
        else:
            start_date = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
            
        if end_date_str:
            end_date = datetime.fromisoformat(end_date_str)
        else:
            end_date = start_date + timedelta(days=7)  # Default to a week
        
        # Get available time slots
        available_slots = TherapistAvailability.get_available_slots(
            therapist_id,
            start_date,
            end_date
        )
        
        # Format the slots for the client
        formatted_slots = []
        for slot in available_slots:
            # Convert ObjectIds to strings
            slot = convert_object_ids(slot)
            
            # Format the datetime for display
            if isinstance(slot.get("start_time"), datetime):
                slot["start_time"] = slot["start_time"].isoformat()
            if isinstance(slot.get("end_time"), datetime):
                slot["end_time"] = slot["end_time"].isoformat()
                
            formatted_slots.append(slot)
        
        return JsonResponse({
            "success": True,
            "availability": formatted_slots
        })
        
    except Exception as e:
        print(f"Error getting therapist availability: {str(e)}")
        return JsonResponse({
            "success": False,
            "message": str(e)
        }, status=500)
        
@csrf_exempt
@require_http_methods(["POST"])
def initiate_video_call(request):
    """Create a video session directly from chat"""
    try:
        # Authenticate user
        current_user = get_user_from_request(request)
        if not current_user:
            return JsonResponse({
                "success": False, 
                "message": "Authentication required"
            }, status=401)
            
        user_id = str(current_user.get("_id"))
        data = json.loads(request.body)
        
        # Get recipient_id or use existing session/plan
        recipient_id = data.get("recipient_id")
        session_id = data.get("session_id")
        plan_id = data.get("plan_id")
        
        # If we have an existing session ID, just return it
        if session_id:
            session = TherapySession.find_by_id(session_id)
            if not session:
                return JsonResponse({
                    "success": False,
                    "message": "Session not found"
                }, status=404)
                
            # Verify user has access to this session
            if user_id != str(session.get("user_id")) and user_id != str(session.get("therapist_id")):
                return JsonResponse({
                    "success": False,
                    "message": "Unauthorized access to session"
                }, status=403)
                
            # Check if session supports video
            if session.get("session_type") != "video":
                return JsonResponse({
                    "success": False,
                    "message": "This session does not support video calls"
                }, status=400)
                
            # Return existing session
            return JsonResponse({
                "success": True,
                "session_id": session_id,
                "message": "Existing video session"
            })
        
        # Handle plan-based video call
        if plan_id:
            from apps.therapy_sessions.models import TherapyPlan
            
            plan = db.therapy_plans.find_one({"_id": ObjectId(plan_id)})
            if not plan:
                return JsonResponse({
                    "success": False,
                    "message": "Plan not found"
                }, status=404)
                
            # Check if user has access to this plan
            if user_id != str(plan.get("user_id")) and user_id != str(plan.get("therapist_id")):
                return JsonResponse({
                    "success": False,
                    "message": "Unauthorized access to plan"
                }, status=403)
                
            # Check if plan has video sessions available
            if plan.get("video_sessions_used", 0) >= plan.get("video_sessions_allowed", 0):
                return JsonResponse({
                    "success": False,
                    "message": "No video sessions remaining in this plan"
                }, status=400)
                
            # Create new video session in plan
            start_time = datetime.now()
            session_id = TherapyPlan.schedule_video_session(
                plan_id=plan_id,
                start_time=start_time,
                duration=2  # Default 2-hour session
            )
            
            return JsonResponse({
                "success": True,
                "session_id": str(session_id),
                "message": "Video session created successfully"
            })
        
        # Handle direct chat video call (requires payment)
        if recipient_id:
            # Determine if user is therapist or client
            is_therapist = current_user.get("role") == "therapist"
            
            if is_therapist:
                therapist_id = user_id
                user_id = recipient_id
            else:
                therapist_id = recipient_id
                
            # Check if therapist exists
            therapist = db.users.find_one({"_id": ObjectId(therapist_id), "role": "therapist"})
            if not therapist:
                return JsonResponse({
                    "success": False,
                    "message": "Therapist not found"
                }, status=404)
                
            # Create a pending session that requires payment
            start_time = datetime.now()
            end_time = start_time + timedelta(hours=2)  # Default 2-hour session
            
            # Create session directly in payment_required state
            session = TherapySession(
                user_id=ObjectId(user_id),
                therapist_id=ObjectId(therapist_id),
                start_time=start_time,
                end_time=end_time,
                session_type="video",
                initiator="user" if not is_therapist else "therapist",
                status="payment_required" if not is_therapist else "accepted",
                duration_hours=2
            )
            
            session_id = session.save()
            
            # If therapist initiated, no payment needed
            if is_therapist:
                return JsonResponse({
                    "success": True,
                    "session_id": str(session_id),
                    "message": "Video session created and ready"
                })
                
            # Generate payment session for Stripe
            stripe_session = create_stripe_checkout_session(
                session_id=str(session_id),
                user_id=user_id,
                therapist_id=therapist_id,
                session_type="video",
                amount=get_session_price(therapist_id, "video", 2)
            )
            
            return JsonResponse({
                "success": True,
                "session_id": str(session_id),
                "payment_url": stripe_session.url,
                "payment_session_id": stripe_session.id,
                "requires_payment": True,
                "message": "Payment required to start video session"
            })
            
        return JsonResponse({
            "success": False,
            "message": "Missing recipient_id, session_id, or plan_id"
        }, status=400)
        
    except Exception as e:
        logger.error(f"Error initiating video call: {str(e)}")
        return JsonResponse({
            "success": False,
            "message": str(e)
        }, status=500)
   
# @csrf_exempt
# @require_http_methods(["GET", "POST"])  # Accept both GET and POST
# def generate_agora_token(request):
#     """Generate Agora token via REST API"""
#     try:
#         app_id = os.environ.get('AGORA_APP_ID', '388db937dd924c0fb64cf5c92f8f9089')
#         app_certificate = os.environ.get('AGORA_APP_CERTIFICATE', '39404c338bb140538f85cbc2cb54a6fb')
        
#         # Get parameters from either GET or POST
#         if request.method == 'POST':
#             try:
#                 data = json.loads(request.body) if request.body else {}
#             except json.JSONDecodeError:
#                 data = {}
            
#             channel_name = data.get('channel', 'test_channel')
#             uid = data.get('uid', 0)
#         else:  # GET
#             channel_name = request.GET.get('channel', 'test_channel')
#             uid = request.GET.get('uid', '0')
#             try:
#                 uid = int(uid)
#             except ValueError:
#                 uid = 0
        
#         # Manual token generation (fallback if package not available)
#         if not AGORA_TOKEN_AVAILABLE:
#             import hmac
#             import base64
#             import struct
#             import zlib
            
#             # Token parameters
#             Version = "006"
#             Role_Publisher = 1
            
#             # Expiration time
#             current_timestamp = int(time.time())
#             expiration_timeInSeconds = 3600
#             privilegeExpiredTs = current_timestamp + expiration_timeInSeconds
            
#             # Build token content
#             content = struct.pack("<I", uid)  # uid
#             content += struct.pack("<I", privilegeExpiredTs)  # expiration time
#             content += struct.pack("<I", Role_Publisher)  # role
            
#             # Compute signature
#             signature = hmac.new(app_certificate.encode('utf-8'), content, 'sha256').digest()
            
#             # Combine components
#             crc_channel = zlib.crc32(channel_name.encode('utf-8')) & 0xffffffff
#             crc_app_id = zlib.crc32(app_id.encode('utf-8')) & 0xffffffff
#             content = struct.pack("<I", crc_channel)
#             content += struct.pack("<I", crc_app_id)
#             content += content
#             content += signature
            
#             # Encode token
#             token = base64.b64encode(Version.encode('utf-8') + content).decode('utf-8')
#         else:
#             # Use the proper Agora token builder
#             expiration_time = 3600
#             current_timestamp = int(time.time())
#             privilege_expired_ts = current_timestamp + expiration_time
            
#             # Build the token
#             token = RtcTokenBuilder.buildTokenWithUid(
#                 app_id, app_certificate, channel_name, uid, RtcRole.PUBLISHER, privilege_expired_ts
#             )
            
#         return JsonResponse({
#             'token': token,
#             'appId': app_id,
#             'channel': channel_name,
#             'uid': uid
#         })
        
#     except Exception as e:
#         return JsonResponse({'error': str(e)}, status=500)

# Add this function before the quick_book_session and initiate_video_call functions
def create_stripe_checkout_session(session_id, user_id, therapist_id, session_type, amount):
    """
    Create a Stripe checkout session for a therapy session payment
    
    Args:
        session_id (str): Therapy session ID
        user_id (str): Client user ID
        therapist_id (str): Therapist user ID
        session_type (str): Type of session (video, text)
        amount (float): Price amount
        
    Returns:
        object: Stripe checkout session object
    """
    try:
        # Get therapist name for display
        therapist_user = User.find_by_id(therapist_id)
        therapist_name = therapist_user.get("username", "Therapist") if therapist_user else "Therapist"
        
        # Create session data for the PaymentService
        session_data = {
            'therapy_session_id': session_id,
            'user_id': user_id,
            'therapist_id': therapist_id,
            'therapist_name': therapist_name,
            'session_type': session_type,
            'amount': amount,
            'currency': 'usd'  # Default currency
        }
        
        # Use the PaymentService to create checkout session
        checkout_session_response = PaymentService.create_checkout_session(session_data)
        
        # Return the checkout session object
        if checkout_session_response and 'id' in checkout_session_response:
            # Construct a basic object with URL and ID for consistent return type
            class CheckoutSession:
                def __init__(self, id, url):
                    self.id = id
                    self.url = url
            
            return CheckoutSession(
                checkout_session_response['id'],
                checkout_session_response['url']
            )
        else:
            raise ValueError("Failed to create checkout session")
            
    except Exception as e:
        logger.error(f"Error creating checkout session: {str(e)}")
        raise

# Add this function before the initiate_video_call function
def get_session_price(therapist_id, session_type, duration_hours):
    """
    Get the price for a session based on therapist, type, and duration
    
    Args:
        therapist_id (str): Therapist ID
        session_type (str): Type of session (video, text)
        duration_hours (float): Duration in hours
        
    Returns:
        float: Session price
    """
    try:
        # Get therapist profile to determine hourly rate
        therapist = Therapist.find_by_user_id(therapist_id)
        if not therapist:
            # Default rate if therapist not found
            return 75.0 * duration_hours
            
        # Get hourly rate based on session type
        hourly_rate = 0
        if session_type == "video":
            hourly_rate = therapist.get("video_rate", therapist.get("hourly_rate", 75.0))
        elif session_type == "text":
            hourly_rate = therapist.get("text_rate", therapist.get("hourly_rate", 60.0))
        else:
            hourly_rate = therapist.get("hourly_rate", 75.0)
            
        # Calculate total price
        return hourly_rate * duration_hours
        
    except Exception as e:
        logger.error(f"Error calculating session price: {str(e)}")
        # Default fallback price
        return 75.0 * duration_hours