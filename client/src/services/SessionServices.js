import api from './api';

class SessionService {
  // Get upcoming sessions
  getUpcomingSessions() {
    return api.get('/sessions/upcoming/');
  }

  // Get past sessions
  getPastSessions(params = {}) {
    return api.get('/sessions/past/', { params });
  }
  
  // Get all sessions (useful for therapists)
  getAllSessions() {
    return api.get('/sessions');
  }

  // Get session by ID
  getSessionById(sessionId) {
    return api.get(`/sessions/${sessionId}/`);
  }
  
  // Get session notes
  getSessionNotes(sessionId) {
    return api.get(`/sessions/${sessionId}/notes/`);
  }
  
  // Add a note to a session
  addSessionNote(sessionId, noteData) {
    return api.post(`/sessions/${sessionId}/notes/add/`, noteData);
  }
  
  // Update a note
  updateSessionNote(sessionId, noteId, noteData) {
    return api.put(`/sessions/${sessionId}/notes/${noteId}`, noteData);
  }
  
  // Delete a note
  deleteSessionNote(sessionId, noteId) {
    return api.delete(`/sessions/${sessionId}/notes/${noteId}`);
  }
  
  // Schedule a new session
  createSession(sessionData) {
    return api.post('/sessions', sessionData);
  }
  
  // Book a session
  bookSession(sessionData) {
    // Convert dates to ISO string format if they're not already
    if (sessionData.start_time instanceof Date) {
      sessionData.start_time = sessionData.start_time.toISOString();
    }
    if (sessionData.end_time instanceof Date) {
      sessionData.end_time = sessionData.end_time.toISOString();
    }
    
    return api.post('/sessions/book/', sessionData);
  }
  
  // Quick book a session
  quickBookSession(sessionData) {
    return api.post('/sessions/quick-book', sessionData);
  }
  
  // Update session status
   // Update session status
   updateSessionStatus(sessionId, status) {
    // Change from PATCH to PUT to match server configuration
    return api.put(`/sessions/${sessionId}/status/`, { status });
  }
  
  // End a session
  endSession(sessionId) {
    return api.put(`/sessions/${sessionId}/status/`, { status: 'completed' });
  }
  
  // Cancel a session
  cancelSession(sessionId, reason) {
    return api.post(`/sessions/${sessionId}/cancel/`, { reason });
  }
  
  // Upload session recording (for video sessions)
  uploadSessionRecording(sessionId, recordingFile) {
    const formData = new FormData();
    formData.append('recording_file', recordingFile);
    
    return api.post(`/sessions/${sessionId}/upload-recording`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  }
  
  // Get session statistics
  getSessionStatistics() {
    return api.get('/sessions/statistics/');
  }
  
  // Initialize emotion analysis for a session
  initializeEmotionAnalysis(sessionId) {
    return api.post('/ai_services/emotion-analysis/initialize', {
      session_id: sessionId
    });
  }
  
  // Get emotion analysis history for a session
  getEmotionHistory(sessionId) {
    return api.get(`/ai_services/emotion-analysis/history/${sessionId}`);
  }
}

const sessionService = new SessionService();
export default sessionService;