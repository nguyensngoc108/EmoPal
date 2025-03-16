import cloudinary
import cloudinary.uploader
import cloudinary.api
import os
import logging
from django.conf import settings

logger = logging.getLogger(__name__)

# Configure Cloudinary
cloudinary.config(
    cloud_name=os.environ.get("CLOUDINARY_CLOUD_NAME"),
    api_key=os.environ.get("CLOUDINARY_API_KEY"),
    api_secret=os.environ.get("CLOUDINARY_API_SECRET"),
    secure=True
)

def upload_file_to_cloudinary(file_path, folder=None, public_id=None, resource_type="auto"):
    """
    Upload a file to Cloudinary
    
    Args:
        file_path: Path to file to upload
        folder: Optional folder in Cloudinary
        public_id: Optional public ID for the file
        resource_type: auto, image, video or raw
        
    Returns:
        dict: Cloudinary response
    """
    try:
        upload_options = {
            "resource_type": resource_type
        }
        
        if folder:
            upload_options["folder"] = folder
            
        if public_id:
            upload_options["public_id"] = public_id
            
        # Upload the file
        response = cloudinary.uploader.upload(file_path, **upload_options)
        logger.info(f"Uploaded file to Cloudinary: {response.get('public_id')}")
        return response
        
    except Exception as e:
        logger.error(f"Error uploading to Cloudinary: {str(e)}")
        raise

def delete_from_cloudinary(public_id, resource_type="image"):
    """Delete a file from Cloudinary"""
    try:
        response = cloudinary.uploader.destroy(public_id, resource_type=resource_type)
        logger.info(f"Deleted file from Cloudinary: {public_id}, Result: {response}")
        return response
    except Exception as e:
        logger.error(f"Error deleting from Cloudinary: {str(e)}")
        raise