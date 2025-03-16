from django.apps import AppConfig
import os

class PaymentsConfig(AppConfig):
    name = 'apps.payments'
    path = os.path.dirname(os.path.abspath(__file__))
    app_label = 'payments'