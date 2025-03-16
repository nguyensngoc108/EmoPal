import api from './api';

const UserServices = {
  // Remove userId parameter - current user is identified by token
  getUserProfile: () => {
    return api.get('/users/profile/');
  },
  
  updateUserProfile: (profileData) => {
    return api.put('/users/profile/', profileData);
  },
  
  updatePassword: (passwordData) => {
    return api.put('/users/password/', passwordData);
  },
  
  updateNotificationSettings: (settings) => {
    return api.put('/users/notifications/', settings);
  },
  
  uploadProfilePicture: (imageFile) => {
    const formData = new FormData();
    formData.append('profile_picture', imageFile);
    
    return api.post('/users/profile-picture/', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
  }
};

export default UserServices;