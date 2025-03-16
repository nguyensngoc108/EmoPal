import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import UserServices from '../services/UserServices';

const UserProfile = () => {
  const { currentUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        // Remove the parameter - the token identifies the user
        const response = await UserServices.getUserProfile();
        console.log('User profile data:', response.data);
        setProfile(response.data.user); // Match structure from server response
      } catch (err) {
        setError('Failed to load user profile');
        console.error('Error fetching profile:', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchUserProfile();
  }, [currentUser?.user?.id]);

  if (loading) {
    return <div className="loading-indicator">Loading profile...</div>;
  }

  if (error) {
    return <div className="error-message">{error}</div>;
  }

  return (
    <div className="profile-container">
      <h1>User Profile</h1>
      {profile ? (
        <div className="profile-content">
          <div className="profile-header">
            <div className="profile-avatar">
              {profile.profile_picture ? (
                <img src={profile.profile_picture} alt={profile.username} />
              ) : (
                <div className="avatar-placeholder">
                  {profile.username ? profile.username.charAt(0).toUpperCase() : 'U'}
                </div>
              )}
            </div>
            <div className="profile-info">
              <h2>{profile.username}</h2>
              <p className="user-role">{profile.role === 'therapist' ? 'Therapist' : 'Client'}</p>
              <p className="user-email">{profile.email}</p>
            </div>
          </div>

          <div className="profile-details">
            <div className="profile-section">
              <h3>Personal Information</h3>
              <div className="form-group">
                <label>First Name</label>
                <div className="field-value">{profile.first_name || 'Not provided'}</div>
              </div>
              <div className="form-group">
                <label>Last Name</label>
                <div className="field-value">{profile.last_name || 'Not provided'}</div>
              </div>
              <div className="form-group">
                <label>Phone</label>
                <div className="field-value">{profile.phone || 'Not provided'}</div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="empty-state">No profile information available</div>
      )}
    </div>
  );
};

export default UserProfile;