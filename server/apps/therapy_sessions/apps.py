from django.apps import AppConfig
import os

class SessionsConfig(AppConfig):
    name = 'apps.therapy_sessions'
    path = os.path.dirname(os.path.abspath(__file__))
    app_label = 'therapy_sessions'  # This ensures uniqueness