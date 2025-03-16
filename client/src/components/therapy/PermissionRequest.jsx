import React from 'react';

const PermissionRequest = ({ open, onRequestPermissions, onCancel }) => {
  if (!open) return null;
  
  return (
    <div className="video-session-page">
      <div className="modal-overlay">
        <div className="modal-content permission-dialog">
          <h3>Camera and Microphone Access</h3>
          
          <div className="permission-content">
            <div className="permission-icons">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="36" height="36">
                <path d="M12 15c-2.8 0-5-2.2-5-5s2.2-5 5-5 5 2.2 5 5-2.2 5-5 5zm0-8c-1.7 0-3 1.3-3 3s1.3 3 3 3 3-1.3 3-3-1.3-3-3-3z"/>
                <path d="M19 10c0-.3 0-.7-.1-1l-2 2c.1-.3.1-.7.1-1h2z"/>
                <path d="M12 19c-5 0-9.3-3.1-11-7.4l1.9-.5C4.2 14.5 7.8 17 12 17s7.8-2.5 9.1-5.9l1.9.5C21.3 15.9 17 19 12 19z"/>
              </svg>
              
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="36" height="36">
                <path d="M12 14c1.7 0 3-1.3 3-3V5c0-1.7-1.3-3-3-3S9 3.3 9 5v6c0 1.7 1.3 3 3 3z"/>
                <path d="M17 11c0 2.8-2.2 5-5 5s-5-2.2-5-5H5c0 3.5 2.5 6.4 6 6.9V21h2v-3.1c3.5-.5 6-3.4 6-6.9h-2z"/>
              </svg>
            </div>
            
            <p className="permission-message">
              To participate in this video session, your browser needs permission to access your camera and microphone.
            </p>
            
            <p className="permission-instructions">
              When prompted by your browser, please select "Allow" to enable video and audio.
            </p>
          </div>
          
          <div className="modal-actions">
            <button onClick={onCancel} className="btn-cancel">
              Cancel
            </button>
            <button onClick={onRequestPermissions} className="btn-primary">
              Enable Camera & Mic
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PermissionRequest;