from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
import json
from .models import User
from ..utils.auth import generate_jwt_token, generate_refresh_token

from apps.utils.image_helper import upload_to_cloudinary, get_file_extension, is_valid_image
from apps.utils.auth import get_user_from_request 


# Update your register_user function to handle file uploads:
@csrf_exempt
def register_user(request):
    """ Register a new user """
    if request.method == "POST":
        try:
            # Check if it's a multipart form (with file upload)
            if request.content_type and 'multipart/form-data' in request.content_type:
                # Extract user data from form
                user_data = {
                    "username": request.POST.get("username"),
                    "email": request.POST.get("email"),
                    "first_name": request.POST.get("first_name"),  # Added field
                    "last_name": request.POST.get("last_name"),    # Added field
                    "phone": request.POST.get("phone"),
                    "address": json.loads(request.POST.get("address", "{}")),
                    "password": request.POST.get("password"),
                    "gender": request.POST.get("gender"),
                    "bio": request.POST.get("bio"),
                }
            else:
                # Regular JSON data
                user_data = json.loads(request.body)
                
            # Check if email already exists
            if User.find_by_email(user_data["email"]):
                return JsonResponse({"success": False, "message": "Email already exists"}, status=400)
            
            # Handle avatar upload - existing code is correct
            avatar_url = None
            if request.FILES and 'avatar_file' in request.FILES:
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
                    user_data["username"], 
                    folder="avatars"
                )
                
                if upload_result:
                    avatar_url = upload_result["url"]
            
            # Create user object with the avatar URL and new fields
            new_user = User(
                username=user_data["username"],
                email=user_data["email"],
                first_name=user_data.get("first_name"),  # Added field
                last_name=user_data.get("last_name"),    # Added field
                phone=user_data["phone"],
                address=user_data["address"],
                password=user_data["password"],
                gender=user_data["gender"],
                role=user_data.get("role", "user"),
                profile_picture=avatar_url or user_data.get("profile_picture"),
                bio=user_data.get("bio"),
            )
            
            
            user_id = new_user.save()
            
            # Get user data for token generation
            user = User.find_by_id(user_id)
            
            # Generate token
            token = generate_jwt_token(user)
            
            return JsonResponse({
                "success": True, 
                "message": "User registered successfully",
                "user": {
                    "id": str(user.get("_id")),
                    "username": user.get("username"),
                    "email": user.get("email"),
                    "profile_picture": avatar_url or user.get("profile_picture")
                },
                "token": token
            }, status=201)
        except Exception as e:
            return JsonResponse({"success": False, "message": str(e)}, status=500)
        
        
        
@csrf_exempt
def login_user(request):
    """ Login user """
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            email = data["email"]
            password = data["password"]
            
            user = User.find_by_email(email)
            if user and User.check_password(email, password):
                # Record login time
                User.record_login(email)
                
                # Generate tokens
                access_token = generate_jwt_token(user)
                refresh_token = generate_refresh_token(user)
                
                User.update_token(str(user.get("_id")), access_token)
                
                return JsonResponse({
                    "success": True,
                    "message": "Login successful",
                    "user": {
                        "id": str(user.get("_id")),
                        "username": user.get("username"),
                        "email": user.get("email"),
                        "role": user.get("role", "user"),
                    },
                    "tokens": {
                        "access": access_token,
                        "refresh": refresh_token,
                    }
                })
            return JsonResponse({
                "success": False,
                "message": "Invalid credentials"
            }, status=401)
        except Exception as e:
            return JsonResponse({
                "success": False,
                "message": str(e)
            }, status=500)

@csrf_exempt
def update_profile(request):
    """ Update user profile using token authentication """
    if request.method == "PUT":
        try:
            # Get user from JWT token
            current_user = get_user_from_request(request)
            if not current_user:
                return JsonResponse({
                    "success": False,
                    "message": "Authentication required"
                }, status=401)
                
            data = json.loads(request.body)
            user_id = str(current_user.get("_id"))
            
            # Extract fields that can be updated
            updatable_fields = [
                "first_name", "last_name", "phone", "bio", 
                "gender", "address", "preferences", "notification_settings"
            ]
            
            update_data = {
                key: value for key, value in data.items() 
                if key in updatable_fields and value is not None
            }
            
            if not update_data:
                return JsonResponse({
                    "success": False,
                    "message": "No valid fields to update"
                }, status=400)
            
            # Update the profile
            success = User.update_profile(user_id, update_data)
            
            if success:
                return JsonResponse({
                    "success": True,
                    "message": "Profile updated successfully"
                })
            else:
                return JsonResponse({
                    "success": False,
                    "message": "Failed to update profile"
                }, status=500)
                
        except Exception as e:
            return JsonResponse({
                "success": False,
                "message": f"Update failed: {str(e)}"
            }, status=500)
            
@csrf_exempt
def update_profile_picture(request):
    """ Upload and update user profile picture """
    if request.method == "POST":
        try:
            # Get user from JWT token
            current_user = get_user_from_request(request)
            if not current_user:
                return JsonResponse({
                    "success": False,
                    "message": "Authentication required"
                }, status=401)
                
            if 'profile_picture' not in request.FILES:
                return JsonResponse({
                    "success": False,
                    "message": "No image file provided"
                }, status=400)
                
            # Handle profile picture upload
            avatar_file = request.FILES['profile_picture']
            
            # Check file extension
            extension = get_file_extension(avatar_file.name)
            if not is_valid_image(extension):
                return JsonResponse({
                    "success": False,
                    "message": "Only image files are allowed for profile pictures"
                }, status=400)
                
            # Get username for file naming
            username = current_user.get("username", "user")
            user_id = str(current_user.get("_id"))
            
            # Upload to Cloudinary
            upload_result = upload_to_cloudinary(
                avatar_file, 
                f"{username}_{user_id}", 
                folder="avatars"
            )
            
            if not upload_result:
                return JsonResponse({
                    "success": False,
                    "message": "Failed to upload image"
                }, status=500)
                
            # Get the image URL
            avatar_url = upload_result["url"]
            
            # Update the user profile with the new picture URL
            success = User.update_profile(user_id, {"profile_picture": avatar_url})
            
            if success:
                return JsonResponse({
                    "success": True,
                    "message": "Profile picture updated successfully",
                    "profile_picture": avatar_url
                })
            else:
                return JsonResponse({
                    "success": False,
                    "message": "Failed to update profile picture"
                }, status=500)
                
        except Exception as e:
            return JsonResponse({
                "success": False,
                "message": f"Update failed: {str(e)}"
            }, status=500)

@csrf_exempt
def delete_user(request):
    """ Delete user account """
    if request.method == "DELETE":
        try:
            data = json.loads(request.body)
            email = data["email"]
            User.delete_user(email)
            return JsonResponse({"message": "User deleted successfully"}, status=200)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)
        
@csrf_exempt
def get_user_profile(request):
    """Get the current user's profile"""
    if request.method == "GET":
        current_user = get_user_from_request(request)
        if not current_user:
            return JsonResponse({
                "success": False,
                "message": "Authentication required"
            }, status=401)
            
        return JsonResponse({
            "success": True,
            "user": {
                "id": str(current_user.get("_id")),
                "username": current_user.get("username"),
                "email": current_user.get("email"),
                "first_name": current_user.get("first_name"),
                "last_name": current_user.get("last_name"),
                "role": current_user.get("role", "client"),
                "profile_picture": current_user.get("profile_picture")
            }
    })
        
@csrf_exempt
def update_password(request):
    """ Update user password """
    if request.method == "PUT":
        try:
            # Get user from JWT token
            current_user = get_user_from_request(request)
            if not current_user:
                return JsonResponse({
                    "success": False,
                    "message": "Authentication required"
                }, status=401)
                
            data = json.loads(request.body)
            if not data.get("current_password") or not data.get("new_password"):
                return JsonResponse({
                    "success": False,
                    "message": "Current and new password required"
                }, status=400)
                
            # Verify current password
            email = current_user.get("email")
            if not User.check_password(email, data["current_password"]):
                return JsonResponse({
                    "success": False,
                    "message": "Current password is incorrect"
                }, status=401)
                
            # Update the password
            User.update_password(email, data["new_password"])
            
            return JsonResponse({
                "success": True,
                "message": "Password updated successfully"
            })
                
        except Exception as e:
            return JsonResponse({
                "success": False,
                "message": f"Update failed: {str(e)}"
            }, status=500)
        
# @csrf_exempt
# def get_profile(request):
#     """ Get user profile """
#     if request.method == "GET":
#         try:
#         current_user = get_user_from_request(request)
#         if not current_user:
#             return JsonResponse({
#                 "success": False,
#                 "message": "Authentication required"
#             }, status=401)
            
#         user = User.find_by_id(current_user.get("_id"))
#         if not user:
#             return JsonResponse({
#                 "success": False,
#                 "message": "User not found"
#             }, status=404)
#         # load all data that user has updated to the user model, else remains the same
