import React, { useEffect, useRef, useState } from 'react';
import { useVideoSession } from '../../contexts/VideoSessionContext';
import '../../styles/EmotionAnalysis.css';

const RemoteVideoAnalyzer = () => {
  const { emotionData, sessionState } = useVideoSession();
  const overlayRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    // Find the remote video element
    const findRemoteVideo = () => {
      const remoteVideoElement = document.getElementById('remote-video') || 
                                document.querySelector('.remote-video') ||
                                document.querySelector('.agora_video_player video');
      
      if (remoteVideoElement) {
        remoteVideoRef.current = remoteVideoElement;
        
        // Observe size changes
        const resizeObserver = new ResizeObserver((entries) => {
          for (const entry of entries) {
            const { width, height } = entry.contentRect;
            setDimensions({ width, height });
          }
        });
        
        resizeObserver.observe(remoteVideoElement);
        return () => resizeObserver.disconnect();
      }
    };

    const interval = setInterval(() => {
      if (!remoteVideoRef.current) {
        findRemoteVideo();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Position the overlay on the remote video
    if (remoteVideoRef.current && overlayRef.current) {
      const videoRect = remoteVideoRef.current.getBoundingClientRect();
      overlayRef.current.style.position = 'absolute';
      overlayRef.current.style.top = `${videoRect.top}px`;
      overlayRef.current.style.left = `${videoRect.left}px`;
      overlayRef.current.style.width = `${videoRect.width}px`;
      overlayRef.current.style.height = `${videoRect.height}px`;
    }
  }, [dimensions]);

  // Render face box if face detection data is available
  const renderFaceBox = () => {
    if (!emotionData || !emotionData.faceDetection) return null;
    
    const { x, y, width, height } = emotionData.faceDetection;
    const boxStyle = {
      position: 'absolute',
      left: `${x * 100}%`,
      top: `${y * 100}%`,
      width: `${width * 100}%`,
      height: `${height * 100}%`,
      border: `3px solid ${getEmotionColor(emotionData.dominantEmotion)}`,
      borderRadius: '4px',
      boxShadow: '0 0 10px rgba(0, 0, 0, 0.5)',
      animation: 'pulse-border 2s infinite'
    };
    
    const labelStyle = {
      position: 'absolute',
      top: '-25px',
      left: '0',
      backgroundColor: getEmotionColor(emotionData.dominantEmotion),
      color: '#fff',
      padding: '2px 8px',
      borderRadius: '4px',
      fontSize: '12px',
      fontWeight: 'bold'
    };
    
    return (
      <div className="face-box" style={boxStyle}>
        <div className="emotion-label" style={labelStyle}>
          {emotionData.dominantEmotion}
        </div>
      </div>
    );
  };
  
  const getEmotionColor = (emotion) => {
    const colors = {
      happy: '#4CAF50',
      sad: '#2196F3',
      angry: '#F44336',
      fear: '#9C27B0',
      disgust: '#FF9800',
      surprise: '#00BCD4',
      neutral: '#9E9E9E'
    };
    return colors[emotion] || colors.neutral;
  };

  if (!sessionState.isJoined || !sessionState.isTherapist) return null;

  return (
    <div 
      ref={overlayRef} 
      className="emotion-analysis-overlay"
      style={{
        position: 'absolute',
        pointerEvents: 'none',
        zIndex: 10
      }}
    >
      {renderFaceBox()}
    </div>
  );
};

export default RemoteVideoAnalyzer;