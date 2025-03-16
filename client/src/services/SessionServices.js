import api from './api';

const SessionService = {
  getUpcomingSessions: () => {
    return api.get('/sessions/upcoming/');
  },
  
  getPastSessions: (params = {}) => {
    return api.get('/sessions/past/', { params });
  },
  
  getSessionById: (sessionId) => {
    return api.get(`/sessions/${sessionId}/`);
  },
  
  bookSession: (sessionData) => {
    return api.post('/sessions/book/', sessionData);
  },
  
  quickBookSession: (sessionData) => {
    
    return api.post('/sessions/quick-book/', sessionData);
  },
  
  updateSessionStatus: (sessionId, status) => {
    return api.put(`/sessions/${sessionId}/status/`, { status });
  },
  
  endSession: (sessionId) => {
    return api.put(`/sessions/${sessionId}/status/`, { status: 'completed' });
  },
  
  cancelSession: (sessionId, reason) => {
    return api.post(`/sessions/${sessionId}/cancel/`, { reason });
  },
  
  uploadSessionRecording: (sessionId, recordingFile) => {
    const formData = new FormData();
    formData.append('recording_file', recordingFile);
    
    return api.post(`/sessions/${sessionId}/upload-recording/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  
  addNotes: (sessionId, notes) => {
    return api.put(`/sessions/${sessionId}/notes/`, { notes });
  },
  
  initiateVideoCall: (data) => {
    return api.post('/sessions/initiate-video-call/', data);
  }
};

export default SessionService;