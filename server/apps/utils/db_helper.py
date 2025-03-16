from bson import ObjectId
from datetime import datetime
import json

def convert_object_ids(document):
    """Convert ObjectIds in MongoDB document to strings for JSON serialization"""
    if document is None:
        return None
        
    result = {}
    for key, value in document.items():
        # Convert ObjectId to string
        if isinstance(value, ObjectId):
            result[key] = str(value)
        # Convert datetime to ISO format
        elif isinstance(value, datetime):
            result[key] = value.isoformat()
        # Recursively convert nested dictionaries
        elif isinstance(value, dict):
            result[key] = convert_object_ids(value)
        # Convert lists of documents
        elif isinstance(value, list) and value and isinstance(value[0], dict):
            result[key] = [convert_object_ids(item) if isinstance(item, dict) else item for item in value]
        else:
            result[key] = value
            
    return result

class MongoJSONEncoder(json.JSONEncoder):
    """JSON encoder that handles MongoDB types"""
    def default(self, obj):
        if isinstance(obj, ObjectId):
            return str(obj)
        if isinstance(obj, datetime):
            return obj.isoformat()
        return super().default(obj)