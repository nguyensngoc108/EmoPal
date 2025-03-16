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
from apps.utils.media_helper import MediaStorage
from apps.utils.image_helper import delete_from_cloudinary
from apps.utils.auth import get_user_from_request

# Helper functions
# def get_user_from_request(request):
#     """Extract user from session/token in request"""
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

@require_http_methods(["GET"])
def get_user_media_library(request):
    """Get all media for the current user"""
    try:
        # Check authentication
        current_user = get_user_from_request(request)
        if not current_user:
            return JsonResponse({
                "success": False,
                "message": "Authentication required"
            }, status=401)
            
        user_id = str(current_user.get("_id"))
        
        # Pagination and filtering
        page = int(request.GET.get("page", 1))
        limit = int(request.GET.get("limit", 10))
        skip = (page - 1) * limit
        
        media_category = request.GET.get("category")  # Filter by category
        media_type = request.GET.get("type")  # Filter by media type
        
        # Get user media
        media_list = MediaStorage.find_by_user(
            user_id, 
            media_category=media_category,
            media_type=media_type,
            limit=limit, 
            skip=skip
        )
        
        # Convert ObjectIds to strings
        media_list = convert_object_ids(media_list)
        
        return JsonResponse({
            "success": True,
            "page": page,
            "limit": limit,
            "media": media_list
        })
        
    except Exception as e:
        return JsonResponse({
            "success": False,
            "message": str(e)
        }, status=500)

@csrf_exempt
@require_http_methods(["DELETE"])
def delete_media_item(request, media_id):
    """Delete media from storage and Cloudinary"""
    try:
        # Check authentication
        current_user = get_user_from_request(request)
        if not current_user:
            return JsonResponse({
                "success": False,
                "message": "Authentication required"
            }, status=401)
            
        user_id = str(current_user.get("_id"))
        
        # Get the media item
        media = MediaStorage.find_by_id(media_id)
        if not media:
            return JsonResponse({
                "success": False,
                "message": "Media not found"
            }, status=404)
            
        # Check ownership
        if str(media["user_id"]) != user_id and current_user.get("role") != "admin":
            return JsonResponse({
                "success": False,
                "message": "You don't have permission to delete this media"
            }, status=403)
            
        # Delete from Cloudinary
        if "public_id" in media:
            resource_type = "video" if media["media_type"] == "video" else "image"
            delete_from_cloudinary(media["public_id"], resource_type)
            
        # Delete from database
        result = MediaStorage.delete_media(media_id)
        
        if result.deleted_count == 0:
            return JsonResponse({
                "success": False,
                "message": "Failed to delete media"
            }, status=500)
            
        # If this was an emotion analysis media, delete the analysis too
        if media.get("analysis_id"):
            from apps.emotions.models import EmotionAnalysis
            EmotionAnalysis.delete_analysis(media["analysis_id"])
            
        return JsonResponse({
            "success": True,
            "message": "Media deleted successfully"
        })
        
    except Exception as e:
        return JsonResponse({
            "success": False,
            "message": str(e)
        }, status=500)