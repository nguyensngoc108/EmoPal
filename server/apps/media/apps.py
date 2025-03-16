from django.apps import AppConfig
import os

class MediaConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.media'
    path = os.path.dirname(os.path.abspath(__file__))