from django.urls import path
from . import views

urlpatterns = [
    # Other payment URLs
    path('checkout/<str:session_id>/', views.create_payment, name='create_payment'),
    path('history/', views.get_payment_history, name='payment_history'),
    path('details/<str:payment_id>/', views.get_payment_details, name='payment_details'),
    
    # Webhook URL - No authentication required
    path('webhook/', views.stripe_webhook, name='stripe_webhook'),
    
    # Other payment URLs
    path('refund/<str:payment_id>/', views.refund_payment, name='refund_payment'),
    path('invoice/<str:payment_id>/', views.get_invoice, name='get_invoice'),
    path('status/<str:session_id>/', views.check_payment_status, name='check_payment_status'),
]