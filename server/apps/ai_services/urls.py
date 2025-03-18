from django.urls import path
from . import views



urlpatterns = [
    path('help/', views.help_request, name='help_request'),
    path('emotion-analysis/initialize/', views.initialize_emotion_analysis, name='initialize_emotion_analysis'),
    path('emotion-analysis/history/<str:session_id>/', views.get_emotion_analysis_history, name='get_emotion_history'),

]