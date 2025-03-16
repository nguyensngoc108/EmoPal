from apps.therapy_sessions.models import TherapySession
from apps.utils.db_helper import convert_object_ids
from apps.utils.auth import get_user_from_request
from apps.chat_messages.models import Conversation, Message
from apps.therapists.models import Therapist
from apps.users.models import User
import json
import traceback
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
from bson import ObjectId
import sys
import os
from datetime import datetime, timedelta
from database import db

# Import models
sys.path.append(os.path.abspath(
    os.path.join(os.path.dirname(__file__), "../../")))


# # Helper functions
# def get_user_from_request(request):
#     """Extract user from JWT token in request header"""
#     auth_header = request.headers.get('Authorization', '')

#     if not auth_header.startswith('Bearer '):
#         return None

#     token = auth_header.split(' ')[1]

#     try:
#         # Find user by token
#         user = User.find_by_token(token)
#         return user
#     except Exception as e:
#         print(f"Authentication error: {str(e)}")
#         return None

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


def get_participant_details(user_id):
    """Get participant name and profile picture from either user or therapist collection"""
    # Convert to string if ObjectId
    if isinstance(user_id, ObjectId):
        user_id = str(user_id)

    # First try users collection directly
    user = User.find_by_id(user_id)
    if user:
        # return {
        #     "id": str(user_id),
        #     "first_name": user.get('first_name', ''),
        #     "last_name": user.get('last_name', ''),
        #     "profile_picture": user.get('profile_picture', ''),
        #     "status": user.get('status', 'offline'),
        #     "username": user.get('username', '')
        # }
        # check if first_name and last_name are empty
        if not user.get('first_name') and not user.get('last_name'):
            # If both are empty, try to parse from username
            username = user.get('username', '')
            first_name = ''
            last_name = ''

            if username:
                # Split username into words
                name_parts = username.split()
                if len(name_parts) > 1:
                    # Last word is the last name
                    last_name = name_parts[-1]
                    # Everything else is first name
                    first_name = ' '.join(name_parts[:-1])
                else:
                    # If only one word, use as first name
                    first_name = username

            return {
                "id": str(user_id),
                "first_name": first_name,
                "last_name": last_name,
                "username": username,  # Keep original username too
                "profile_picture": user.get('profile_picture', ''),
                "status": user.get('status', 'offline'),
                "role": user.get('role', 'user')
            }

    # # Then try therapists collection
    # from apps.therapists.models import Therapist
    # therapist = User.find_by_id(user_id)
    # if therapist:
    #     # Get the user_id from therapist document
    #     therapist_user_id = therapist.get('id')

    #     if therapist_user_id:
    #         # Convert to string if ObjectId
    #         if isinstance(therapist_user_id, ObjectId):
    #             therapist_user_id = str(therapist_user_id)

    #         # Look up the related user record for name and profile
    #         therapist_user = User.find_by_id(therapist_user_id)
    #         if therapist_user:
    #             return {
    #                 "id": str(user_id),
    #                 "first_name": therapist_user.get('first_name', ''),
    #                 "last_name": therapist_user.get('last_name', ''),
    #                 "profile_picture": therapist_user.get('profile_picture', ''),
    #                 "status": therapist_user.get('status', 'offline'),
    #                 "username": therapist_user.get('username', ''),
    #                 "role": "therapist"
    #             }

    #     # Parse username into first_name and last_name if needed
    #     username = therapist_user.get('username', '')
    #     first_name = ''
    #     last_name = ''

    #     if username:
    #         # Split username into words
    #         name_parts = username.split()
    #         if len(name_parts) > 1:
    #             # Last word is the last name
    #             last_name = name_parts[-1]
    #             # Everything else is first name
    #             first_name = ' '.join(name_parts[:-1])
    #         else:
    #             # If only one word, use as first name
    #             first_name = username

    #     return {
    #         "id": str(user_id),
    #         "first_name": first_name,
    #         "last_name": last_name,
    #         "username": username,  # Keep original username too
    #         "profile_picture": therapist.get('profile_picture', ''),
    #         "status": therapist.get('status', 'offline'),
    #         "role": "therapist"
    #     }

    return {
        "id": str(user_id),
        "first_name": "",
        "last_name": "",
        "profile_picture": "",
        "status": "offline"
    }


@csrf_exempt
@require_http_methods(["POST"])
def send_message(request, conversation_id):
    """Send a new message in a conversation"""
    try:
        # Get authenticated user
        current_user = get_user_from_request(request)
        if not current_user:
            return JsonResponse({
                "success": False,
                "message": "Authentication required"
            }, status=401)

        # Check if user is part of this conversation
        conversation = Conversation.find_by_id(conversation_id)
        if not conversation:
            return JsonResponse({
                "success": False,
                "message": "Conversation not found"
            }, status=404)

        # Determine the correct sender_id to use
        user_id = str(current_user.get("_id"))
        user_role = current_user.get("role", "user")
        sender_id = user_id  # Default to user_id

        # For therapists, use therapist_id in messages if it exists
        if user_role == "therapist":
            # First check if therapist_id exists in user document
            therapist_id = current_user.get("therapist_id")

            # If not, try to find the therapist document
            if not therapist_id:
                therapist = Therapist.find_by_user_id(user_id)
                if therapist:
                    therapist_id = str(therapist.get("_id"))

            # If we found a therapist ID, use it as the sender
            if therapist_id:
                sender_id = str(therapist_id)
                print(
                    f"Using therapist_id {therapist_id} as sender_id for chat message")

        # Rest of session checking code remains unchanged
        if conversation.get("conversation_type") == "therapy_session" and conversation.get("session_id"):
            session = TherapySession.find_by_id(conversation.get("session_id"))
            if session:
                # Check if session has ended (beyond grace period)
                now = datetime.utcnow()
                session_end = session.get("end_time")

                # Add 48-hour grace period for post-session questions
                grace_period_end = session_end + timedelta(hours=48)

                # If beyond grace period and not a therapist, block new messages
                if now > grace_period_end and not current_user.get("is_therapist"):
                    return JsonResponse({
                        "success": False,
                        "message": "This conversation has ended. Please book a new session to continue."
                    }, status=403)

                # If beyond session time but in grace period, add note to message
                is_in_grace_period = now > session_end and now <= grace_period_end

        data = json.loads(request.body)

        # Required fields
        receiver_id = data.get("receiver_id")
        content = data.get("content")

        if not receiver_id or not content:
            return JsonResponse({
                "success": False,
                "message": "Receiver ID and content are required"
            }, status=400)

        # Optional fields
        session_id = data.get("session_id")
        message_type = data.get("message_type", "text")
        attachments = data.get("attachments", [])

        # Determine sender type based on user role
        sender_type = user_role

        # Create and save the message
        message = Message(
            # Use the determined sender_id (user_id or therapist_id)
            sender_id=sender_id,
            conversation_id=conversation_id,
            content=content,
            message_type=message_type,
            session_id=session_id,
            metadata={"attachments": attachments} if attachments else None
        )

        message_id = message.save()

        return JsonResponse({
            "success": True,
            "message_id": str(message_id),
            "message": "Message sent successfully"
        }, status=201)

    except Exception as e:
        print(f"Error sending message: {str(e)}")
        traceback.print_exc()
        return JsonResponse({
            "success": False,
            "message": str(e)
        }, status=500)


@require_http_methods(["GET"])
def get_conversations(request):
    """Get all conversations for current user"""
    try:
        # Check authentication
        current_user = get_user_from_request(request)
        if not current_user:
            return JsonResponse({
                "success": False,
                "message": "Authentication required"
            }, status=401)

        # Extract parameters
        user_id = str(current_user.get("_id"))
        limit = int(request.GET.get('limit', 20))
        skip = int(request.GET.get('skip', 0))

        # Special handling for therapists - they might be referenced by therapist_id
        user_role = current_user.get("role", "user")
        participant_ids = [user_id]  # Start with user_id

        # If user is a therapist, also search for their therapist_id
        if user_role == "therapist":
            # First check if therapist_id is already in user document
            therapist_id = current_user.get("therapist_id")

            # If not, look it up in therapists collection
            if not therapist_id:
                from apps.therapists.models import Therapist
                therapist = Therapist.find_by_user_id(user_id)
                if therapist:
                    therapist_id = str(therapist.get("_id"))

            # Add therapist_id to search if found
            if therapist_id:
                participant_ids.append(str(therapist_id))
                print(
                    f"Adding therapist ID {therapist_id} to conversation search")

        # Get conversations where user is a participant (by any ID)
        conversations = []
        for participant_id in participant_ids:
            convs = Conversation.find_by_participant(
                participant_id=participant_id,
                limit=limit,
                skip=skip
            )
            conversations.extend(convs)

        # Remove duplicates (in case some conversations were found through both IDs)
        unique_conversations = {}
        for conv in conversations:
            conv_id = str(conv.get("_id"))
            if conv_id not in unique_conversations:
                unique_conversations[conv_id] = conv

        conversations = list(unique_conversations.values())

        # Sort by updated_at
        conversations.sort(key=lambda x: x.get(
            "updated_at", datetime.min), reverse=True)

        # Truncate to limit if needed
        if len(conversations) > limit:
            conversations = conversations[:limit]

        # Add additional data for each conversation
        for conv in conversations:
            participants = conv.get("participants", [])

            # Find the other participant (not the current user or their therapist ID)
            other_user_id = None
            for p in participants:
                if p not in participant_ids:
                    other_user_id = p
                    break

            if other_user_id:
                # Get complete user details instead of just the name
                other_user = get_participant_details(other_user_id)

                first_name = other_user.get('first_name', '')
                last_name = other_user.get('last_name', '')

                # If both first and last name are empty, try username (for therapists)
                if not first_name and not last_name and other_user.get('username'):
                    # Already parsed in get_participant_details
                    pass

                # Add recipient details to conversation
                conv["recipient_name"] = f"{first_name} {last_name}".strip(
                ) or other_user.get('username', 'Unknown User')
                conv["recipient_picture"] = other_user.get(
                    'profile_picture', '')
                conv["recipient_status"] = other_user.get('status', 'offline')

                print(
                    f"Found other participant {other_user_id}: {conv['recipient_name']}")

        # Convert ObjectIds to strings for JSON serialization
        result = [convert_object_ids(conv) for conv in conversations]

        return JsonResponse({
            "success": True,
            "conversations": result
        })

    except Exception as e:
        print(f"Error getting conversations: {str(e)}")
        import traceback
        traceback.print_exc()
        return JsonResponse({
            "success": False,
            "message": str(e)
        }, status=500)


@require_http_methods(["GET"])
def get_conversation_history(request, conversation_id):
    """Get message history for a specific conversation"""
    try:
        # Check authentication
        current_user = get_user_from_request(request)
        if not current_user:
            return JsonResponse({
                "success": False,
                "message": "Authentication required"
            }, status=401)

        # Process pagination parameters - remain unchanged
        if "page" in request.GET and "page_size" in request.GET:
            page = int(request.GET.get("page", 1))
            page_size = int(request.GET.get("page_size", 50))
            skip = (page - 1) * page_size
            limit = page_size
        else:
            limit = int(request.GET.get("limit", 50))
            skip = int(request.GET.get("skip", 0))

        # Access check with both ID formats - improved format handling
        conversation = Conversation.find_by_id(conversation_id)
        if not conversation:
            return JsonResponse({"success": False, "message": "Conversation not found"}, status=404)

        # Get user IDs for access check
        user_id = str(current_user.get("_id"))
        user_role = current_user.get("role", "user")
        participant_ids = [user_id]  # Start with user ID as string

        # If user is a therapist, include their therapist_id in check
        if user_role == "therapist":
            # First check if therapist_id is already in user document
            therapist_id = current_user.get("therapist_id")
            if therapist_id:
                if isinstance(therapist_id, ObjectId):
                    therapist_id = str(therapist_id)
                participant_ids.append(therapist_id)
                print(f"Using therapist_id from user document: {therapist_id}")

            # If not in user document, look it up in therapists collection
            else:
                therapist = Therapist.find_by_user_id(user_id)
                if therapist:
                    therapist_id = str(therapist.get("_id"))
                    participant_ids.append(therapist_id)
                    print(
                        f"Found therapist_id from therapists collection: {therapist_id}")

        # Ensure all participants in conversation are strings for comparison
        conversation_participants = [
            str(p) for p in conversation.get("participants", [])]
        print(f"User IDs to check: {participant_ids}")
        print(f"Conversation participants: {conversation_participants}")

        # Check if any of the user's IDs are in participants
        has_access = any(
            pid in conversation_participants for pid in participant_ids)

        if not has_access:
            # Fallback check for ObjectId string format variations
            has_access = any(
                any(str(pid).lower() == str(cp).lower()
                    for cp in conversation_participants)
                for pid in participant_ids
            )

        if not has_access:
            return JsonResponse({
                "success": False,
                "message": f"Access denied to conversation {conversation_id}. User IDs: {participant_ids}, participants: {conversation_participants}"
            }, status=403)

        # Get messages - rest of the code remains unchanged
        messages = Message.get_messages_by_conversation(
            conversation_id, limit, skip)

        # Standardize message format
        formatted_messages = []
        for msg in messages:
            formatted_msg = convert_object_ids(msg)

            # Standardize field names
            if '_id' in formatted_msg and 'id' not in formatted_msg:
                formatted_msg['id'] = formatted_msg['_id']

            # Ensure timestamp fields are consistent
            if 'sent_at' in formatted_msg and 'timestamp' not in formatted_msg:
                formatted_msg['timestamp'] = formatted_msg['sent_at']

            formatted_messages.append(formatted_msg)

        # Return standardized messages
        return JsonResponse({
            "success": True,
            "messages": formatted_messages,
            "conversation": convert_object_ids(conversation)
        })

    except Exception as e:
        print(f"Error getting conversation history: {str(e)}")
        traceback.print_exc()  # Add traceback for debugging
        return JsonResponse({
            "success": False,
            "message": str(e)
        }, status=500)


@require_http_methods(["GET"])
def get_session_chat(request, session_id):
    """Get all messages from a specific therapy session"""
    try:
        # Check authentication
        current_user = get_user_from_request(request)
        if not current_user:
            return JsonResponse({
                "success": False,
                "message": "Authentication required"
            }, status=401)

        # Get conversation for this session
        conversation = Conversation.get_session_conversation(session_id)
        if not conversation:
            return JsonResponse({
                "success": False,
                "message": "Session conversation not found"
            }, status=404)

        # Verify user has access to this session
        user_id = str(current_user.get("_id"))
        if user_id not in conversation.get("participants", []):
            return JsonResponse({
                "success": False,
                "message": "Access denied to this session"
            }, status=403)

        # Get messages
        messages = Message.get_messages_by_session(session_id)

        # Convert for JSON serialization
        result = [convert_object_ids(msg) for msg in messages]

        return JsonResponse({
            "success": True,
            "conversation_id": str(conversation.get("_id")),
            "messages": result
        })

    except Exception as e:
        return JsonResponse({
            "success": False,
            "message": str(e)
        }, status=500)


@require_http_methods(["GET"])
def get_unread_count(request):
    """Get count of unread messages for the current user"""
    try:
        # Check authentication
        current_user = get_user_from_request(request)
        if not current_user:
            return JsonResponse({
                "success": False,
                "message": "Authentication required"
            }, status=401)

        user_id = str(current_user.get("_id"))

        # Get unread count
        count = Message.get_unread_count(user_id)

        return JsonResponse({
            "success": True,
            "unread_count": count
        })

    except Exception as e:
        return JsonResponse({
            "success": False,
            "message": str(e)
        }, status=500)


@csrf_exempt
@require_http_methods(["POST"])
def mark_as_read(request, message_id):
    """Mark a specific message as read"""
    try:
        # Check authentication
        current_user = get_user_from_request(request)
        if not current_user:
            return JsonResponse({
                "success": False,
                "message": "Authentication required"
            }, status=401)

        # Mark as read
        Message.mark_as_read(message_id)

        return JsonResponse({
            "success": True,
            "message": "Message marked as read"
        })

    except Exception as e:
        return JsonResponse({
            "success": False,
            "message": str(e)
        }, status=500)

# Add this function after your get_participant_details function


def get_participant_name(user_id):
    """Extract name from participant based on user or therapist record"""
    details = get_participant_details(user_id)

    if details:
        # First try first_name + last_name
        first_name = details.get('first_name', '')
        last_name = details.get('last_name', '')
        if first_name or last_name:
            return f"{first_name} {last_name}".strip()

        # Then try username
        if details.get('username'):
            return details.get('username')

    return "Unknown User"


@csrf_exempt
@require_http_methods(["DELETE"])
def delete_message(request, message_id):
    """Delete a message (only sender can delete)"""
    try:
        # Check authentication
        current_user = get_user_from_request(request)
        if not current_user:
            return JsonResponse({
                "success": False,
                "message": "Authentication required"
            }, status=401)

        user_id = str(current_user.get("_id"))

        # Delete message
        result = Message.delete_message(message_id, user_id)

        if result.deleted_count == 0:
            return JsonResponse({
                "success": False,
                "message": "Message not found or you're not authorized to delete it"
            }, status=404)

        return JsonResponse({
            "success": True,
            "message": "Message deleted successfully"
        })

    except Exception as e:
        return JsonResponse({
            "success": False,
            "message": str(e)
        }, status=500)


@require_http_methods(["GET"])
def get_plan_messages(request, plan_id):
    """Get messages for a specific therapy plan"""
    try:
        # Check authentication
        current_user = get_user_from_request(request)
        if not current_user:
            return JsonResponse({
                "success": False,
                "message": "Authentication required"
            }, status=401)

        # Get conversation for this plan
        from apps.therapy_sessions.models import TherapyPlan
        plan = TherapyPlan.find_by_id(plan_id)

        if not plan:
            return JsonResponse({
                "success": False,
                "message": "Plan not found"
            }, status=404)

        # Check if user is part of this plan
        user_id = str(current_user.get("_id"))
        if user_id != str(plan.get("user_id")) and user_id != str(plan.get("therapist_id")):
            return JsonResponse({
                "success": False,
                "message": "Access denied to this plan's messages"
            }, status=403)

        # Get messages
        conversation = Conversation.get_plan_conversation(plan_id)
        if not conversation:
            # Create a new conversation if it doesn't exist
            conversation_id = Conversation.get_or_create(
                participants=[str(plan.get("user_id")),
                              str(plan.get("therapist_id"))],
                conversation_type="therapy_plan",
                plan_id=plan_id
            )
            conversation = Conversation.find_by_id(conversation_id)
            messages = []
        else:
            messages = Message.get_messages_by_conversation(
                conversation["_id"])

        # Convert for JSON serialization
        result = [convert_object_ids(msg) for msg in messages]

        # Mark messages as read
        message_ids = [msg["_id"] for msg in messages
                       if msg["sender_id"] != user_id and not msg["read"]]
        if message_ids:
            Message.mark_as_read(message_ids, user_id)

        return JsonResponse({
            "success": True,
            "messages": result,
            "conversation_id": str(conversation.get("_id"))
        })

    except Exception as e:
        return JsonResponse({
            "success": False,
            "message": str(e)
        }, status=500)


@require_http_methods(["GET"])
def get_conversation_details(request, conversation_id):
    """Get details for a specific conversation"""
    try:
        # Check authentication
        current_user = get_user_from_request(request)
        if not current_user:
            return JsonResponse({
                "success": False,
                "message": "Authentication required"
            }, status=401)

        # Verify conversation exists
        conversation = Conversation.find_by_id(conversation_id)
        if not conversation:
            return JsonResponse({
                "success": False,
                "message": "Conversation not found"
            }, status=404)

        # Get user IDs for access check
        user_id = str(current_user.get("_id"))
        user_role = current_user.get("role", "user")
        participant_ids = [user_id]  # Start with the logged-in user ID

        # If user is a therapist, also check by therapist_id
        if user_role == "therapist":
            # First check if therapist_id is already in user document
            therapist_id = current_user.get("therapist_id")

            # If not, look it up in therapists collection
            if not therapist_id:
                therapist = Therapist.find_by_user_id(user_id)
                if therapist:
                    therapist_id = str(therapist.get("_id"))

            # Add therapist_id to check if found
            if therapist_id:
                participant_ids.append(str(therapist_id))
                print(
                    f"Adding therapist ID {therapist_id} to conversation access check")

        # Check if any of the user's IDs are in participants
        participants = conversation.get("participants", [])
        has_access = any(pid in participants for pid in participant_ids)

        if not has_access:
            return JsonResponse({
                "success": False,
                "message": "Access denied to this conversation"
            }, status=403)

        # Find the other participant (not the current user or their therapist ID)
        other_user_id = next(
            (p for p in participants if p not in participant_ids), None)
        other_user = None

        if other_user_id:
            # Get complete user details
            other_user = get_participant_details(other_user_id)
            print(f"Found conversation participant: {other_user}")

        # If session conversation, get session details
        session = None
        if conversation.get("conversation_type") == "therapy_session" and conversation.get("session_id"):
            session = TherapySession.find_by_id(conversation.get("session_id"))

        # Return the conversation data with user details
        return JsonResponse({
            "success": True,
            "conversation": convert_object_ids(conversation),
            "other_user": other_user,
            "session": convert_object_ids(session) if session else None
        })

    except Exception as e:
        print(f"Error in get_conversation_details: {str(e)}")
        traceback.print_exc()
        return JsonResponse({
            "success": False,
            "message": str(e)
        }, status=500)

# Add a new endpoint for conversation queries by session and type


@require_http_methods(["GET"])
def get_conversations_by_query(request):
    """Get conversations based on query parameters"""
    try:
        # Get query parameters
        session_id = request.GET.get('session_id')
        conversation_type = request.GET.get('conversation_type')

        # Build query
        query = {}

        # Add session_id if provided
        if session_id:
            query["session_id"] = ObjectId(session_id)

        # Add conversation_type if provided
        if conversation_type:
            query["conversation_type"] = conversation_type

        # Add metadata filters if provided
        for key, value in request.GET.items():
            if key.startswith('metadata.'):
                query[key] = value

        # Query conversations
        conversations = list(db.conversations.find(
            query).sort("created_at", -1))

        # Convert ObjectId to string
        for conv in conversations:
            conv["_id"] = str(conv["_id"])
            if "session_id" in conv:
                conv["session_id"] = str(conv["session_id"])
            if "participants" in conv:
                conv["participants"] = [str(p) for p in conv["participants"]]

        return JsonResponse({
            "success": True,
            "conversations": conversations
        })

    except Exception as e:
        return JsonResponse({
            "success": False,
            "error": str(e)
        }, status=500)
