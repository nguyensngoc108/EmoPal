import api from './api';

const EmotionService = {
  getUserAnalyses: (params = {}) => {
    return api.get('/emotions/history/', { params });
  },
  
  getAnalysisDetails: (analysisId) => {
    return api.get(`/emotions/analysis/${analysisId}/`);
  },
  
  getEmotionTrends: (days = 30) => {
    return api.get('/emotions/trends/', { params: { days } });
  },

  getSessionEmotionData: (sessionId) => {
    return api.get(`/emotions/session/${sessionId}/`);
  },
  
  uploadAndAnalyze: (formData) => {
    return api.post('/emotions/upload/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  
  getVisualization: (analysisId, vizType) => {
    return api.get(`/emotions/visualization/${analysisId}/${vizType}/`);
  },
  
  deleteAnalysis: (analysisId) => {
    return api.delete(`/emotions/delete/${analysisId}/`);
  }
};

export default EmotionService;