import api from './api';

const TherapistService = {
  getTherapists: (params = {}) => {
    return api.get('/therapists/', { params });
  },
  
  getTherapistById: (therapistId) => {
    return api.get(`/therapists/${therapistId}/`);
  },
  
  getTherapistProfile: (therapistId) => {
    return api.get(`/therapists/${therapistId}/`);
  },
  
  getTherapistFeedback: (therapistId, params = {}) => {
    return api.get(`/feedback/therapist/${therapistId}/`, { params });
  },
  
  getTherapistAvailability: (therapistId, params = {}) => {
    return api.get(`/sessions/availability/${therapistId}/`, { params });
  },
  
  getRecentClients: () => {
    return api.get('/therapists/clients/recent/');
  },
  
  updateAvailability: (availabilityData) => {
    return api.post('/sessions/availability/set/', availabilityData);
  },
  
  getAvailability: () => {
    return api.get('/sessions/availability/');
  },
  
  proposeSession: (sessionData) => {
    return api.post('/sessions/propose/', sessionData);
  },
  
  searchTherapists: (params = {}) => {
    return api.get('/therapists/search/', { params });
  },
  
  getSpecializations: () => {
    return api.get('/therapists/specializations/');
  }
};

export default TherapistService;