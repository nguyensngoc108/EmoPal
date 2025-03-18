from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
import json
from datetime import datetime

from apps.utils.auth import get_user_from_request
from apps.ai_services.help_assistant import HelpAssistant

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
import logging

logger = logging.getLogger(__name__)

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

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def initialize_emotion_analysis(request):
    """
    Initialize an emotion analysis session
    """
    try:
        session_id = request.data.get('session_id')
        if not session_id:
            return Response({"error": "Session ID is required"}, status=status.HTTP_400_BAD_REQUEST)
        
        # Record session initialization
        logger.info(f"Emotion analysis initialized for session {session_id} by user {request.user.id}")
        
        # Return session token or ID
        return Response({
            "session_id": session_id,
            "initialized_at": datetime.now().isoformat(),
            "message": "Emotion analysis session initialized successfully"
        })
        
    except Exception as e:
        logger.error(f"Error initializing emotion analysis: {str(e)}")
        return Response({"error": f"Failed to initialize: {str(e)}"}, 
                        status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_emotion_analysis_history(request, session_id):
    """
    Get emotion analysis history for a session
    """
    try:
        # Here you would fetch stored analysis data from your database
        # For mocking purposes, we'll return some sample data
        
        return Response({
            "session_id": session_id,
            "history": [
                {
                    "timestamp": "2025-03-16T15:30:45.123Z",
                    "dominant_emotion": "neutral",
                    "valence": 0.1,
                    "engagement": 65
                },
                {
                    "timestamp": "2025-03-16T15:31:15.456Z",
                    "dominant_emotion": "happy",
                    "valence": 0.6,
                    "engagement": 78
                }
            ],
            "summary": {
                "dominant_emotions": ["neutral", "happy"],
                "average_valence": 0.35,
                "average_engagement": 71.5,
                "emotional_stability": 0.7
            }
        })
        
    except Exception as e:
        logger.error(f"Error getting emotion history: {str(e)}")
        return Response({"error": f"Failed to retrieve history: {str(e)}"},
                       status=status.HTTP_500_INTERNAL_SERVER_ERROR)