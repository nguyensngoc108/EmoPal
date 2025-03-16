import os
import uuid
import cloudinary
import cloudinary.uploader
from datetime import datetime
import tempfile
from django.conf import settings
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure Cloudinary
cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME", "dwzc8mfhe"),
    api_key=os.getenv("CLOUDINARY_API_KEY", "145415128253743"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET", "TwD7ECTYCkNTWk0-iyORWzh2KnM")
)

def generate_secure_filename(username, file_extension):
    """Generate a secure filename for uploading to Cloudinary"""
    unique_id = uuid.uuid4().hex[:10]  # First 10 chars of a UUID
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    return f"{username}_{timestamp}_{unique_id}{file_extension}"

def get_file_extension(filename):
    """Extract file extension from filename"""
    _, extension = os.path.splitext(filename)
    return extension.lower()

def is_valid_image(extension):
    """Check if file extension is a valid image format"""
    valid_extensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp']
    return extension in valid_extensions

def is_valid_video(extension):
    """Check if file extension is a valid video format"""
    valid_extensions = ['.mp4', '.mov', '.avi', '.wmv', '.flv', '.webm', '.mkv']
    return extension in valid_extensions

def determine_media_type(extension):
    """Determine if file is image or video based on extension"""
    if is_valid_image(extension):
        return "image"
    elif is_valid_video(extension):
        return "video"
    return None

def upload_to_cloudinary(file_data, username, folder="emotion_analysis"):
    """
    Upload a file to Cloudinary
    
    Args:
        file_data: The file object or bytes data
        username: Username to include in the filename
        folder: Cloudinary folder to store the file in
        
    Returns:
        dict with upload result or None if failed
    """
    try:
        # Get file extension
        if hasattr(file_data, 'name'):
            extension = get_file_extension(file_data.name)
        else:
            # For temporary files without names, default to .jpg
            extension = '.jpg'
            
        # Generate secure public_id
        secure_filename = generate_secure_filename(username, '')  # No extension in public_id
        public_id = f"{folder}/{secure_filename}"
        
        # Determine the resource type
        media_type = determine_media_type(extension)
        resource_type = "auto"  # Let Cloudinary auto-detect
        
        # Upload to Cloudinary
        upload_result = cloudinary.uploader.upload(
            file_data, 
            public_id=public_id,
            resource_type=resource_type,
            overwrite=True
        )
        
        # Create result record
        result = {
            "url": upload_result['secure_url'],
            "public_id": upload_result['public_id'],
            "resource_type": upload_result['resource_type'],
            "format": upload_result.get('format', ''),
            "created_at": datetime.utcnow(),
            "media_type": media_type,
            "width": upload_result.get('width'),
            "height": upload_result.get('height')
        }
        
        return result
        
    except Exception as e:
        print(f"Upload failed: {e}")
        return None

def delete_from_cloudinary(public_id, resource_type="image"):
    """Delete a file from Cloudinary"""
    try:
        result = cloudinary.uploader.destroy(public_id, resource_type=resource_type)
        return result.get('result') == 'ok'
    except Exception as e:
        print(f"Delete failed: {e}")
        return False