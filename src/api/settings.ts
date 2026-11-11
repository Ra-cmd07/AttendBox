import api from './client';

export const settingsAPI = {
  // Get current permission settings
  getPermissions: () => api.get('/settings/permissions'),
  
  // Update permission settings (Admin only)
  updatePermissions: (data: { allow_teacher_id_generation: boolean }) =>
    api.post('/settings/permissions', data),
};

export default settingsAPI;
