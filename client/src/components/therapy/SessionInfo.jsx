import React from 'react';
import { format } from 'date-fns';

const SessionInfo = ({ sessionDetails, timeRemaining, isRecording = false }) => {
  if (!sessionDetails) {
    return <div className="session-info-loading">Loading session information...</div>;
  }

  const formattedStartTime = sessionDetails.start_time ? 
    format(new Date(sessionDetails.start_time), 'MMM d, yyyy h:mm a') : 'Loading...';

  const sessionDuration = sessionDetails.duration_hours ? 
    `${sessionDetails.duration_hours} hour${sessionDetails.duration_hours > 1 ? 's' : ''}` : '';

  return (
    <div className="session-info">
      <div className="session-info-primary">
        <div className="session-title">
          <h2>{`Session with ${sessionDetails.therapist_name || 'your therapist'}`}</h2>
          <div className="session-badges">
            <div className="session-type-badge">
              {sessionDetails.session_type === 'video' ? 'Video Session' : 'Text Session'}
            </div>
            {isRecording && (
              <div className="recording-badge">
                <span className="recording-dot"></span> Recording
              </div>
            )}
          </div>
        </div>
        <div className="session-time-remaining">
          {timeRemaining ? (
            <span className="time-badge">{timeRemaining}</span>
          ) : (
            <span className="time-badge">Session in progress</span>
          )}
        </div>
      </div>
      
      <div className="session-info-secondary">
        <div className="session-details">
          <span className="session-date">{formattedStartTime}</span>
          {sessionDuration && <span className="session-duration">({sessionDuration})</span>}
        </div>
      </div>
    </div>
  );
};

export default SessionInfo;