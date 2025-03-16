from django.urls import path
from . import views

urlpatterns = [
    path("media/library/", views.get_user_media_library, name="get_user_media_library"),
    path("media/<str:media_id>/delete/", views.delete_media_item, name="delete_media_item"),
]