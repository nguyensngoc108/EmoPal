from django.apps import AppConfig
import os

class UtilsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.utils'
    path = os.path.dirname(os.path.abspath(__file__))