import api from './api';

const TherapistService = {
  // Enhance the getTherapists method to handle more filter parameters
  getTherapists: (params = {}) => {
    // Convert arrays to comma-separated strings if needed
    const formattedParams = { ...params };
    if (Array.isArray(params.languages)) {
      formattedParams.languages = params.languages.join(',');
    }
    if (Array.isArray(params.specializations)) {
      formattedParams.specializations = params.specializations.join(',');
    }
    
    return api.get('/therapists/', { params: formattedParams });
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
  },
  
  // Add advanced search method
  searchTherapistsByKeyword: (keyword, params = {}) => {
    return api.get('/therapists/search/', { 
      params: { 
        query: keyword,
        ...params 
      } 
    });
  },
};

export default TherapistService;