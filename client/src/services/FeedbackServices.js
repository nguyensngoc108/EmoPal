import api from './api';

class FeedbackService {
  // Submit feedback for a session
  submitFeedback(sessionId, feedbackData) {
    return api.post(`/feedback/session/${sessionId}/submit/`, feedbackData);
  }

  // Get feedback for a session
  getSessionFeedback(sessionId) {
    return api.get(`/feedback/session/${sessionId}/`);
  }

  // Update existing feedback
  updateFeedback(feedbackId, feedbackData) {
    return api.put(`/feedback/${feedbackId}/update/`, feedbackData);
  }

  // Get feedback history for current user
  getFeedbackHistory(params = {}) {
    return api.get('/feedback/user/history/', { params });
  }

  // Get therapist feedback stats
  getTherapistFeedbackStats(therapistId) {
    return api.get(`/feedback/therapist/${therapistId}/stats/`);
  }
}

const feedbackService = new FeedbackService();
export default feedbackService;