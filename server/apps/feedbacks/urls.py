from django.urls import path
from . import views

urlpatterns = [
    path("submit/<str:therapist_id>/", views.submit_feedback, name="submit_feedback"),
    path("therapist/<str:therapist_id>/", views.get_therapist_feedback, name="get_therapist_feedback"),
    path("<str:feedback_id>/update/", views.update_feedback, name="update_feedback"),
    path("<str:feedback_id>/delete/", views.delete_feedback, name="delete_feedback"),
]