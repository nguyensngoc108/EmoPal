from django.urls import path
from . import views

urlpatterns = [
    # Feature endpoints should come BEFORE parameter-based endpoints
    path("upcoming/", views.get_upcoming_sessions, name="get_upcoming_sessions"),
    path("past/", views.get_past_sessions, name="get_past_sessions"),
    
    # Regular routes
    path("book/", views.book_session, name="book_session"),
    path("user/", views.get_user_sessions, name="get_user_sessions"),
    path("therapist/", views.get_therapist_sessions, name="get_therapist_sessions"),
    
    # Required bidirectional booking routes
    path("request/", views.request_session, name="request_session"),
    path("propose/", views.propose_session, name="propose_session"),
    
    # Availability management
    path("availability/", views.get_availability, name="get_availability"),
    path("availability/set/", views.set_availability, name="set_availability"),
    path("availability/<str:therapist_id>/", views.get_therapist_availability, name="get_therapist_availability"),
    
    # Parameter-based routes MUST come after static routes
    path('initiate-video-call/', views.initiate_video_call, name='initiate_video_call'),
    path("availability/<str:availability_id>/", views.update_availability, name="update_availability"),
    path("<str:session_id>/status/", views.update_session_status, name="update_session_status"),
    path("<str:session_id>/notes/", views.add_session_notes, name="add_session_notes"),
    path("<str:session_id>/cancel/", views.cancel_session, name="cancel_session"),
    path('<str:session_id>/video/', views.get_video_session_info, name='video_session_info'),
    path("<str:session_id>/recording/upload/", views.upload_session_recording, name="upload_session_recording"),
    path("<str:session_id>/accept/", views.accept_session, name="accept_session"),
    path("<str:session_id>/payment/confirm/", views.confirm_payment, name="confirm_payment"),
    path("<str:session_id>/reschedule/", views.reschedule_session, name="reschedule_session"),
    
    # The most generic route must be last
    path("<str:session_id>/", views.get_session_details, name="get_session_details"),
]