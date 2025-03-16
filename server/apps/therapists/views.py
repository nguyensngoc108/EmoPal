import json
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
from bson import ObjectId
import sys
import os
from django.views.decorators.http import require_http_methods
from ..utils.image_helper import upload_to_cloudinary, get_file_extension, is_valid_image

# Import models
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../../")))
from apps.users.models import User
from apps.therapists.models import Therapist, therapists_collection
from apps.feedbacks.models import Feedback

from apps.utils.auth import get_user_from_request, generate_jwt_token

# Helper function to check if user is authenticated
# def get_user_from_request(request):
#     """Extract user from session/token in request"""
#     # This is a placeholder - implement actual auth logic
#     # For now, we'll just check if user_id is in request
#     user_id = request.session.get('user_id')
#     if user_id:
#         return User.find_by_id(user_id)
#     return None

# Convert ObjectId to string for JSON serialization
def convert_object_ids(obj):
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
# Update your register_therapist function:
@csrf_exempt
def register_therapist(request):
    if request.method == "POST":
        try:
            # Check if it's a multipart form (with file upload)
            if request.content_type and 'multipart/form-data' in request.content_type:
                # Extract therapist data from form
                data = {
                    "username": request.POST.get("username"),
                    "email": request.POST.get("email"),
                    "phone": request.POST.get("phone"),
                    "address": json.loads(request.POST.get("address", "{}")),
                    "password": request.POST.get("password"),
                    "gender": request.POST.get("gender"),
                    "bio": request.POST.get("bio"),
                    "specialization": json.loads(request.POST.get("specialization", "[]")),
                    "experience": int(request.POST.get("experience", "0")),
                    "education": json.loads(request.POST.get("education", "[]")),
                    "license_number": request.POST.get("license_number", ""),
                    "hourly_rate": float(request.POST.get("hourly_rate", "0")),
                    "languages": json.loads(request.POST.get("languages", '["English"]'))
                }
            else:
                # Regular JSON data
                data = json.loads(request.body)
                
            # Handle avatar upload
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
                    data["username"], 
                    folder="avatars"
                )
                
                if upload_result:
                    avatar_url = upload_result["url"]
            
            # Create user account first with role="therapist"
            user_data = {
                "username": data.get("username"),
                "email": data.get("email"),
                "phone": data.get("phone"),
                "address": data.get("address"),
                "password": data.get("password"),
                "gender": data.get("gender"),
                "role": "therapist",  # Set role to therapist
                "profile_picture": avatar_url or data.get("profile_picture"),
                "bio": data.get("bio")
            }
            
            # Check if email already exists
            if User.find_by_email(user_data["email"]):
                return JsonResponse({"success": False, "message": "Email already exists"}, status=400)
                
            # Create the user
            user = User(**user_data)
            user_id = user.save()
            
            # Now extract therapist-specific fields
            therapist_data = {
                "user_id": user_id,
                "hourly_rate": data.get("hourly_rate", 0),
                "license_number": data.get("license_number", ""),
                "education": data.get("education", []),
                "experience": data.get("experience", 0),
                "languages": data.get("languages", ["English"]),
                "specialization": data.get("specialization", []),
                "available_slots": data.get("availability", {})
            }
            
            # Create the therapist profile
            therapist = Therapist(**therapist_data)
            therapist_id = therapist.save()
            
            # Get user data for token generation
            user_obj = User.find_by_id(user_id)
            
            # Generate token
            token = generate_jwt_token(user_obj)
            
            return JsonResponse({
                "success": True,
                "message": "Therapist registered successfully",
                "user_id": str(user_id),
                "therapist_id": str(therapist_id),
                "profile_picture": avatar_url or user_obj.get("profile_picture"),
                "token": token
            }, status=201)
            
        except Exception as e:
            return JsonResponse({"success": False, "message": str(e)}, status=500)
        
        
@require_http_methods(["GET"])
def get_therapists(request):
    """Get a list of therapists with optional filtering"""
    try:
        # Extract query parameters
        limit = int(request.GET.get("limit", 10))
        skip = int(request.GET.get("skip", 0))
        specialization = request.GET.get("specialization")
        gender = request.GET.get("gender")
        min_rating = request.GET.get("min_rating")
        
        # Build filter
        filters = {"is_verified": True}  # Only show verified therapists
        if specialization:
            filters["specialization"] = {"$in": [specialization]}
        if min_rating:
            filters["rating"] = {"$gte": float(min_rating)}
            
        # Get therapists
        therapists = Therapist.find_all(filters, limit, skip)
        
        # For each therapist, get user details to show name, etc.
        result = []
        for therapist in therapists:
            # Convert ObjectId to string for JSON serialization
            therapist = convert_object_ids(therapist)
            
            # Get basic user info
            user_info = User.find_by_id(therapist["user_id"])
            if user_info and gender and user_info.get("gender") != gender:
                continue  # Skip if gender filter doesn't match
                
            if user_info:
                therapist["name"] = user_info.get("username")
                therapist["gender"] = user_info.get("gender")
                therapist["profile_picture"] = user_info.get("profile_picture")
                
            result.append(therapist)
            
        return JsonResponse({
            "success": True,
            "count": len(result),
            "therapists": result
        })
        
    except Exception as e:
        return JsonResponse({
            "success": False,
            "message": str(e)
        }, status=500)

@require_http_methods(["GET"])
def get_therapist_profile(request, therapist_id):
    """Get detailed profile for a specific therapist"""
    try:
        therapist = Therapist.find_by_user_id(therapist_id)
        if not therapist:
            return JsonResponse({
                "success": False,
                "message": "Therapist not found"
            }, status=404)
            
        # Convert ObjectId to string for JSON serialization
        therapist = convert_object_ids(therapist)
        
        # Get user details
        user_info = User.find_by_id(therapist_id)
        if user_info:
            therapist["name"] = user_info.get("username")
            therapist["gender"] = user_info.get("gender")
            therapist["profile_picture"] = user_info.get("profile_picture")
            therapist["bio"] = user_info.get("bio")
            
        # Get feedback for this therapist
        feedback = Feedback.find_by_therapist(therapist_id, limit=5)
        therapist["feedback"] = convert_object_ids(feedback)
            
        return JsonResponse({
            "success": True,
            "therapist": therapist
        })
        
    except Exception as e:
        return JsonResponse({
            "success": False,
            "message": str(e)
        }, status=500)

@csrf_exempt
@require_http_methods(["POST"])
def update_availability(request, therapist_id):
    """Update therapist availability slots"""
    try:
        # Check authentication
        current_user = get_user_from_request(request)
        if not current_user or str(current_user.get("_id")) != therapist_id:
            return JsonResponse({
                "success": False,
                "message": "Unauthorized"
            }, status=401)
            
        data = json.loads(request.body)
        available_slots = data.get("available_slots", [])
        
        # Update availability
        result = Therapist.update_availability(therapist_id, available_slots)
        
        return JsonResponse({
            "success": True,
            "message": "Availability updated successfully"
        })
        
    except Exception as e:
        return JsonResponse({
            "success": False,
            "message": str(e)
        }, status=500)

@csrf_exempt
@require_http_methods(["PUT"])
def update_therapist_profile(request, therapist_id):
    """Update therapist profile information"""
    try:
        # Check authentication
        current_user = get_user_from_request(request)
        if not current_user or str(current_user.get("_id")) != therapist_id:
            return JsonResponse({
                "success": False,
                "message": "Unauthorized"
            }, status=401)
            
        data = json.loads(request.body)
        
        # Update user information
        user_updates = {}
        for key in ["username", "phone", "address", "bio", "profile_picture"]:
            if key in data:
                user_updates[key] = data[key]
                
        if user_updates:
            User.update_profile(current_user.get("email"), user_updates)
            
        # Update therapist information
        therapist_updates = {}
        for key in ["specialization", "experience", "education", 
                   "license_number", "hourly_rate", "languages"]:
            if key in data:
                therapist_updates[key] = data[key]
                
        if therapist_updates:
            Therapist.update_therapist(therapist_id, therapist_updates)
            
        return JsonResponse({
            "success": True,
            "message": "Profile updated successfully"
        })
        
    except Exception as e:
        return JsonResponse({
            "success": False,
            "message": str(e)
        }, status=500)

@csrf_exempt
@require_http_methods(["POST"])
def verify_therapist(request, therapist_id):
    """Admin endpoint to verify a therapist"""
    try:
        # Check if admin
        current_user = get_user_from_request(request)
        if not current_user or current_user.get("role") != "admin":
            return JsonResponse({
                "success": False,
                "message": "Unauthorized. Admin access required."
            }, status=401)
            
        # Update verification status
        Therapist.update_therapist(therapist_id, {"is_verified": True})
        
        return JsonResponse({
            "success": True,
            "message": "Therapist verified successfully"
        })
        
    except Exception as e:
        return JsonResponse({
            "success": False,
            "message": str(e)
        }, status=500)
        
@require_http_methods(["GET"])
def list_therapists(request):
    """Get a list of all verified therapists"""
    try:
        # Check authentication
        current_user = get_user_from_request(request)
        if not current_user:
            return JsonResponse({
                "success": False,
                "message": "Authentication required"
            }, status=401)
            
        # Extract pagination parameters
        limit = int(request.GET.get("limit", 10))
        skip = int(request.GET.get("skip", 0))
        recommended = request.GET.get("recommended", "").lower() == "true"
        
        # Get all verified therapists
        therapists = Therapist.get_all_therapists(limit=limit*2, skip=skip)  # Get more to allow for filtering
        
        # For each therapist, get user details to show name, etc.
        result = []
        for therapist in therapists:
            # Convert ObjectId to string for JSON serialization
            therapist = convert_object_ids(therapist)
            
            # Get basic user info
            user_info = User.find_by_id(therapist["user_id"])
            if user_info:
                therapist["name"] = user_info.get("username")
                therapist["gender"] = user_info.get("gender")
                therapist["profile_picture"] = user_info.get("profile_picture")
                # Apply Cloudinary transformation for consistent image sizing
                if therapist["profile_picture"] and "cloudinary" in therapist["profile_picture"] and "/upload/" in therapist["profile_picture"]:
                    therapist["profile_picture"] = therapist["profile_picture"].replace('/upload/', '/upload/c_fill,g_face,h_225,w_225/')
                
            result.append(therapist)
        
        # If recommended=true, apply recommendation logic
        if recommended:
            # First, try to use user preferences if available
            user_preferences = None
            if current_user and "preferences" in current_user:
                user_preferences = current_user.get("preferences", {})
            
            if user_preferences and "topics_of_interest" in user_preferences and user_preferences["topics_of_interest"]:
                # Filter by user's topics of interest
                topics = user_preferences["topics_of_interest"]
                filtered_results = [t for t in result if 
                                  any(topic in (t.get("specialization", []) + t.get("focus_areas", [])) 
                                      for topic in topics)]
                
                # If we found matches, use them; otherwise fall back to rating-based sorting
                if filtered_results:
                    result = filtered_results
            
            # Sort by rating (highest first)
            result.sort(key=lambda t: t.get("rating", 0), reverse=True)
            
            # Limit results to requested amount
            result = result[:limit]
        
        return JsonResponse({
            "success": True,
            "count": len(result),
            "therapists": result
        })
        
    except Exception as e:
        return JsonResponse({
            "success": False,
            "message": str(e)
        }, status=500)

@require_http_methods(["GET"])
def search_therapists(request):
    """Advanced therapist search with multiple filters"""
    try:
        # Basic filters
        query = request.GET.get("query", "")
        specialization = request.GET.getlist("specialization", [])
        focus_areas = request.GET.getlist("focus_area", [])
        min_experience = int(request.GET.get("min_experience", 0))
        max_price = float(request.GET.get("max_price", 100000))
        session_format = request.GET.get("session_format")
        languages = request.GET.getlist("language", [])
        rating = float(request.GET.get("min_rating", 0))
        
        # Pagination
        limit = int(request.GET.get("limit", 10))
        skip = int(request.GET.get("skip", 0))
        
        # Get available therapists with filters
        therapists = Therapist.search_with_filters(
            query=query,
            specialization=specialization,
            focus_areas=focus_areas,
            min_experience=min_experience,
            max_price=max_price,
            session_format=session_format,
            languages=languages,
            min_rating=rating,
            limit=limit,
            skip=skip
        )
        
        # Add user data to each therapist
        results = []
        for therapist in therapists:
            therapist_data = convert_object_ids(therapist)
            
            # Get user data for this therapist
            user = User.find_by_id(therapist["user_id"])
            if user:
                therapist_data["name"] = user.get("username")
                therapist_data["profile_picture"] = user.get("profile_picture")
                therapist_data["gender"] = user.get("gender")
            
            results.append(therapist_data)
        
        # Return paginated results with count
        total = Therapist.count_with_filters(query, specialization, min_experience, max_price)
        
        return JsonResponse({
            "success": True,
            "therapists": results,
            "total": total,
            "has_more": (skip + len(results)) < total
        })
        
    except Exception as e:
        return JsonResponse({
            "success": False, 
            "message": str(e)
        }, status=500)

@require_http_methods(["GET"])
def get_therapist_details(request, therapist_id):
    """Get detailed profile for a specific therapist"""
    try:
        # First try to find the therapist directly by therapist_id (from therapists collection)
        from bson.objectid import ObjectId
        therapist = therapists_collection.find_one({"_id": ObjectId(therapist_id)})
        user_id = None

        # If found, extract the user_id
        if therapist:
            user_id = therapist.get("user_id")
            print(f"Found therapist by therapist_id, user_id: {user_id}")
        else:
            # If not found, assume therapist_id is actually a user_id
            user_id = therapist_id
            print(f"Using provided ID as user_id: {user_id}")
        
        # Now use the user_id to get the complete information
        user = User.find_by_id(user_id)
        if not user or user.get("role") != "therapist":
            return JsonResponse({
                "success": False,
                "message": "Therapist not found"
            }, status=404)

        # Get therapist details using the user_id
        therapist = Therapist.find_by_user_id(user_id)
        if not therapist:
            return JsonResponse({
                "success": False,
                "message": "Therapist profile not found"
            }, status=404)
            
        # Convert ObjectId to string for JSON serialization
        therapist = convert_object_ids(therapist)
        user = convert_object_ids(user)
        
        # Combine user and therapist details
        result = {**therapist}
        result["username"] = user.get("username")
        result["email"] = user.get("email")
        result["gender"] = user.get("gender")
        result["phone"] = user.get("phone")
        result["profile_picture"] = user.get("profile_picture")
        result["bio"] = user.get("bio") or therapist.get("bio")
            
        # Get feedback for this therapist
        feedback = Feedback.find_by_therapist(str(user_id), limit=5)
        result["feedback"] = convert_object_ids(feedback)
        
        # Process feedback - hide user info if anonymous
        for item in result["feedback"]:
            if item.get("is_anonymous", False):
                item["user_id"] = None
            else:
                # Add user name if not anonymous
                feedback_user = User.find_by_id(item["user_id"])
                if feedback_user:
                    item["user_name"] = feedback_user.get("username")
            
        return JsonResponse({
            "success": True,
            "therapist": result
        })
        
    except Exception as e:
        print(f"Error getting therapist details: {str(e)}")
        return JsonResponse({
            "success": False,
            "message": str(e)
        }, status=500)

@require_http_methods(["GET"])
def get_specializations(request):
    """Get a list of available therapist specializations"""
    try:
        # Define common specializations
        common_specializations = [
            "Anxiety",
            "Depression",
            "Trauma",
            "Relationships",
            "Family Therapy",
            "Stress Management",
            "Addiction",
            "Grief & Loss",
            "Self-esteem",
            "Life Transitions",
            "PTSD",
            "OCD",
            "Bipolar Disorder",
            "Eating Disorders",
            "Sleep Issues",
            "Career Counseling",
            "LGBTQ+",
            "Mindfulness",
            "Cognitive Behavioral Therapy (CBT)",
            "Dialectical Behavior Therapy (DBT)"
        ]
        
        # Get specializations from the database
        pipeline = [
            {"$match": {"is_verified": True}},
            {"$unwind": "$specializations"},
            {"$group": {"_id": "$specializations"}},
            {"$sort": {"_id": 1}}
        ]
        
        db_specializations = list(therapists_collection.aggregate(pipeline))
        actual_specializations = [spec["_id"] for spec in db_specializations]
        
        # Combine both lists and remove duplicates
        all_specializations = list(set(common_specializations + actual_specializations))
        all_specializations.sort()
        
        return JsonResponse({
            "success": True,
            "specializations": all_specializations
        })
        
    except Exception as e:
        return JsonResponse({
            "success": False,
            "message": str(e)
        }, status=500)