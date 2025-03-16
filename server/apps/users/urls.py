from django.urls import path
from .views import register_user, login_user, update_profile, delete_user, get_user_profile, update_profile_picture, update_password

urlpatterns = [
    path("register/", register_user, name="register_user"),
    path("login/", login_user, name="login_user"),
    path("update/", update_profile, name="update_profile"),
    path("profile-picture/", update_profile_picture, name="update_profile_picture"),
    path("password/", update_password, name="update_password"),
    path("delete/", delete_user, name="delete_user"),
    path("profile/", get_user_profile, name="get_user_profile"),
]