from django.urls import path
from . import upload_image

# URLs for media operations
urlpatterns = [
    path('upload-avatar/', upload_image.upload_avatar, name='upload_avatar'),
]