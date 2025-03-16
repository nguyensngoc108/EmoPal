from django.urls import path
from . import views

urlpatterns = [
    path('conversations/', views.get_conversations, name='get_conversations'),
    # Query conversations with filters
    path('conversations/video/query/', views.get_conversations_by_query, name='get_conversations_by_query'),
    path('conversations/<str:conversation_id>/',
         views.get_conversation_details, name='get_conversation_details'),
    path('conversations/<str:conversation_id>/messages/',
         views.get_conversation_history, name='get_conversation_history'),
    path('sessions/<str:session_id>/messages/',
         views.get_session_chat, name='get_session_chat'),
    path("unread/", views.get_unread_count, name="get_unread_count"),
    path("read/<str:message_id>/", views.mark_as_read, name="mark_as_read"),
    path("delete/<str:message_id>/", views.delete_message, name="delete_message"),
]
