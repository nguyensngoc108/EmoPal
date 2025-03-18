from django.urls import re_path, path
from . import consumers

websocket_urlpatterns = [
    path('ws/emotion_analysis/<str:session_id>/', consumers.EmotionAnalysisConsumer.as_asgi()),
]