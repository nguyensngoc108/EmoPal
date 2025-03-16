import api from './api';

const AuthService = {
  register: async (userData) => {
    // Check if userData is FormData (for file uploads)
    const headers = userData instanceof FormData ? {
      'Content-Type': 'multipart/form-data'
    } : undefined;
    
    const response = await api.post('/users/register/', userData, { headers });
    
    // Server returns token directly in response.data.token
    if (response.data.token) {
      localStorage.setItem('auth_token', response.data.token);
    }
    return response.data;
  },
  
  login: async (credentials) => {
    const response = await api.post('/users/login/', credentials);
    if (response.data.tokens) {
      // Server returns tokens in nested object
      localStorage.setItem('auth_token', response.data.tokens.access);
      localStorage.setItem('refresh_token', response.data.tokens.refresh);
    }
    return response.data;
  },
  
  logout: () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
  },
  
  getCurrentUser: async () => {
    // This endpoint doesn't exist in your server - you need to create it
    // or use the user data returned from login
    return api.get('/users/profile/');
  },

  refreshToken: async (refreshToken) => {
    const response = await api.post('/token/refresh/', { refresh: refreshToken });
    if (response.data.access) {
      localStorage.setItem('auth_token', response.data.access);
    }
    return response.data;
  },
  
  isAuthenticated: () => {
    return localStorage.getItem('auth_token') !== null;
  }
};

export default AuthService;