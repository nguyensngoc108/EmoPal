from django.apps import AppConfig
import os

class MessagesConfig(AppConfig):
    name = 'apps.chat_messages'
    path = os.path.dirname(os.path.abspath(__file__))
    app_label = 'chat_messages'  # This ensures uniqueness