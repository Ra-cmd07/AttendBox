import axios from 'axios';
import { getApiUrl } from '../utils/apiUrl';

const api = axios.create({
  baseURL: getApiUrl(),
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token to every request automatically
api.interceptors.request.use(config => {
  const token = localStorage.getItem('authToken');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 globally — redirect to login
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      localStorage.removeItem('authToken');
      localStorage.removeItem('teacherId');
      localStorage.removeItem('teacherName');
      window.location.href = '/login';
    }
    // Suppress 422 errors from fingerprint/predict endpoint (system not calibrated)
    if (error.response?.status === 422 && error.config?.url?.includes('/fingerprint/predict')) {
      return Promise.reject(error); // Reject silently without console error
    }
    return Promise.reject(error);
  }
);

export default api;