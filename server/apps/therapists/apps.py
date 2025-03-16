from django.apps import AppConfig
import os

class TherapistsConfig(AppConfig):
    name = 'apps.therapists'
    path = os.path.dirname(os.path.abspath(__file__))