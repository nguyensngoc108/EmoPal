from django.urls import path
from . import views

urlpatterns = [
    path('upload/', views.upload_and_analyze, name='upload_and_analyze'),
    path('analysis/<str:analysis_id>/', views.get_analysis_details, name='get_analysis_details'),
    path('history/', views.get_user_analyses, name='get_user_analyses'),
    path('trends/', views.get_emotion_trends, name='get_emotion_trends'),
    path('visualization/<str:analysis_id>/<str:viz_type>/', views.get_visualization, name='get_visualization'),
    path('delete/<str:analysis_id>/', views.delete_analysis, name='delete_analysis'),
    path('test-live/', views.test_live_emotion, name='test_live_emotion'),
]