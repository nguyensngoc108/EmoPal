from django.urls import path
from . import views

urlpatterns = [
    path("submit/<str:therapist_id>/", views.submit_feedback, name="submit_feedback"),
    path("therapist/<str:therapist_id>/", views.get_therapist_feedback, name="get_therapist_feedback"),
    path("therapist/<str:therapist_id>/stats/", views.get_therapist_feedback_stats, name="get_therapist_feedback_stats"),
    path("session/<str:session_id>/", views.get_session_feedback, name="get_session_feedback"),
    path("session/<str:session_id>/submit/", views.submit_session_feedback, name="submit_session_feedback"),
    path("<str:feedback_id>/update/", views.update_feedback, name="update_feedback"),
    path("<str:feedback_id>/delete/", views.delete_feedback, name="delete_feedback"),
    path("user/history/", views.get_user_feedback_history, name="get_user_feedback_history"),
]