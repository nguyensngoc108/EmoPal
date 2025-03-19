#!/usr/bin/env python3
"""
Script to reset passwords for all therapist accounts to a common value.
This is for development/testing purposes only.
"""

import os
import sys
from datetime import datetime

# Add the project root directory to the Python path
sys.path.append(os.path.abspath(os.path.dirname(os.path.dirname(__file__))))

from database import db
from bson.objectid import ObjectId
from werkzeug.security import generate_password_hash

# Get collections
users_collection = db["users"]

def reset_therapist_passwords(new_password="therapisttest123"):
    """
    Reset password for all users with role='therapist' to the specified value
    """
    print(f"Starting password reset for all therapist accounts...")
    
    # Find all users with therapist role
    therapist_users = list(users_collection.find({"role": "therapist"}))
    print(f"Found {len(therapist_users)} therapist user accounts")
    
    updated_count = 0
    error_count = 0
    
    for user in therapist_users:
        user_id = user["_id"]
        email = user.get("email")
        username = user.get("username")
        
        try:
            # Generate password hash using werkzeug's scrypt method
            # CRITICAL FIX: Make sure this matches exactly how passwords are created in your User model
            hashed_password = generate_password_hash(new_password, method='scrypt')
            
            # Debug output to verify hash format
            print(f"Generated hash: {hashed_password}")
            
            # Update the user document with the new password
            result = users_collection.update_one(
                {"_id": user_id},
                {
                    "$set": {
                        "password": hashed_password,
                        "updated_at": datetime.utcnow()
                    }
                }
            )
            
            # Verify update
            updated_user = users_collection.find_one({"_id": user_id})
            print(f"Stored hash: {updated_user.get('password')[:30]}...")
            
            if result.modified_count == 1:
                updated_count += 1
                print(f"Updated password for {username} ({email})")
            else:
                print(f"No change for {username} ({email})")
            
        except Exception as e:
            print(f"Error updating password for {username} ({email}): {str(e)}")
            error_count += 1
    
    print(f"\nPassword reset completed:")
    print(f"- {updated_count} passwords updated")
    print(f"- {error_count} errors encountered")
    print(f"\nPassword format example: {generate_password_hash('example', method='scrypt')}")
    return updated_count, error_count

def verify_therapist_accounts():
    """
    Verify therapist accounts after password reset
    """
    therapist_count = users_collection.count_documents({"role": "therapist"})
    print(f"\nVerification: Found {therapist_count} therapist accounts in database")
    
    if therapist_count == 0:
        print("Warning: No therapist accounts found. Check if role field is set correctly.")
    
    # List first 5 therapist accounts for verification
    print("\nSample therapist accounts:")
    for user in users_collection.find({"role": "therapist"}).limit(5):
        print(f"- {user.get('username')} ({user.get('email')})")
        # Show password format but not the full hash for security
        password = user.get('password', '')
        if password:
            print(f"  Password format: {password[:30]}...")

def test_password_verification():
    """Test if the password verification works correctly"""
    print("\n=== Testing Password Verification ===")
    
    # Get a therapist user
    therapist = users_collection.find_one({"role": "therapist"})
    if not therapist:
        print("No therapist found to test")
        return
    
    email = therapist.get("email")
    username = therapist.get("username")
    stored_hash = therapist.get("password")
    
    print(f"Testing login for: {username} ({email})")
    print(f"Stored password hash: {stored_hash[:30]}...")
    
    # Test with the reset password
    test_password = "therapisttest123"
    from werkzeug.security import check_password_hash
    
    # Verify using werkzeug's function
    is_valid = check_password_hash(stored_hash, test_password)
    print(f"Password verification result: {is_valid}")
    
    if not is_valid:
        print("ERROR: Password verification failed!")
        print("This indicates that either:")
        print("1. The password hash format doesn't match what check_password_hash expects")
        print("2. The password wasn't correctly updated in the database")
    else:
        print("Password verification successful!")

if __name__ == "__main__":
    print("=== Therapist Account Password Reset ===")
    print("WARNING: This will reset ALL therapist passwords!")
    confirm = input("Type 'YES' to continue or anything else to cancel: ")
    
    if confirm.upper() == "YES":
        updated, errors = reset_therapist_passwords()
        if updated > 0:
            verify_therapist_accounts()
            test_password_verification()  # Add this line
        print("\nNew password for all therapist accounts: therapisttest123")
    else:
        print("Operation cancelled.")