from django.urls import path
from . import views

urlpatterns = [
    # Add this line to enable the root endpoint
    path("", views.list_therapists, name="list_therapists"),  # This will be /api/therapists/
    path("register/", views.register_therapist, name="register_therapist"),
    path("list/", views.list_therapists, name="list_therapists"),  # Keep for backward compatibility
    path("<str:therapist_id>/profile/", views.get_therapist_details, name="get_therapist_profile"),
    path("<str:therapist_id>/", views.get_therapist_details, name="get_therapist_details"),

    path("<str:therapist_id>/availability/", views.update_availability, name="update_availability"),
    path("<str:therapist_id>/verify/", views.verify_therapist, name="verify_therapist"),
    path("profile/update/", views.update_therapist_profile, name="update_therapist_profile"),
    path("specialization/", views.get_specializations, name="get_specializations"),
    path("search/", views.search_therapists, name="search_therapists"),
]