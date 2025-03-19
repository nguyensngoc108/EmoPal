from django.urls import path
from .views import (register_user, login_user, delete_user, 
                    update_profile_picture, update_password, user_profile)

urlpatterns = [
    path("register/", register_user, name="register_user"),
    path("login/", login_user, name="login_user"),
    path("profile/", user_profile, name="user_profile"),  # Combined view for GET/PUT
    path("profile-picture/", update_profile_picture, name="update_profile_picture"),
    path("password/", update_password, name="update_password"),
    path("delete/", delete_user, name="delete_user"),
]