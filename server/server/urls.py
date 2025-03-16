from django.contrib import admin
from django.urls import path, include, re_path
from django.views.generic import TemplateView
from django.conf import settings
from django.conf.urls.static import static
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)
from apps.ai_services import views as ai_views
from apps.utils.views import index

urlpatterns = [
    path('admin/', admin.site.urls),
    
    # API endpoints
    path('api/users/', include('apps.users.urls')),
    path('api/therapists/', include('apps.therapists.urls')),
    path('api/sessions/', include('apps.therapy_sessions.urls')),
    path('api/messages/', include('apps.chat_messages.urls')),
    path('api/feedback/', include('apps.feedbacks.urls')),
    path('api/emotions/', include('apps.emotions.urls')), 
    path('api/chat/', include('apps.chat_messages.urls')),
    path('api/utils/', include('apps.media.urls')),
    path('api/media/', include('apps.utils.urls')),
    path('api/help/', ai_views.help_request, name='help_request'),
    path('api/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/payments/', include('apps.payments.urls')),
    path('api/ai_services/', include('apps.ai_services.urls')),
    
    # Serve static files
] + static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)

# Serve React App - this must be the last pattern
urlpatterns += [re_path(r'^.*', index)]