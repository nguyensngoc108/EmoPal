from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from apps.utils.image_helper import upload_to_cloudinary, get_file_extension, is_valid_image
from apps.users.models import User
from apps.utils.auth import get_user_from_request

@csrf_exempt
@require_http_methods(["POST"])
def upload_avatar(request):
    """Upload avatar image for user or therapist"""
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
        
        if 'avatar_file' in request.FILES:
            avatar_file = request.FILES['avatar_file']
            
            # Check file extension
            extension = get_file_extension(avatar_file.name)
            if not is_valid_image(extension):
                return JsonResponse({
                    "success": False,
                    "message": "Only image files are allowed for avatars"
                }, status=400)
                
            # Upload to Cloudinary
            upload_result = upload_to_cloudinary(
                avatar_file, 
                username, 
                folder="avatars"
            )
            
            if not upload_result:
                return JsonResponse({
                    "success": False,
                    "message": "Failed to upload avatar"
                }, status=500)
                
            # Update user profile with avatar URL
            User.update_profile(current_user.get("email"), {
                "profile_picture": upload_result["url"]
            })
            
            return JsonResponse({
                "success": True,
                "avatar_url": upload_result["url"],
                "message": "Avatar uploaded successfully"
            })
            
        else:
            return JsonResponse({
                "success": False,
                "message": "No avatar file provided"
            }, status=400)
            
    except Exception as e:
        return JsonResponse({
            "success": False,
            "message": str(e)
        }, status=500)