from django.apps import AppConfig
import os

class FeedbacksConfig(AppConfig):
    name = 'apps.feedbacks'
    path = os.path.dirname(os.path.abspath(__file__))