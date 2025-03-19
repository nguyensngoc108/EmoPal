import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import UserServices from '../services/UserServices';
import { 
  PencilIcon, CheckIcon, XMarkIcon, CameraIcon, KeyIcon, 
  UserIcon, EnvelopeIcon, PhoneIcon, UserCircleIcon
} from '@heroicons/react/24/solid';
import './UserProfile.css'; // We'll create this file next

const UserProfile = () => {
  const { currentUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  
  // Edit states
  const [editPersonalInfo, setEditPersonalInfo] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  
  // Form values
  const [formValues, setFormValues] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    bio: '',
  });
  
  // Password form values
  const [passwordValues, setPasswordValues] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });
  
  // Avatar upload
  const fileInputRef = useRef(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  // Set form values when profile loads
  useEffect(() => {
    if (profile) {
      setFormValues({
        first_name: profile.first_name || '',
        last_name: profile.last_name || '',
        phone: profile.phone || '',
        bio: profile.bio || '',
      });
    }
  }, [profile]);

  // Fetch user profile
  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        setLoading(true);
        const response = await UserServices.getUserProfile();
        setProfile(response.data.user);
      } catch (err) {
        setError('Failed to load user profile');
        console.error('Error fetching profile:', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchUserProfile();
  }, [currentUser?.user?.id]);

  // Handle input change for profile form
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormValues({
      ...formValues,
      [name]: value,
    });
  };

  // Handle input change for password form  
  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordValues({
      ...passwordValues,
      [name]: value,
    });
  };

  // Handle profile update
  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      const response = await UserServices.updateUserProfile(formValues);
      
      if (response.data.success) {
        // Update profile state with new values
        setProfile({
          ...profile,
          ...formValues
        });
        setEditPersonalInfo(false);
        showSuccess('Profile updated successfully');
      } else {
        setError(response.data.message || 'Failed to update profile');
      }
    } catch (err) {
      setError('Error updating profile: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  // Handle password update
  const handlePasswordUpdate = async (e) => {
    e.preventDefault();
    
    // Validate passwords match
    if (passwordValues.new_password !== passwordValues.confirm_password) {
      setError('New passwords do not match');
      return;
    }
    
    try {
      setLoading(true);
      const response = await UserServices.updatePassword({
        current_password: passwordValues.current_password,
        new_password: passwordValues.new_password
      });
      
      if (response.data.success) {
        setChangingPassword(false);
        setPasswordValues({
          current_password: '',
          new_password: '',
          confirm_password: ''
        });
        showSuccess('Password updated successfully');
      } else {
        setError(response.data.message || 'Failed to update password');
      }
    } catch (err) {
      setError('Error updating password: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  // Handle avatar selection
  const handleAvatarChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      // Create preview URL
      const reader = new FileReader();
      reader.onload = () => {
        setAvatarPreview(reader.result);
      };
      reader.readAsDataURL(file);
      
      // Set upload mode
      setUploadingAvatar(true);
    }
  };

  // Handle avatar upload
  const handleAvatarUpload = async () => {
    try {
      if (!fileInputRef.current?.files?.length) return;
      
      const file = fileInputRef.current.files[0];
      setLoading(true);
      
      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 200);
      
      const response = await UserServices.uploadProfilePicture(file);
      
      clearInterval(progressInterval);
      setUploadProgress(100);
      
      if (response.data.success) {
        // Update profile with new avatar URL
        setProfile({
          ...profile,
          profile_picture: response.data.profile_picture
        });
        
        showSuccess('Profile picture updated successfully');
        
        // Reset states
        setTimeout(() => {
          setUploadingAvatar(false);
          setAvatarPreview(null);
          setUploadProgress(0);
        }, 500);
      } else {
        setError(response.data.message || 'Failed to update profile picture');
      }
    } catch (err) {
      setError('Error uploading profile picture: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  // Cancel avatar upload
  const handleCancelAvatarUpload = () => {
    setUploadingAvatar(false);
    setAvatarPreview(null);
    setUploadProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Success message helper
  const showSuccess = (message) => {
    setSuccessMessage(message);
    setError(null);
    // Clear message after 3 seconds
    setTimeout(() => {
      setSuccessMessage('');
    }, 3000);
  };

  if (loading && !profile) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading your profile...</p>
      </div>
    );
  }

  if (error && !profile) {
    return <div className="error-message">{error}</div>;
  }

  return (
    <div className="profile-page-container">
      <div className="profile-content">
        <h1 className="profile-title">User Profile</h1>
        
        {/* Notifications */}
        {error && (
          <div className="error-notification">
            <XMarkIcon className="notification-icon" />
            {error}
            <button onClick={() => setError(null)} className="close-btn">
              <XMarkIcon className="w-4 h-4" />
            </button>
          </div>
        )}
        
        {successMessage && (
          <div className="success-notification">
            <CheckIcon className="notification-icon" />
            {successMessage}
            <button onClick={() => setSuccessMessage('')} className="close-btn">
              <XMarkIcon className="w-4 h-4" />
            </button>
          </div>
        )}

        {profile && (
          <div className="profile-sections">
            {/* Avatar Section */}
            <div className="profile-section avatar-section">
              <div className="section-header">
                <h2>Profile Photo</h2>
                {!uploadingAvatar && (
                  <button 
                    className="secondary-btn"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <CameraIcon className="btn-icon" />
                    Change Photo
                  </button>
                )}
              </div>
              
              <div className="avatar-container">
                {uploadingAvatar ? (
                  <div className="avatar-upload-preview">
                    <img 
                      src={avatarPreview} 
                      alt="Profile Preview" 
                      className="avatar-image preview"
                    />
                    
                    {uploadProgress > 0 && (
                      <div className="upload-progress-container">
                        <div 
                          className="upload-progress-bar"
                          style={{ width: `${uploadProgress}%` }}
                        ></div>
                      </div>
                    )}
                    
                    <div className="avatar-upload-actions">
                      <button 
                        className="primary-btn" 
                        onClick={handleAvatarUpload}
                        disabled={loading}
                      >
                        {loading ? 'Uploading...' : 'Save Photo'}
                      </button>
                      <button 
                        className="secondary-btn"
                        onClick={handleCancelAvatarUpload}
                        disabled={loading}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  profile.profile_picture ? (
                    <img 
                      src={profile.profile_picture} 
                      alt={profile.username} 
                      className="avatar-image"
                    />
                  ) : (
                    <div className="avatar-placeholder">
                      <UserCircleIcon className="avatar-icon" />
                      <span>{profile.username?.charAt(0).toUpperCase() || 'U'}</span>
                    </div>
                  )
                )}
                
                <input 
                  type="file"
                  ref={fileInputRef}
                  className="hidden-input"
                  accept="image/*"
                  onChange={handleAvatarChange}
                />
              </div>
            </div>
            
            {/* Account Info Section */}
            <div className="profile-section">
              <div className="section-header">
                <h2>Account Information</h2>
              </div>
              
              <div className="account-info">
                <div className="info-item">
                  <UserIcon className="info-icon" />
                  <div className="info-content">
                    <label>Username</label>
                    <div className="value">{profile.username}</div>
                  </div>
                </div>
                
                <div className="info-item">
                  <EnvelopeIcon className="info-icon" />
                  <div className="info-content">
                    <label>Email</label>
                    <div className="value">{profile.email}</div>
                  </div>
                </div>
                
                <div className="info-item">
                  <UserCircleIcon className="info-icon" />
                  <div className="info-content">
                    <label>Role</label>
                    <div className="value role-badge">
                      {profile.role === 'therapist' ? 'Therapist' : 'Client'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Personal Information Section */}
            <div className="profile-section">
              <div className="section-header">
                <h2>Personal Information</h2>
                {!editPersonalInfo ? (
                  <button 
                    className="secondary-btn"
                    onClick={() => setEditPersonalInfo(true)}
                  >
                    <PencilIcon className="btn-icon" />
                    Edit
                  </button>
                ) : null}
              </div>
              
              {editPersonalInfo ? (
                <form onSubmit={handleProfileUpdate} className="edit-form">
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="first_name">First Name</label>
                      <input
                        type="text"
                        id="first_name"
                        name="first_name"
                        value={formValues.first_name}
                        onChange={handleInputChange}
                        className="form-input"
                      />
                    </div>
                    
                    <div className="form-group">
                      <label htmlFor="last_name">Last Name</label>
                      <input
                        type="text"
                        id="last_name"
                        name="last_name"
                        value={formValues.last_name}
                        onChange={handleInputChange}
                        className="form-input"
                      />
                    </div>
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="phone">Phone Number</label>
                    <input
                      type="tel"
                      id="phone"
                      name="phone"
                      value={formValues.phone}
                      onChange={handleInputChange}
                      className="form-input"
                    />
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="bio">Bio</label>
                    <textarea
                      id="bio"
                      name="bio"
                      value={formValues.bio || ''}
                      onChange={handleInputChange}
                      className="form-textarea"
                      rows="3"
                    ></textarea>
                  </div>
                  
                  <div className="form-actions">
                    <button 
                      type="submit" 
                      className="primary-btn"
                      disabled={loading}
                    >
                      {loading ? 'Saving...' : 'Save Changes'}
                    </button>
                    <button 
                      type="button" 
                      className="secondary-btn"
                      onClick={() => setEditPersonalInfo(false)}
                      disabled={loading}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <div className="info-grid">
                  <div className="info-item">
                    <label>First Name</label>
                    <div className="value">
                      {profile.first_name || formValues.first_name || 'Not provided'}
                    </div>
                  </div>
                  
                  <div className="info-item">
                    <label>Last Name</label>
                    <div className="value">
                      {profile.last_name || formValues.last_name || 'Not provided'}
                    </div>
                  </div>
                  
                  <div className="info-item">
                    <label>Phone</label>
                    <div className="value">
                      {profile.phone || formValues.phone || 'Not provided'}
                    </div>
                  </div>
                  
                  {(profile.bio || formValues.bio) && (
                    <div className="info-item full-width">
                      <label>Bio</label>
                      <div className="value bio">
                        {profile.bio || formValues.bio}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            {/* Password Section */}
            <div className="profile-section">
              <div className="section-header">
                <h2>Password</h2>
                {!changingPassword ? (
                  <button 
                    className="secondary-btn"
                    onClick={() => setChangingPassword(true)}
                  >
                    <KeyIcon className="btn-icon" />
                    Change Password
                  </button>
                ) : null}
              </div>
              
              {changingPassword ? (
                <form onSubmit={handlePasswordUpdate} className="edit-form">
                  <div className="form-group">
                    <label htmlFor="current_password">Current Password</label>
                    <input
                      type="password"
                      id="current_password"
                      name="current_password"
                      value={passwordValues.current_password}
                      onChange={handlePasswordChange}
                      className="form-input"
                      required
                    />
                  </div>
                  
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="new_password">New Password</label>
                      <input
                        type="password"
                        id="new_password"
                        name="new_password"
                        value={passwordValues.new_password}
                        onChange={handlePasswordChange}
                        className="form-input"
                        required
                        minLength="8"
                      />
                    </div>
                    
                    <div className="form-group">
                      <label htmlFor="confirm_password">Confirm New Password</label>
                      <input
                        type="password"
                        id="confirm_password"
                        name="confirm_password"
                        value={passwordValues.confirm_password}
                        onChange={handlePasswordChange}
                        className="form-input"
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="form-actions">
                    <button 
                      type="submit" 
                      className="primary-btn"
                      disabled={loading}
                    >
                      {loading ? 'Updating...' : 'Update Password'}
                    </button>
                    <button 
                      type="button" 
                      className="secondary-btn"
                      onClick={() => setChangingPassword(false)}
                      disabled={loading}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <div className="password-info">
                  <p>Your password is securely stored. Use the button above to change it.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserProfile;