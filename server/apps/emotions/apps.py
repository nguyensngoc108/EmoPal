from django.apps import AppConfig
import os

class EmotionsConfig(AppConfig):
    name = 'apps.emotions'
    path = os.path.dirname(os.path.abspath(__file__))