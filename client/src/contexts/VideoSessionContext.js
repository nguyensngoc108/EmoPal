import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import WebSocketManager from '../services/WebSocketManager';

// Add this at the very beginning, outside the component

// Global connection tracking
let globalConnectionState = {
  isConnecting: false,
  lastAttemptTime: 0,
  currentSessionId: null
};

const VideoSessionContext = createContext(null);

export const VideoSessionProvider = ({ children }) => {
  // Session state
  const [sessionState, setSessionState] = useState({
    isConnected: false,
    isJoined: false,
    sessionId: null,
    otherParticipant: null,
    role: null,  // 'client' or 'therapist'
    loading: false,
    error: null
  });
  
  // Emotion analysis state with additional fields
  const [emotionData, setEmotionData] = useState({
    currentEmotions: {},
    dominantEmotion: null,
    valence: 0,
    engagement: 0,
    emotionHistory: [],
    emotionTrends: null,
    warnings: [],
    insights: {
      current_state: '',
      suggestions: [],
      observation: ''
    },
    isAnalyzing: false
  });
  
  // Media state
  const [mediaState, setMediaState] = useState({
    isMuted: false,
    isVideoOff: false,
    isScreenSharing: false
  });
  
  // WebSocket manager
  const wsManager = useRef(new WebSocketManager());
  
  // Agora client reference
  const agoraClientRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const frameCapture = useRef(null);
  
  // Move the updateEmotionData function here since it's used in handleWebSocketMessage
  const updateEmotionData = useCallback((data) => {
    setEmotionData(prev => ({
      ...prev,
      currentEmotions: data.emotions || {},
      dominantEmotion: data.dominant_emotion || null,
      valence: data.valence || 0,
      engagement: data.engagement || 0,
      emotionHistory: [
        ...prev.emotionHistory, 
        {
          timestamp: new Date(),
          emotions: data.emotions,
          dominantEmotion: data.dominant_emotion,
          valence: data.valence,
          engagement: data.engagement
        }
      ].slice(-50) // Keep last 50 entries
    }));
  }, []);
  
  // Define initializeAgoraClient BEFORE it's used in handleWebSocketMessage
  const initializeAgoraClient = useCallback(async (appId, channel, token, uid) => {
    try {
      console.log("Initializing Agora with:", { 
        appId, 
        channel, 
        hasToken: !!token,
        serverProvidedUid: uid // Log the server-provided UID
      });
      
      // Import the Agora SDK
      const AgoraRTC = await import('agora-rtc-sdk-ng');
      
      // Add error handling for analytics/stats blocking
      // This silences the errors from blocked analytics requests
      const originalConsoleError = console.error;
      console.error = function(...args) {
        // Filter out Agora stats collection errors
        if (typeof args[0] === 'string' && 
           (args[0].includes('statscollector') || 
            args[0].includes('POST https://') || 
            args[0].includes('ERR_BLOCKED_BY_CLIENT'))) {
          return; // Suppress these errors
        }
        
        // Pass through all other errors
        originalConsoleError.apply(console, args);
      };
      
      // Disable Agora logging to reduce console noise
      AgoraRTC.default.setLogLevel(3); // Only show warnings and errors
      
      // Create client instance with options to minimize analytics
      // const client = AgoraRTC.default.createClient({
      //   mode: "rtc",
      //   codec: "vp8",
      // });
      
      // Rest of your initialization code...
      
      // Restore console.error 
      setTimeout(() => {
        console.error = originalConsoleError;
      }, 1000);
      
      // First check for permissions explicitly before creating tracks
      try {
        // Request permissions before attempting to access devices
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        stream.getTracks().forEach(track => track.stop()); // Stop the test stream
        
        console.log("Camera and microphone permissions granted");
      } catch (permissionError) {
        console.error("Media device permissions denied:", permissionError);
        
        // Set a specific error state for permission issues
        setSessionState(prev => ({
          ...prev, 
          error: 'Please allow access to your camera and microphone to join the video call.',
          isJoined: false
        }));
        
        // Show user instructions
        alert("To participate in the video session, please allow access to your camera and microphone when prompted by your browser.");
        return;
      }
      
      // Create client instance
      const client = AgoraRTC.default.createClient({
        mode: "rtc",
        codec: "vp8"
      });
      
      agoraClientRef.current = client;
      
      // CRITICAL FIX: Use the server-provided UID instead of generating a new one
      // This ensures the UID matches what the token was generated for
      console.log(`Using server-provided UID: ${uid}`);
      
      // Join the channel with the exact server-provided UID
      console.log(`Using exactly the server-provided UID: ${uid}`);

      // Join with EXACTLY the UID that the token was generated for
      try {
        // First cleanup any existing client connections
        if (agoraClientRef.current) {
          try {
            // Already connected, so leave first
            console.log("Cleaning up existing client before reconnecting");
            await agoraClientRef.current.leave();
          } catch (err) {
            console.warn("Error during cleanup:", err);
            // Continue anyway
          }
        }
        
        const joinedUid = await client.join(appId, channel, token, uid);
        console.log("Joined Agora channel with UID:", joinedUid);
        // Optimize audio settings for clearer voice
        optimizeAudioSettings();
        
        // CRITICAL FIX: Store the UID immediately in localStreamRef
        localStreamRef.current = {
          ...localStreamRef.current || {},  // Make sure we don't overwrite existing props if any
          uid: joinedUid  // This is the key fix - ensure UID is stored
        };
      } catch (joinError) {
        console.error("Join error:", joinError);
        
        // For UID conflict, try one more time with a modified UID
        if (joinError.message && joinError.message.includes("UID_CONFLICT")) {
          // Try again after a short delay
          await new Promise(resolve => setTimeout(resolve, 1000));
          console.warn("UID conflict detected - trying with modified UID");
          
          try {
            // Use the UID + a large number to avoid conflicts while keeping token valid
            // This works because Agora allows some flexibility with UIDs
            const modifiedUid = uid + 10000000;
            const joinedUid = await client.join(appId, channel, token, modifiedUid);
            console.log("Joined with modified UID:", joinedUid);
            
            localStreamRef.current = {
              ...localStreamRef.current,
              uid: joinedUid
            };
          } catch (finalError) {
            // If that also fails, we need to disconnect and try later
            console.error("All join attempts failed:", finalError);
            throw finalError;
          }
        } else {
          throw joinError;
        }
      }

      try {
        // Create local tracks
        const [microphoneTrack, cameraTrack] = await AgoraRTC.default.createMicrophoneAndCameraTracks({
          microphoneConfig: {
            AEC: true, // Echo cancellation
            AGC: true  // Auto gain control
          },
          cameraConfig: {
            facingMode: "user", // Front camera
            optimizationMode: "detail" // Prioritize quality
          }
        });
        
        // FIXED: Update tracks while preserving the UID
        localStreamRef.current = {
          ...localStreamRef.current,  // Keep the UID that was set earlier
          audioTrack: microphoneTrack,
          videoTrack: cameraTrack,
        };
        
        // Publish local tracks to the channel
        await client.publish([microphoneTrack, cameraTrack]);
        console.log("Published local tracks to Agora channel", {
          audioTrackId: microphoneTrack.getTrackId(),
          videoTrackId: cameraTrack.getTrackId(),
          localUid: localStreamRef.current?.uid,
          hasAudioTrack: !!localStreamRef.current?.audioTrack,
          hasVideoTrack: !!localStreamRef.current?.videoTrack
        });
      } catch (mediaError) {
        console.error("Error creating media tracks:", mediaError);
        
        // Try to join with audio only if video fails
        if (mediaError.message.includes("video")) {
          try {
            alert("Unable to access your camera. Joining with audio only.");
            const [microphoneTrack] = await AgoraRTC.default.createMicrophoneAndCameraTracks();
            localStreamRef.current = {
              audioTrack: microphoneTrack,
              videoTrack: null
            };
            await client.publish([microphoneTrack]);
            setMediaState(prev => ({ ...prev, isVideoOff: true }));
          } catch (audioError) {
            throw new Error("Unable to access microphone or camera. Please check your devices and permissions.");
          }
        } else {
          throw mediaError;
        }
      }
      
      // Set up event listener for remote users
      client.on("user-published", async (user, mediaType) => {
        console.log("Remote user published:", user.uid, mediaType);
        
        try {
          // IMPORTANT: Track our own UID to filter out our streams
          const localUid = localStreamRef.current?.uid;
          
          // Better logging to diagnose UID issues
          console.log(`Comparing UIDs: local=${localUid}, remote=${user.uid}, match=${localUid === user.uid}`);
          
          // Skip subscribing to our own streams (prevents feedback loop)
          if (localUid === user.uid) {
            console.log(`Skipping subscription to own stream (UID: ${user.uid})`);
            return;
          }
          
          // Subscribe to remote user with retry logic
          let subscribed = false;
          let attempts = 0;
          
          while (!subscribed && attempts < 3) {
            try {
              await client.subscribe(user, mediaType);
              subscribed = true;
              console.log(`Subscribed to remote ${mediaType} after ${attempts + 1} attempts`);
            } catch (subscribeError) {
              attempts++;
              console.warn(`Subscribe attempt ${attempts} failed:`, subscribeError);
              // Wait a bit before retrying
              await new Promise(r => setTimeout(r, 500));
            }
          }
          
          if (!subscribed) {
            console.error(`Failed to subscribe to ${mediaType} after multiple attempts`);
            return;
          }
          
          if (mediaType === "video") {
            // Ensure the track is valid
            if (!user.videoTrack) {
              console.warn("Received video publish event but track is null");
              return;
            }
            
            // Update remote stream reference
            remoteStreamRef.current = {
              ...remoteStreamRef.current,
              uid: user.uid,
              videoTrack: user.videoTrack
            };
            
            // Log track details
            console.log("Remote track info:", {
              trackId: user.videoTrack.getTrackId(),
              enabled: user.videoTrack.isEnabled,
              muted: user.videoTrack.isMuted
            });
            
            // Notify UI components about remote video - with slight delay for stability
            setTimeout(() => {
              window.dispatchEvent(new CustomEvent('remote-video-ready', { 
                detail: { 
                  uid: user.uid, 
                  track: user.videoTrack,
                  trackId: user.videoTrack.getTrackId()
                } 
              }));
            }, 200);
          }
          
          // CRITICAL FIX: Add proper audio handling
          if (mediaType === "audio") {
            // Check if the audio track exists
            if (!user.audioTrack) {
              console.warn("Received audio publish event but track is null");
              return;
            }
            
            // Store the remote audio track
            remoteStreamRef.current = {
              ...remoteStreamRef.current || {},
              uid: user.uid,
              audioTrack: user.audioTrack
            };
            
            // Log the audio track
            console.log("Remote audio track received:", user.audioTrack.getTrackId());
            
            // CRITICAL: Actually play the audio track
            user.audioTrack.play();
            console.log("Remote audio is now playing");
          }
          
        } catch (error) {
          console.error("Error handling remote user:", error);
        }
      });
      
      // Handle remote user left event
      client.on("user-left", (user) => {
        console.log("Remote user left:", user.uid);
        if (remoteStreamRef.current && remoteStreamRef.current.uid === user.uid) {
          remoteStreamRef.current = null;
          
          // Notify UI that remote user left
          window.dispatchEvent(new CustomEvent('remote-user-left', { 
            detail: { uid: user.uid } 
          }));
        }
      });
      
      // Update session state
      setSessionState(prev => ({...prev, isJoined: true}));
      
    } catch (error) {
      console.error("Agora initialization error:", error);
      setSessionState(prev => ({
        ...prev, 
        error: error.message || 'Failed to connect to video call',
        isJoined: false
      }));
    }
  }, []);
  
  // Now define handleWebSocketMessage AFTER initializeAgoraClient
  const handleWebSocketMessage = useCallback((data) => {
    try {
      console.log("Received WebSocket message:", data.type);
      
      switch(data.type) {
        case 'agora_token':
          // CRITICAL FIX: Prevent duplicate initialization attempts
          if (agoraClientRef.current && localStreamRef.current && localStreamRef.current.uid) {
            console.log("Already connected to Agora, ignoring duplicate token message");
            return; // Skip duplicate initialization
          }
          
          // Throttle connection attempts
          if (window._lastAgoraInitTime && (Date.now() - window._lastAgoraInitTime < 2000)) {
            console.log("Throttling rapid Agora initialization attempts");
            return;
          }
          
          window._lastAgoraInitTime = Date.now();
          
          // Proceed with initialization
          initializeAgoraClient(data.appId, data.channel, data.token, data.uid);
          break;
        
        case 'chat_message':
          // Add message to local state for display
          if (data.message) {
            const newMessage = {
              id: data.message_id,
              sender_id: data.sender_id,
              content: data.message,
              sent_at: data.timestamp,
              message_type: data.message_type || 'text',
              metadata: data.metadata || {}
            };
            
            // More reliable event dispatching with logging
            console.log("Dispatching chat message event:", newMessage);
            
            // Dispatch both a session-specific and general event
            const sessionSpecificEvent = `video-chat-message-${sessionState.sessionId}`;
            
            // Session-specific event
            window.dispatchEvent(new CustomEvent(sessionSpecificEvent, {
              detail: newMessage
            }));
            
            // Also dispatch the general event for compatibility
            window.dispatchEvent(new CustomEvent('video-chat-message', {
              detail: newMessage
            }));
          }
          break;
          
        case 'connection_established':
          console.log("WebSocket connection confirmed:", data.message);
          break;
          
        case 'user_joined':
          console.log(`User ${data.user_id} joined as ${data.user_role}`);
          // Dispatch user joined event for UI updates
          window.dispatchEvent(new CustomEvent('video-user-joined', {
            detail: data
          }));
          
          // CRITICAL FIX: Re-publish our local tracks when a new user joins to ensure they discover us
          if (agoraClientRef.current && localStreamRef.current) {
            // Small delay to ensure the new user has fully joined before we republish
            setTimeout(async () => {
              try {
                if (localStreamRef.current.audioTrack && localStreamRef.current.videoTrack) {
                  console.log("Re-publishing tracks to make them discoverable to new user");
                  // Try unpublish/republish cycle to force discovery
                  await agoraClientRef.current.unpublish([
                    localStreamRef.current.audioTrack,
                    localStreamRef.current.videoTrack
                  ]);
                  
                  // Short delay between unpublish and republish
                  await new Promise(resolve => setTimeout(resolve, 500));
                  
                  // Republish both tracks
                  await agoraClientRef.current.publish([
                    localStreamRef.current.audioTrack,
                    localStreamRef.current.videoTrack
                  ]);
                  console.log("Tracks re-published successfully");
                }
              } catch (err) {
                console.error("Error re-publishing tracks:", err);
              }
            }, 2000);
          }
          break;
          
        case 'user_left':
          console.log(`User ${data.user_id} left`);
          // Dispatch user left event for UI updates
          window.dispatchEvent(new CustomEvent('video-user-left', {
            detail: data
          }));
          break;
          
        case 'emotion_update':
          if (sessionState.role === 'therapist') {
            updateEmotionData(data.data);
          }
          break;
        
        // Handle other message types...
        
        case 'ping':
        case 'pong':
          // Ignore ping/pong messages
          break;
          
        default:
          console.log("Unhandled WebSocket message type:", data.type);
      }
    } catch (error) {
      console.error("Error processing WebSocket message:", error);
    }
  }, [sessionState.role, initializeAgoraClient, updateEmotionData]);
  
  // Add this function before connectToSession

  const checkMediaPermissions = useCallback(async () => {
    try {
      // Request permissions explicitly
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      
      // Stop all tracks from this test stream
      stream.getTracks().forEach(track => track.stop());
      
      return true;
    } catch (error) {
      console.error("Permission check failed:", error);
      return false;
    }
  }, []);

  // Update connectToSession to check permissions first
  const connectToSession = useCallback(async (sessionId, userId, role) => {
    try {
      // Prevent rapid reconnection attempts
      const now = Date.now();
      if (globalConnectionState.isConnecting && 
          now - globalConnectionState.lastAttemptTime < 3000) {
        console.warn("Throttling connection attempts");
        return false;
      }
      
      // Set connection state
      globalConnectionState = {
        isConnecting: true,
        lastAttemptTime: now,
        currentSessionId: sessionId
      };
      
      // Check if this tab already has an active connection
      const tabId = localStorage.getItem('videoSessionTabId');
      const currentTabId = `${userId}_${Date.now()}`;
      
      if (tabId && tabId.split('_')[0] === userId) {
        console.warn("Detected possible duplicate connection for this user");
        
        // Force disconnect previous session if it's the same user
        disconnectFromSession();
        
        // Short delay to ensure cleanup
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // Set this tab as the active session
      localStorage.setItem('videoSessionTabId', currentTabId);
      
      setSessionState(prev => ({...prev, loading: true, error: null}));
      
      // Check permissions first
      const hasPermissions = await checkMediaPermissions();
      
      if (!hasPermissions) {
        setSessionState(prev => ({
          ...prev,
          loading: false,
          error: 'Please allow camera and microphone access to join the video session'
        }));
        return false;
      }
      
      // Initialize WebSocket
      wsManager.current.onConnect(() => {
        setSessionState(prev => ({...prev, isConnected: true}));
      });
      
      wsManager.current.onMessage(handleWebSocketMessage);
      
      wsManager.current.onDisconnect(() => {
        setSessionState(prev => ({...prev, isConnected: false}));
      });
      
      wsManager.current.onError((error) => {
        setSessionState(prev => ({...prev, error: 'WebSocket connection error'}));
      });
      
      // Connect to WebSocket
      const connected = wsManager.current.connect(sessionId, userId, role);
      
      if (!connected) {
        throw new Error("Failed to establish WebSocket connection");
      }
      
      // Check for existing Agora connection and force cleanup
      if (agoraClientRef.current) {
        console.log("Cleaning up existing Agora connection before reconnecting");
        
        try {
          // Close local tracks
          if (localStreamRef.current) {
            if (localStreamRef.current.audioTrack) {
              localStreamRef.current.audioTrack.close();
            }
            if (localStreamRef.current.videoTrack) {
              localStreamRef.current.videoTrack.close();
            }
          }
          
          // Leave the channel
          await agoraClientRef.current.leave();
          agoraClientRef.current = null;
          localStreamRef.current = null;
          remoteStreamRef.current = null;
        } catch (err) {
          console.warn("Error during Agora cleanup before reconnect:", err);
          // Continue anyway, since we're forcing a reconnection
        }
      }
      
      // Update session state
      setSessionState(prev => ({
        ...prev,
        sessionId,
        role,
        loading: false
      }));
      
      // At the end, update global state
      globalConnectionState.isConnecting = false;
      return true;
    } catch (error) {
      globalConnectionState.isConnecting = false;
      setSessionState(prev => ({
        ...prev,
        loading: false,
        error: error.message || 'Failed to connect to session'
      }));
      return false;
    }
  }, [handleWebSocketMessage, checkMediaPermissions]);
  
  // Media control functions
  const toggleAudio = useCallback(() => {
    if (!localStreamRef.current || !localStreamRef.current.audioTrack) return;
    
    const audioTrack = localStreamRef.current.audioTrack;
    if (mediaState.isMuted) {
      audioTrack.setEnabled(true);
      console.log("Microphone unmuted");
    } else {
      audioTrack.setEnabled(false);
      console.log("Microphone muted");
    }
    
    setMediaState(prev => ({ ...prev, isMuted: !prev.isMuted }));
  }, [mediaState.isMuted]);
  
  const toggleVideo = useCallback(() => {
    if (!localStreamRef.current || !localStreamRef.current.videoTrack) return;
    
    const videoTrack = localStreamRef.current.videoTrack;
    if (mediaState.isVideoOff) {
      videoTrack.setEnabled(true);
      console.log("Camera enabled");
    } else {
      videoTrack.setEnabled(false);
      console.log("Camera disabled");
    }
    
    setMediaState(prev => ({ ...prev, isVideoOff: !prev.isVideoOff }));
  }, [mediaState.isVideoOff]);
  
  const toggleScreenSharing = useCallback(() => {
    setMediaState(prev => ({ ...prev, isScreenSharing: !prev.isScreenSharing }));
    
    // In a real implementation, you would:
    // if (mediaState.isScreenSharing) {
    //   stopScreenShare();
    // } else {
    //   startScreenShare();
    // }
  }, [mediaState.isScreenSharing]);
  
  const updateEmotionTrends = useCallback((trendAnalysis) => {
    setEmotionData(prev => ({
      ...prev,
      emotionTrends: trendAnalysis
    }));
  }, []);
  
  const addEmotionWarning = useCallback((warning) => {
    setEmotionData(prev => ({
      ...prev,
      warnings: [...prev.warnings, {
        id: Date.now(),
        message: warning,
        timestamp: new Date()
      }]
    }));
  }, []);
  
  const updateTherapeuticInsights = useCallback((insights) => {
    setEmotionData(prev => ({
      ...prev,
      insights: insights
    }));
  }, []);
  
  // Start emotion analysis with frame capture
  const startEmotionAnalysis = useCallback(() => {
    if (sessionState.role !== 'therapist') return;
    
    setEmotionData(prev => ({
      ...prev,
      isAnalyzing: true
    }));
    
    // In a real implementation, you would:
    // 1. Start capturing video frames
    // 2. Send them to the server for analysis
    // 3. Process the analysis results
    
    console.log('Starting emotion analysis');
    
    // Simulate sending frames periodically
    frameCapture.current = setInterval(() => {
      // Capture frame and send to server for analysis
      // For now, just log it
      console.log("Frame captured for analysis");
      
      // In a real implementation:
      // captureVideoFrame()
      //   .then(frame => sendFrameForAnalysis(frame))
      //   .catch(error => console.error("Frame capture error:", error));
    }, 1000);
  }, [sessionState.role]);
  
  // Stop emotion analysis
  const stopEmotionAnalysis = useCallback(() => {
    if (frameCapture.current) {
      clearInterval(frameCapture.current);
      frameCapture.current = null;
    }
    
    setEmotionData(prev => ({
      ...prev,
      isAnalyzing: false
    }));
    
    console.log('Stopping emotion analysis');
  }, []);
  
  // Update the disconnectFromSession function with proper cleanup

  const disconnectFromSession = useCallback(() => {
    // Stop emotion analysis if it's running
    if (frameCapture.current) {
      clearInterval(frameCapture.current);
      frameCapture.current = null;
    }
    
    // Clean up Agora connection properly
    if (agoraClientRef.current) {
      try {
        // Close local tracks
        if (localStreamRef.current) {
          if (localStreamRef.current.audioTrack) {
            localStreamRef.current.audioTrack.close();
          }
          if (localStreamRef.current.videoTrack) {
            localStreamRef.current.videoTrack.close();
          }
        }
        
        // Leave the channel
        agoraClientRef.current.leave().catch(error => {
          console.warn("Error leaving Agora channel:", error);
        });
        agoraClientRef.current = null;
      } catch (err) {
        console.error("Error during Agora cleanup:", err);
      }
    }
    
    // Close WebSocket
    wsManager.current.disconnect();
    
    // Reset state
    setSessionState({
      isConnected: false,
      isJoined: false,
      sessionId: null,
      otherParticipant: null,
      role: null,
      loading: false,
      error: null
    });
    
    setEmotionData({
      currentEmotions: {},
      dominantEmotion: null,
      valence: 0,
      engagement: 0,
      emotionHistory: [],
      emotionTrends: null,
      warnings: [],
      insights: {
        current_state: '',
        suggestions: [],
        observation: ''
      },
      isAnalyzing: false
    });
    
    setMediaState({
      isMuted: false,
      isVideoOff: false,
      isScreenSharing: false
    });
    
    console.log('Disconnected from session');
  }, []);
  
  // Send chat message
  const sendChatMessage = useCallback((message) => {
    wsManager.current.sendChatMessage(message);
  }, []);
  
  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (frameCapture.current) {
        clearInterval(frameCapture.current);
      }
      wsManager.current.disconnect();
    };
  }, []);
  
  // Add this function to your context and call it if the streams aren't working

  const forceReconnectVideo = useCallback(async () => {
    try {
      console.log("Forcing video and audio reconnection...");
      
      // Check if there's an existing Agora client
      if (!agoraClientRef.current) {
        console.error("No Agora client to reconnect");
        return;
      }
      
      // Also reconnect any remote audio
      if (remoteStreamRef.current?.audioTrack) {
        try {
          // Stop and replay remote audio
          remoteStreamRef.current.audioTrack.stop();
          remoteStreamRef.current.audioTrack.play();
          console.log("Replayed remote audio track");
        } catch (audioErr) {
          console.warn("Could not replay remote audio:", audioErr);
        }
      }
      
      // If there are existing tracks, close them first
      if (localStreamRef.current) {
        if (localStreamRef.current.videoTrack) {
          localStreamRef.current.videoTrack.close();
        }
        if (localStreamRef.current.audioTrack) {
          localStreamRef.current.audioTrack.close();
        }
      }
      
      // Create new tracks with explicit device requirements
      const AgoraRTC = await import('agora-rtc-sdk-ng');
      
      console.log("Creating new video and audio tracks...");
      
      // Create with more options
      const [microphoneTrack, cameraTrack] = await AgoraRTC.default.createMicrophoneAndCameraTracks({
        microphoneConfig: {
          AEC: true,
          ANS: true,
          AGC: true
        },
        cameraConfig: {
          facingMode: "user",
          encoderConfig: {
            width: 640,
            height: 360,
            frameRate: 15,
            bitrateMin: 400,
            bitrateMax: 800
          }
        }
      });
      
      // Store new tracks
      localStreamRef.current = {
        audioTrack: microphoneTrack,
        videoTrack: cameraTrack,
      };
      
      // Publish new tracks to channel
      console.log("Publishing new tracks to channel...");
      await agoraClientRef.current.publish([microphoneTrack, cameraTrack]);
      
      console.log("Video force reconnected successfully");
      
      // Dispatch an event to notify UI
      window.dispatchEvent(new CustomEvent('local-video-ready', { 
        detail: { track: cameraTrack } 
      }));
      
      return true;
    } catch (error) {
      console.error("Force reconnection failed:", error);
      return false;
    }
  }, []);

  // Add this function to the VideoSessionContext provider component
  // Around line 600 after other functions

  const optimizeAudioSettings = useCallback(() => {
    if (!agoraClientRef.current || !localStreamRef.current?.audioTrack) {
      return;
    }
    
    try {
      // Set audio processing parameters for better voice quality
      localStreamRef.current.audioTrack.setAudioFrameParameters({
        sampleRate: 48000, // Higher sample rate for better audio quality
        channel: 1, // Mono is often better for voice
        samplesPerCall: 1024 // Standard frame size
      });
      
      console.log("Audio settings optimized for voice clarity");
    } catch (err) {
      console.warn("Could not optimize audio settings:", err);
    }
  }, []);
  
  const value = {
    sessionState,
    emotionData,
    mediaState,
    connectToSession,
    disconnectFromSession,
    startEmotionAnalysis,
    stopEmotionAnalysis,
    toggleAudio,
    toggleVideo,
    toggleScreenSharing,
    sendChatMessage,
    // Add the refs
    localStreamRef,
    remoteStreamRef,
    agoraClientRef,
    forceReconnectVideo
  };
  
  return (
    <VideoSessionContext.Provider value={value}>
      {children}
    </VideoSessionContext.Provider>
  );
};

export const useVideoSession = () => {
  return useContext(VideoSessionContext);
};