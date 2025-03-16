import sys
import os
from database import db

# Collections
users_collection = db["users"]
therapists_collection = db["therapists"]

def update_avatar_urls():
    # Get all therapists
    therapists = list(therapists_collection.find({}))
    count = 0
    
    for therapist in therapists:
        # Get corresponding user
        user = users_collection.find_one({"_id": therapist["user_id"]})
        if not user or "profile_picture" not in user or not user["profile_picture"]:
            continue
            
        profile_pic_url = user["profile_picture"]
        if "cloudinary" not in profile_pic_url:
            continue
        
        # Check if transformation is already applied
        if "/c_fill,g_face,h_225,w_225/" in profile_pic_url:
            continue
            
        # Apply transformation to URL
        parts = profile_pic_url.split('/upload/')
        if len(parts) != 2:
            continue
            
        # Create new URL with transformation
        new_url = f"{parts[0]}/upload/c_fill,g_face,h_225,w_225/{parts[1]}"
        
        # Update the user profile with the new URL
        result = users_collection.update_one(
            {"_id": user["_id"]},
            {"$set": {"profile_picture": new_url}}
        )
        
        if result.modified_count > 0:
            count += 1
            print(f"Updated avatar URL for {user.get('username', 'Unknown')}")
    
    print(f"Updated {count} avatar URLs")

if __name__ == "__main__":
    update_avatar_urls()