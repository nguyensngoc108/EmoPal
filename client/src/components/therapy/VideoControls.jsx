import React from 'react';

const VideoControls = ({ 
  isTherapist, 
  onToggleAudio, 
  onToggleVideo, 
  onToggleScreenShare, 
  onToggleRecording, 
  onToggleAnalysis,
  onLeaveSession, 
  isRecording, 
  isAnalyzing,
  isMuted,
  isVideoOff
}) => {
  return (
    <div className="video-controls">
      <button 
        className={`control-btn ${isMuted ? 'off' : ''}`} 
        onClick={onToggleAudio}
      >
        {isMuted ? 'Unmute' : 'Mute'}
      </button>
      
      <button 
        className={`control-btn ${isVideoOff ? 'off' : ''}`} 
        onClick={onToggleVideo}
      >
        {isVideoOff ? 'Start Video' : 'Stop Video'}
      </button>
      
      {/* Only show screen sharing for therapists */}
      {isTherapist && (
        <button 
          className="control-btn" 
          onClick={onToggleScreenShare}
        >
          Share Screen
        </button>
      )}
      
      {/* Recording control (therapist only) */}
      {isTherapist && (
        <button 
          className={`control-btn ${isRecording ? 'active' : ''}`} 
          onClick={onToggleRecording}
        >
          {isRecording ? 'Stop Recording' : 'Start Recording'}
        </button>
      )}
      
      {/* Emotion analysis control (therapist only) */}
      {isTherapist && (
        <button 
          className={`control-btn analysis ${isAnalyzing ? 'active' : ''}`} 
          onClick={onToggleAnalysis}
        >
          {isAnalyzing ? 'Stop Analysis' : 'Start Analysis'}
        </button>
      )}
      
      {/* Leave session button */}
      <button 
        className="control-btn leave" 
        onClick={onLeaveSession}
      >
        {isTherapist ? 'End Session' : 'Leave Session'}
      </button>
    </div>
  );
};

export default VideoControls;