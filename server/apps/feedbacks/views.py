import json
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
from bson import ObjectId
import sys
import os

# Import models
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../../")))
from apps.users.models import User
from apps.therapists.models import Therapist
from apps.feedbacks.models import Feedback
from apps.utils.auth import get_user_from_request

# Helper function (reuse from therapist views)
# def get_user_from_request(request):
#     """Extract user from session/token in request"""
#     # This is a placeholder - implement actual auth logic
#     user_id = request.session.get('user_id')
#     if user_id:
#         return User.find_by_id(user_id)
#     return None

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
def submit_feedback(request, therapist_id):
    """Submit feedback for a therapist"""
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
        
        # Create feedback
        feedback_data = {
            "user_id": user_id,
            "therapist_id": therapist_id,
            "session_id": data.get("session_id"),
            "rating": data.get("rating", 0),
            "comment": data.get("comment"),
            "is_anonymous": data.get("is_anonymous", False)
        }
        
        feedback = Feedback(**feedback_data)
        feedback_id = feedback.save()
        
        # Recalculate average rating for therapist
        new_avg_rating = Feedback.calc_average_rating(therapist_id)
        Therapist.update_rating(therapist_id, new_avg_rating)
        
        return JsonResponse({
            "success": True,
            "message": "Feedback submitted successfully",
            "feedback_id": str(feedback_id)
        }, status=201)
        
    except Exception as e:
        return JsonResponse({
            "success": False,
            "message": str(e)
        }, status=500)

@require_http_methods(["GET"])
def get_therapist_feedback(request, therapist_id):
    """Get feedback for a specific therapist"""
    try:
        limit = int(request.GET.get("limit", 10))
        skip = int(request.GET.get("skip", 0))
        
        feedback_list = Feedback.find_by_therapist(therapist_id, limit, skip)
        
        # Process feedback - hide user info if anonymous
        result = []
        for feedback in feedback_list:
            feedback = convert_object_ids(feedback)
            
            # If feedback is anonymous, remove user identifiers
            if feedback.get("is_anonymous", False):
                feedback["user_id"] = None
            else:
                # Add user name if not anonymous
                user = User.find_by_id(feedback["user_id"])
                if user:
                    feedback["user_name"] = user.get("username")
                    
            result.append(feedback)
            
        return JsonResponse({
            "success": True,
            "count": len(result),
            "feedback": result
        })
        
    except Exception as e:
        return JsonResponse({
            "success": False,
            "message": str(e)
        }, status=500)

@csrf_exempt
@require_http_methods(["PUT"])
def update_feedback(request, feedback_id):
    """Update existing feedback"""
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
        
        # Create updated data
        updated_data = {}
        if "rating" in data:
            updated_data["rating"] = data["rating"]
        if "comment" in data:
            updated_data["comment"] = data["comment"]
        if "is_anonymous" in data:
            updated_data["is_anonymous"] = data["is_anonymous"]
            
        # Update feedback
        result = Feedback.update_feedback(feedback_id, user_id, updated_data)
        
        if result.modified_count == 0:
            return JsonResponse({
                "success": False,
                "message": "Feedback not found or you're not authorized to update it"
            }, status=404)
            
        # Get the feedback to find therapist_id
        feedback = Feedback.find_by_id(feedback_id)
        if feedback:
            # Recalculate average rating for therapist
            new_avg_rating = Feedback.calc_average_rating(feedback["therapist_id"])
            Therapist.update_rating(feedback["therapist_id"], new_avg_rating)
            
        return JsonResponse({
            "success": True,
            "message": "Feedback updated successfully"
        })
        
    except Exception as e:
        return JsonResponse({
            "success": False,
            "message": str(e)
        }, status=500)

@csrf_exempt
@require_http_methods(["DELETE"])
def delete_feedback(request, feedback_id):
    """Delete feedback"""
    try:
        # Check authentication
        current_user = get_user_from_request(request)
        if not current_user:
            return JsonResponse({
                "success": False,
                "message": "Authentication required"
            }, status=401)
            
        user_id = str(current_user.get("_id"))
        
        # Get the feedback first to find therapist_id
        feedback = Feedback.find_by_id(feedback_id)
        if not feedback:
            return JsonResponse({
                "success": False,
                "message": "Feedback not found"
            }, status=404)
            
        therapist_id = feedback["therapist_id"]
        
        # Delete feedback
        result = Feedback.delete_feedback(feedback_id, user_id)
        
        if result.deleted_count == 0:
            return JsonResponse({
                "success": False,
                "message": "Feedback not found or you're not authorized to delete it"
            }, status=404)
            
        # Recalculate average rating for therapist
        new_avg_rating = Feedback.calc_average_rating(therapist_id)
        Therapist.update_rating(therapist_id, new_avg_rating)
        
        return JsonResponse({
            "success": True,
            "message": "Feedback deleted successfully"
        })
        
    except Exception as e:
        return JsonResponse({
            "success": False,
            "message": str(e)
        }, status=500)