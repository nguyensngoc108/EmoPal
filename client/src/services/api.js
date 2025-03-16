import axios from 'axios';

// Dynamically determine API URL based on environment
const getApiUrl = () => {
  const hostname = window.location.hostname;
  
  // Check if we're on ngrok
  if (hostname.includes('ngrok-free.app')) {
    // Use the current origin for API calls when on ngrok
    return `${window.location.origin}/api`;
  }
  
  // Use the configured URL for local development
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }
  
  // Fallback
  return `${window.location.origin}/api`;
};

// Create axios instance with base configuration
const api = axios.create({
  baseURL: getApiUrl(),
  headers: {
    'Content-Type': 'application/json'
  },
  withCredentials: true
});

// Add request interceptor for auth tokens
api.interceptors.request.use(
  config => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }

    // Get CSRF token from cookies if it exists
    const csrfToken = document.cookie
      .split('; ')
      .find(row => row.startsWith('csrftoken='))
      ?.split('=')[1];
      
    if (csrfToken) {
      config.headers['X-CSRFToken'] = csrfToken;
    }

    return config;
  },
  error => Promise.reject(error)
);

// Add response interceptor for token refresh
api.interceptors.response.use(
  response => response,
  async error => {
    const originalRequest = error.config;
    
    // If error is 401 and we haven't tried refreshing the token yet
    if (error.response.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        const refreshToken = localStorage.getItem('refresh_token');
        if (!refreshToken) {
          // No refresh token available, can't refresh
          return Promise.reject(error);
        }
        
        // Try to get a new token
        const response = await axios.post(`${getApiUrl()}/api/token/refresh/`, {
          refresh: refreshToken
        });
        
        // If successful, update the token
        if (response.data.access) {
          localStorage.setItem('auth_token', response.data.access);
          
          // Update the original request with the new token
          originalRequest.headers['Authorization'] = `Bearer ${response.data.access}`;
          return axios(originalRequest);
        }
      } catch (refreshError) {
        // If refresh fails, redirect to login
        localStorage.removeItem('auth_token');
        localStorage.removeItem('refresh_token');
        window.location = '/login';
        return Promise.reject(refreshError);
      }
    }
    
    return Promise.reject(error);
  }
);

export default api;