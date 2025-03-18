from django.urls import re_path, path
from apps.chat_messages.consumers import ChatConsumer, HelpChatConsumer
from apps.therapy_sessions.consumers import VideoSessionConsumer
from apps.ai_services.consumers import EmotionAnalysisConsumer

websocket_urlpatterns = [
    # User-to-user chat
    path('ws/chat/<str:user_id>/<str:other_user_id>/', ChatConsumer.as_asgi()),
    
    # Session-specific chat
    path('ws/chat/session/<str:session_id>/<str:user_id>/<str:other_user_id>/', ChatConsumer.as_asgi()),
    
    # Therapy plan chat
    path('ws/chat/plan/<str:plan_id>/<str:user_id>/', ChatConsumer.as_asgi()),
    
    # Help/Support bot chat
    path('ws/help/<str:user_id>/', HelpChatConsumer.as_asgi()),
    
    # Add new route for video sessions
    path('ws/video/<str:session_id>/<str:user_id>/', VideoSessionConsumer.as_asgi()),
    
    path('ws/emotion_analysis/<str:session_id>/', EmotionAnalysisConsumer.as_asgi()),
]