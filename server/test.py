#!/usr/bin/env python3
"""
Script to add therapist_id field to user documents for users who are therapists.
This creates a bidirectional relationship between the users and therapists collections.
"""

import os
import sys
from datetime import datetime

# Add the project root directory to the Python path
sys.path.append(os.path.abspath(os.path.dirname(os.path.dirname(__file__))))

from database import db
from bson.objectid import ObjectId

# Get collections
users_collection = db["users"]
therapists_collection = db["therapists"]

def update_users_with_therapist_ids():
    """
    Find all therapists, then update their corresponding user documents 
    with a therapist_id field referencing the therapist document.
    """
    print("Starting update of user documents with therapist_id...")
    
    # Get all therapists
    therapists = list(therapists_collection.find({}, {"_id": 1, "user_id": 1}))
    print(f"Found {len(therapists)} therapist documents")
    
    updated_count = 0
    error_count = 0
    
    for therapist in therapists:
        therapist_id = therapist["_id"]
        user_id = therapist["user_id"]
        
        try:
            # Make sure user_id is an ObjectId
            if not isinstance(user_id, ObjectId):
                user_id = ObjectId(user_id)
            
            # Update the user document with therapist_id
            result = users_collection.update_one(
                {"_id": user_id},
                {
                    "$set": {
                        "therapist_id": therapist_id,
                        "role": "therapist",  # Ensure role is set correctly
                        "updated_at": datetime.utcnow()
                    }
                }
            )
            
            if result.matched_count == 0:
                print(f"Warning: No user found with _id: {user_id}")
                error_count += 1
            elif result.modified_count == 1:
                updated_count += 1
                print(f"Updated user {user_id} with therapist_id {therapist_id}")
            else:
                print(f"User {user_id} already has therapist_id set")
        
        except Exception as e:
            print(f"Error updating user {user_id}: {str(e)}")
            error_count += 1
    
    print(f"Update completed: {updated_count} users updated, {error_count} errors")
    return updated_count, error_count

def verify_bidirectional_relationships():
    """
    Verify that all therapists have a corresponding user with therapist_id
    and all users with therapist_id have a corresponding therapist.
    """
    print("\nVerifying bidirectional relationships...")
    
    # Check users with therapist_id
    users_with_therapist_id = list(users_collection.find(
        {"therapist_id": {"$exists": True}},
        {"_id": 1, "therapist_id": 1, "username": 1}
    ))
    print(f"Found {len(users_with_therapist_id)} users with therapist_id field")
    
    # Check therapists
    therapist_count = therapists_collection.count_documents({})
    print(f"Total therapists in database: {therapist_count}")
    
    # Check for users with invalid therapist_id
    invalid_count = 0
    for user in users_with_therapist_id:
        therapist_id = user["therapist_id"]
        therapist = therapists_collection.find_one({"_id": therapist_id})
        
        if not therapist:
            print(f"Warning: User {user['_id']} has invalid therapist_id {therapist_id}")
            invalid_count += 1
    
    if invalid_count == 0:
        print("All user therapist_id references are valid")
    else:
        print(f"Found {invalid_count} users with invalid therapist_id references")
    
    # Check for therapists without corresponding user therapist_id
    missing_count = 0
    for therapist in therapists_collection.find({}, {"_id": 1, "user_id": 1}):
        user = users_collection.find_one({
            "_id": therapist["user_id"], 
            "therapist_id": therapist["_id"]
        })
        
        if not user:
            print(f"Warning: Therapist {therapist['_id']} not referenced by user {therapist['user_id']}")
            missing_count += 1
    
    if missing_count == 0:
        print("All therapists are properly referenced by users")
    else:
        print(f"Found {missing_count} therapists not properly referenced by users")

if __name__ == "__main__":
    print("=== User-Therapist Bidirectional Relationship Update ===")
    update_count, error_count = update_users_with_therapist_ids()
    
    if update_count > 0 or error_count > 0:
        verify_bidirectional_relationships()
    
    print("Script completed")