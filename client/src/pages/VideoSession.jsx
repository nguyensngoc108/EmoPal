import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import SessionService from '../services/SessionServices';
import { VideoSessionProvider, useVideoSession } from '../contexts/VideoSessionContext';
import EmotionDisplay from '../components/therapy/EmotionDisplay';
import VideoControls from '../components/therapy/VideoControls';
import ChatPanel from '../components/therapy/ChatPanel';
import TherapistInsightPanel from '../components/therapy/TherapistInsightPanel';
import SessionInfo from '../components/therapy/SessionInfo.jsx';
// create css file 
import '../styles/VideoSession.css'; // Import your CSS file
import '../styles/VideoSessionFixes.css'; // Add this new import
import PermissionRequest from '../components/therapy/PermissionRequest'; // Add imports

const VideoSessionContent = () => {
  const { sessionId } = useParams();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const { 
    sessionState, 
    emotionData,
    connectToSession,
    disconnectFromSession,
    startEmotionAnalysis,
    stopEmotionAnalysis,
    toggleAudio,
    toggleVideo,
    toggleScreenSharing,
    localStreamRef,      // Add this
    remoteStreamRef,     // Add this
    sendChatMessage,     // Add this
    forceReconnectVideo  // Add this
  } = useVideoSession();
  
  const [sessionDetails, setSessionDetails] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(null);
  const [showEndSessionConfirm, setShowEndSessionConfirm] = useState(false);
  const [showPermissionDialog, setShowPermissionDialog] = useState(false); // Add state for permission dialog
  const [connectionStatus, setConnectionStatus] = useState({
    localVideo: false,
    remoteVideo: false,
    connectionTrouble: false  // Add this flag
  }); // Add this state for connection tracking
  const [connectionAttempted, setConnectionAttempted] = useState(false); // Add a connectionAttempted flag to prevent duplicate connections
  const [sidePanelVisible, setSidePanelVisible] = useState(true); // Add this state for side panel visibility
  const [selfViewPosition, setSelfViewPosition] = useState({ x: 20, y: null }); // Add this new state
  
  // Video references
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  
  // ANTI-DUPLICATION: Detect if already open in another tab
  useEffect(() => {
    // Generate a unique ID for this tab instance
    const tabId = Date.now().toString();
    
    // Add a storage listener to detect other tabs
    const handleStorageChange = (e) => {
      if (e.key === 'videoSessionActive' && e.newValue !== tabId) {
        alert("This video session appears to be open in another tab. Please close duplicate tabs to avoid connection issues.");
      }
    };
    
    // Set this tab as active
    localStorage.setItem('videoSessionActive', tabId);
    
    // Listen for changes
    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      // Clean up
      window.removeEventListener('storage', handleStorageChange);
      if (localStorage.getItem('videoSessionActive') === tabId) {
        localStorage.removeItem('videoSessionActive');
      }
    };
  }, []);

  // Initialize session
  useEffect(() => {
    const initializeSession = async () => {
      if (!sessionId || !currentUser?.user?.id || connectionAttempted) return;
      
      try {
        setConnectionAttempted(true); // Prevent duplicate connection attempts
        
        // Get session details
        const response = await SessionService.getSessionById(sessionId);
        const session = response.data.session;
        setSessionDetails(session);
        
        // Determine user role based on session data
        // const isTherapist = currentUser.user.id === session.therapist_id;
        const role = currentUser?.user?.role === 'therapist' ? 'therapist' : 'client';
        
        console.log(`Initializing video session as ${role}`);
        
        // Connect to session with the determined role
        await connectToSession(sessionId, currentUser.user.id, role);
        
        // Mark the session as in_progress
        await SessionService.updateSessionStatus(sessionId, 'in_progress');
        
      } catch (error) {
        console.error('Failed to initialize video session:', error);
        navigate('/sessions');
      }
    };
    
    initializeSession();
  }, [sessionId, currentUser, connectToSession, navigate, connectionAttempted]);

  // Session timer
  useEffect(() => {
    if (!sessionDetails?.end_time) return;
    
    const endTime = new Date(sessionDetails.end_time).getTime();
    
    const timerInterval = setInterval(() => {
      const now = new Date().getTime();
      const difference = endTime - now;
      
      if (difference <= 0) {
        clearInterval(timerInterval);
        setTimeRemaining(null);
        handleSessionTimeout();
        return;
      }
      
      // Format remaining time
      const hours = Math.floor(difference / (1000 * 60 * 60));
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      setTimeRemaining(`${hours}h ${minutes}m remaining`);
    }, 30000); // Update every 30 seconds
    
    return () => clearInterval(timerInterval);
  }, [sessionDetails]);

  // Auto-start analytics for therapist
  useEffect(() => {
    if (sessionState.role === 'therapist' && sessionState.isJoined) {
      const timer = setTimeout(() => {
        startEmotionAnalysis();
      }, 3000); // Give time for video to connect first
      return () => clearTimeout(timer);
    }
  }, [sessionState.isJoined, sessionState.role, startEmotionAnalysis]);

  // Replace your current video rendering useEffect with this version

  useEffect(() => {
    if (!sessionState.isJoined) return;
    
    // Function to handle track playing with better error handling
    const playTrackInContainer = (container, track, trackType) => {
      try {
        if (!container || !track) {
          console.warn(`Missing ${!container ? 'container' : 'track'} for ${trackType} video`);
          return;
        }
        
        // Clear the container first
        while (container.firstChild) {
          container.removeChild(container.firstChild);
        }
        
        console.log(`Playing ${trackType} track:`, track.getTrackId());
        
        // Stop track if already playing
        try {
          track.stop();
        } catch (e) {
          // Ignore errors when stopping
        }
        
        // CRITICAL FIX: Use appropriate fit mode based on track type
        const playOptions = {
          fit: trackType === "local" ? "contain" : "cover", // Better fit for local video
          mirror: trackType === "local", // Only mirror local video
        };
        
        try {
          track.play(container, playOptions);
          console.log(`Successfully played ${trackType} video`);
        } catch (error) {
          console.error(`Error playing ${trackType} video:`, error);
          
          // Fallback method if needed
          try {
            const playerElement = track.play();
            if (playerElement && container) {
              container.innerHTML = '';
              container.appendChild(playerElement);
              
              // CRITICAL FIX: Ensure video element fills container properly
              const videoElement = playerElement.querySelector('video');
              if (videoElement) {
                videoElement.style.width = '100%';
                videoElement.style.height = '100%';
                videoElement.style.objectFit = trackType === "local" ? "contain" : "cover";
              }
            }
          } catch (finalError) {
            console.error(`All play attempts failed for ${trackType}:`, finalError);
          }
        }
      } catch (error) {
        console.error(`Error playing ${trackType} video:`, error);
      }
    };
    
    // Clear the containers first
    if (localVideoRef.current) localVideoRef.current.innerHTML = '';
    if (remoteVideoRef.current) remoteVideoRef.current.innerHTML = '';
    
    // Set up local video
    if (localStreamRef?.current?.videoTrack) {
      playTrackInContainer(localVideoRef.current, localStreamRef.current.videoTrack, "local");
    }
    
    // Handle remote video
    const handleRemoteVideo = (event) => {
      // Enhanced logging to debug the issue
      console.log('Remote video event details:', {
        eventUid: event.detail.uid,
        localUid: localStreamRef?.current?.uid,
        trackId: event.detail.trackId,
        isMatch: event.detail.uid === localStreamRef?.current?.uid,
        typeEventUid: typeof event.detail.uid,
        typeLocalUid: typeof localStreamRef?.current?.uid
      });

      // STRICT COMPARISON: Ensure we never display our own stream in remote container
      if (remoteVideoRef.current && 
          event.detail.track && 
          event.detail.uid !== localStreamRef?.current?.uid) {
        console.log(`Displaying remote video for user ${event.detail.uid}`);
        
        // Clear container before playing
        while (remoteVideoRef.current.firstChild) {
          remoteVideoRef.current.removeChild(remoteVideoRef.current.firstChild);
        }
        
        playTrackInContainer(remoteVideoRef.current, event.detail.track, "remote");
      } else {
        console.log(`⚠️ Skipping remote display - appears to be local user's stream:`, {
          remoteUid: event.detail.uid, 
          localUid: localStreamRef?.current?.uid
        });
      }
    };
    
    // Play existing remote video if available
    if (remoteVideoRef.current && remoteStreamRef?.current?.videoTrack) {
      playTrackInContainer(remoteVideoRef.current, remoteStreamRef.current.videoTrack, "remote");
    }
    
    // Add event listener for new remote videos
    window.addEventListener('remote-video-ready', handleRemoteVideo);
    
    return () => {
      window.removeEventListener('remote-video-ready', handleRemoteVideo);
    };
  }, [sessionState.isJoined]);

  // Add an effect to check permissions when component loads
  useEffect(() => {
    const checkInitialPermissions = async () => {
      try {
        // Check if permissions are already granted
        const result = await navigator.permissions.query({ name: 'camera' });
        const micResult = await navigator.permissions.query({ name: 'microphone' });
        
        if (result.state === 'granted' && micResult.state === 'granted') {
          console.log("Camera and microphone permissions already granted");
        } else {
          // Show the permission dialog
          setShowPermissionDialog(true);
        }
      } catch (error) {
        console.warn("Permission query not supported, will prompt during connection", error);
      }
    };
    
    checkInitialPermissions();
  }, []);

  // Add this useEffect after your other ones
  useEffect(() => {
    // Handle remote user leaving
    const handleRemoteUserLeft = (event) => {
      console.log(`Remote user left: ${event.detail.uid}`);
      
      // Clear the remote video container
      if (remoteVideoRef.current) {
        remoteVideoRef.current.innerHTML = '';
        remoteVideoRef.current.appendChild(
          document.createElement('div')
        ).textContent = 'Remote user disconnected';
      }
    };
    
    // Listen for remote user left events
    window.addEventListener('remote-user-left', handleRemoteUserLeft);
    
    return () => {
      window.removeEventListener('remote-user-left', handleRemoteUserLeft);
    };
  }, []);

  // Also add a listener for the left event from WebSocket
  useEffect(() => {
    const handleUserLeft = (event) => {
      console.log(`User left event: ${event.detail.user_id}`);
      
      // Check if this was the remote user (not ourselves)
      if (currentUser?.user?.id !== event.detail.user_id) {
        // Clear remote video
        if (remoteVideoRef.current) {
          remoteVideoRef.current.innerHTML = '';
          remoteVideoRef.current.appendChild(
            document.createElement('div')
          ).textContent = 'Remote user disconnected';
        }
      }
    };
    
    window.addEventListener('video-user-left', handleUserLeft);
    
    return () => {
      window.removeEventListener('video-user-left', handleUserLeft);
    };
  }, [currentUser]);

  const handleRequestPermissions = async () => {
    try {
      // Request permissions
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: true, 
        video: true 
      });
      
      // Permissions granted, close dialog
      setShowPermissionDialog(false);
      
      // Stop the temporary stream
      stream.getTracks().forEach(track => track.stop());
      
      // Now try connecting to the session if we have the session ID
      if (sessionId) {
        connectToSession(sessionId, currentUser.user.id, currentUser.user.role);
      }
    } catch (error) {
      console.error("Error requesting permissions:", error);
      // Keep dialog open, show error
      alert("Please enable camera and microphone access in your browser settings to join the video session.");
    }
  };

  const handleSessionTimeout = () => {
    alert("Your session time has ended. You'll be redirected to the sessions page.");
    handleLeaveSession();
  };

  const handleLeaveSession = async () => {
    try {
      await SessionService.updateSessionStatus(sessionId, 'completed');
      stopEmotionAnalysis();
      disconnectFromSession();
      navigate('/sessions');
    } catch (error) {
      console.error('Error ending session:', error);
    }
  };

  const handleRecordingToggle = async () => {
    // Only therapists can record sessions
    if (sessionState.role !== 'therapist') return;
    
    try {
      if (!isRecording) {
        await SessionService.startSessionRecording(sessionId);
        setIsRecording(true);
      } else {
        await SessionService.stopSessionRecording(sessionId);
        setIsRecording(false);
      }
    } catch (error) {
      console.error("Error toggling recording:", error);
    }
  };

  const handleForceReconnect = async () => {
    try {
      // Use the context's reconnection method
      forceReconnectVideo();
      console.log("Reconnection request sent");
      setConnectionStatus(prev => ({ ...prev, connectionTrouble: false }));
    } catch (err) {
      console.error("Force reconnection failed:", err);
    }
  };

  // Replace the useEffect for drag functionality (around line 407)
  useEffect(() => {
    const selfViewContainer = document.getElementById('local-video-container');
    if (!selfViewContainer || !sessionState.isJoined) return;
    
    let isDragging = false;
    let offsetX, offsetY;
    
    const handleMouseDown = (e) => {
      e.preventDefault(); // Prevent text selection during drag
      isDragging = true;
      
      // Get the current offset from the mouse position to the container's edge
      const rect = selfViewContainer.getBoundingClientRect();
      offsetX = e.clientX - rect.left;
      offsetY = e.clientY - rect.top;
      
      selfViewContainer.style.cursor = 'grabbing';
    };
    
    const handleMouseMove = (e) => {
      if (!isDragging) return;
      
      // Get the container boundaries
      const videoContainer = document.querySelector('.video-container');
      const containerRect = videoContainer.getBoundingClientRect();
      
      // Calculate new position relative to the container
      let newX = e.clientX - containerRect.left - offsetX;
      let newY = e.clientY - containerRect.top - offsetY;
      
      // Keep within boundaries
      const maxX = containerRect.width - selfViewContainer.offsetWidth;
      const maxY = containerRect.height - selfViewContainer.offsetHeight - 80; // Add extra space for controls
      
      newX = Math.max(0, Math.min(newX, maxX));
      newY = Math.max(0, Math.min(newY, maxY));
      
      // CRITICAL FIX: Override ALL position properties to ensure proper positioning
      selfViewContainer.style.position = 'absolute';
      selfViewContainer.style.left = `${newX}px`;
      selfViewContainer.style.top = `${newY}px`;
      selfViewContainer.style.right = 'auto';
      selfViewContainer.style.bottom = 'auto';
      selfViewContainer.style.transform = 'none'; // Prevent CSS transforms from interfering
      
      // Update state for persistence
      setSelfViewPosition({ x: newX, y: newY });
    };
    
    const handleMouseUp = () => {
      if (isDragging) {
        isDragging = false;
        selfViewContainer.style.cursor = 'grab';
      }
    };
    
    // Support for touch devices
    const handleTouchStart = (e) => {
      const touch = e.touches[0];
      const mouseEvent = new MouseEvent('mousedown', {
        clientX: touch.clientX,
        clientY: touch.clientY
      });
      handleMouseDown(mouseEvent);
    };
    
    const handleTouchMove = (e) => {
      if (!isDragging) return;
      const touch = e.touches[0];
      const mouseEvent = new MouseEvent('mousemove', {
        clientX: touch.clientX,
        clientY: touch.clientY
      });
      handleMouseMove(mouseEvent);
    };
    
    const handleTouchEnd = () => {
      handleMouseUp();
    };
    
    // Add all event listeners
    selfViewContainer.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    selfViewContainer.addEventListener('touchstart', handleTouchStart);
    document.addEventListener('touchmove', handleTouchMove);
    document.addEventListener('touchend', handleTouchEnd);
    
    return () => {
      // Remove all event listeners on cleanup
      selfViewContainer.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      selfViewContainer.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [sessionState.isJoined]);

  // Then update your CSS to use the position state
  useEffect(() => {
    const selfViewContainer = document.getElementById('local-video-container');
    if (!selfViewContainer || !selfViewPosition) return;
    
    if (selfViewPosition.x !== null) {
      selfViewContainer.style.left = `${selfViewPosition.x}px`;
    }
    
    if (selfViewPosition.y !== null) {
      selfViewContainer.style.top = `${selfViewPosition.y}px`;
      selfViewContainer.style.bottom = 'auto';
    }
  }, [selfViewPosition]);

  // Replace the useEffect for position state (around line 540)
  useEffect(() => {
    const selfViewContainer = document.getElementById('local-video-container');
    if (!selfViewContainer || !selfViewPosition) return;
    
    // CRITICAL FIX: Set initial position with higher specificity to override CSS
    if (selfViewPosition.x !== null) {
      selfViewContainer.style.setProperty('left', `${selfViewPosition.x}px`, 'important');
      selfViewContainer.style.setProperty('right', 'auto', 'important');
    } else {
      // Default position if not set
      selfViewContainer.style.setProperty('left', '20px', 'important');
    }
    
    if (selfViewPosition.y !== null) {
      selfViewContainer.style.setProperty('top', `${selfViewPosition.y}px`, 'important');
      selfViewContainer.style.setProperty('bottom', 'auto', 'important');
    } else {
      // Default position if not set
      selfViewContainer.style.setProperty('bottom', '90px', 'important');
    }
  }, [selfViewPosition]);

  // Render different UI based on role
  // Update the therapist view rendering
  if (sessionState.role === 'therapist') {
    return (
      <div className="video-session-page">
        <div className="therapist-session-layout">
          <div className="session-header">
            <SessionInfo 
              sessionDetails={sessionDetails}
              timeRemaining={timeRemaining}
              isRecording={isRecording}
            />
          </div>
          
          <div className="main-content">
            {/* Main video area with separated structure */}
            <div className="video-container">
              {/* Remote video */}
              <div className="remote-video" id="remote-video-container">
                {!sessionState.isJoined && 
                  <div className="video-placeholder">
                    <div className="placeholder-icon">
                      <i className="fas fa-user-alt"></i>
                    </div>
                    <div>Waiting for other participant to join...</div>
                  </div>
                }
                <div ref={remoteVideoRef} className="video-element" />
              </div>
              
              {/* Completely separate local video container */}
              <div className="local-video-container" id="local-video-container">
                <div ref={localVideoRef} className="local-video" />
              </div>
              
              {/* Video controls remain the same */}
              <VideoControls 
                isTherapist={sessionState.role === 'therapist'}
                onToggleAudio={toggleAudio}
                onToggleVideo={toggleVideo}
                onToggleScreenShare={toggleScreenSharing}
                onToggleRecording={handleRecordingToggle}
                onToggleAnalysis={startEmotionAnalysis}
                onLeaveSession={() => setShowEndSessionConfirm(true)}
                isRecording={isRecording}
                isAnalyzing={emotionData.isAnalyzing}
              />
              
              {/* Only show reconnect button when there are issues */}
              {(connectionStatus.connectionTrouble || sessionState.error) && (
                <button 
                  onClick={handleForceReconnect}
                  className="reconnect-btn"
                  title="Force reconnection"
                >
                  <i className="fas fa-sync"></i>
                </button>
              )}
            </div>
            
            {/* Side panel with better layout */}
            <div className={`side-panel ${sidePanelVisible ? 'visible' : 'hidden'}`}>
              <TherapistInsightPanel emotionData={emotionData} />
              <ChatPanel sessionId={sessionId} />
            </div>
          </div>
          
          {/* Modal dialogs remain the same */}
          {showEndSessionConfirm && (
            <div className="modal-overlay">
              <div className="modal-content">
                <h3>End Session</h3>
                <p>Are you sure you want to end this therapy session?</p>
                <div className="modal-actions">
                  <button onClick={() => setShowEndSessionConfirm(false)} className="btn-cancel">
                    Cancel
                  </button>
                  <button onClick={handleLeaveSession} className="btn-end-session">
                    End Session
                  </button>
                </div>
              </div>
            </div>
          )}
          <div className="connection-status">
            <div className={`status-indicator ${connectionStatus.localVideo ? 'active' : ''}`}>
              Local Video
            </div>
            <div className={`status-indicator ${connectionStatus.remoteVideo ? 'active' : ''}`}>
              Remote Video
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  // Client UI
  return (
    <div className="video-session-page">
      <div className="client-session-layout">
        <div className="session-header">
          <SessionInfo 
            sessionDetails={sessionDetails}
            timeRemaining={timeRemaining}
          />
        </div>
        
        <div className="main-content">
          {/* Main video area with separated structure */}
          <div className="video-container">
            {/* Remote video */}
            <div className="remote-video" id="remote-video-container">
              {!sessionState.isJoined && 
                <div className="video-placeholder">
                  <div className="placeholder-icon">
                    <i className="fas fa-user-alt"></i>
                  </div>
                  <div>Waiting for other participant to join...</div>
                </div>
              }
              <div ref={remoteVideoRef} className="video-element" />
            </div>
            
            {/* Completely separate local video container */}
            <div className="local-video-container" id="local-video-container">
              <div ref={localVideoRef} className="local-video" />
            </div>
            
            {/* Video controls remain the same */}
            <VideoControls 
              isTherapist={sessionState.role === 'therapist'}
              onToggleAudio={toggleAudio}
              onToggleVideo={toggleVideo}
              onToggleScreenShare={toggleScreenSharing}
              onToggleRecording={handleRecordingToggle}
              onToggleAnalysis={startEmotionAnalysis}
              onLeaveSession={() => setShowEndSessionConfirm(true)}
              isRecording={isRecording}
              isAnalyzing={emotionData.isAnalyzing}
            />
            
            {/* Only show reconnect button when there are issues */}
            {(connectionStatus.connectionTrouble || sessionState.error) && (
              <button 
                onClick={handleForceReconnect}
                className="reconnect-btn"
                title="Force reconnection"
              >
                <i className="fas fa-sync"></i>
              </button>
            )}
          </div>
          
          <div className={`side-panel ${sidePanelVisible ? 'visible' : 'hidden'}`}>
            <ChatPanel 
              sessionId={sessionId}
            />
          </div>
        </div>
        
        {/* End session confirmation dialog */}
        {showEndSessionConfirm && (
          <div className="modal-overlay">
            <div className="modal-content">
              <h3>Leave Session</h3>
              <p>Are you sure you want to leave this therapy session? The therapist will be notified.</p>
              <div className="modal-actions">
                <button onClick={() => setShowEndSessionConfirm(false)} className="btn-cancel">
                  Cancel
                </button>
                <button onClick={handleLeaveSession} className="btn-leave-session">
                  Leave Session
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Add this permission request dialog */}
        <PermissionRequest
          open={showPermissionDialog}
          onRequestPermissions={handleRequestPermissions}
          onCancel={() => setShowPermissionDialog(false)}
        />
        <div className="connection-status">
          <div className={`status-indicator ${connectionStatus.localVideo ? 'active' : ''}`}>
            Local Video
          </div>
          <div className={`status-indicator ${connectionStatus.remoteVideo ? 'active' : ''}`}>
            Remote Video
          </div>
        </div>
      </div>
    </div>
  );
};

// Wrap with the provider
const VideoSessionPage = () => (
  <VideoSessionProvider>
    <VideoSessionContent />
  </VideoSessionProvider>
);

export default VideoSessionPage;