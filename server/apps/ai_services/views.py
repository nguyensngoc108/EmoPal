from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
import json
from datetime import datetime

from apps.utils.auth import get_user_from_request
from apps.ai_services.help_assistant import HelpAssistant

@csrf_exempt
@require_http_methods(["POST"])
def help_request(request):
    """Handle help requests from the client"""
    try:
        # Check authentication (optional - allow anonymous for help)
        current_user = get_user_from_request(request)
        user_id = str(current_user.get("_id")) if current_user else "anonymous"
        
        # Parse request data
        data = json.loads(request.body)
        query = data.get('query', '')
        context = data.get('context', {})
        
        # Generate help response
        help_assistant = HelpAssistant()
        response = help_assistant.get_response(query, context)
        
        # Return response
        return JsonResponse({
            "success": True,
            "message": response.get("message", ""),
            "suggestions": response.get("suggestions", []),
            "actions": response.get("actions", [])
        })
        
    except Exception as e:
        return JsonResponse({
            "success": False,
            "message": str(e)
        }, status=500)