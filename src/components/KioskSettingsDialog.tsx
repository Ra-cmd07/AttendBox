import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  Alert,
  Typography,
  Slider,
  FormControl,
  FormLabel,
  CircularProgress,
} from '@mui/material';
import { Settings, Save, Close } from '@mui/icons-material';
import axios from 'axios';
import { getApiBaseUrl } from '../utils/apiUrl';

interface KioskSettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

export const KioskSettingsDialog: React.FC<KioskSettingsDialogProps> = ({ 
  open, 
  onClose 
}) => {
  const [autoLockMinutes, setAutoLockMinutes] = useState(5);
  const [maxAttempts, setMaxAttempts] = useState(3);
  const [lockoutMinutes, setLockoutMinutes] = useState(15);
  const [loading, setLoading] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Load current settings when dialog opens
  useEffect(() => {
    if (open) {
      loadSettings();
    }
  }, [open]);

  const loadSettings = async () => {
    setLoadingSettings(true);
    setError('');
    try {
      const response = await axios.get(
        `${getApiBaseUrl()}/api/kiosk/settings`,
        { timeout: 5000 }
      );

      if (response.data) {
        setAutoLockMinutes(response.data.autoLockMinutes || 5);
        setMaxAttempts(response.data.maxAttempts || 3);
        setLockoutMinutes(response.data.lockoutMinutes || 15);
      }
    } catch (err: any) {
      console.error('Failed to load settings:', err);
      setError('Failed to load current settings. Using defaults.');
    } finally {
      setLoadingSettings(false);
    }
  };

  const handleSave = async () => {
    // Validation
    if (autoLockMinutes < 1 || autoLockMinutes > 60) {
      setError('Auto-lock must be between 1-60 minutes');
      return;
    }
    if (maxAttempts < 1 || maxAttempts > 10) {
      setError('Max attempts must be between 1-10');
      return;
    }
    if (lockoutMinutes < 5 || lockoutMinutes > 60) {
      setError('Lockout time must be between 5-60 minutes');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await axios.post(
        `${getApiBaseUrl()}/api/kiosk/settings`,
        {
          autoLockMinutes,
          maxAttempts,
          lockoutMinutes,
        },
        { 
          headers: { 'Content-Type': 'application/json' },
          timeout: 5000 
        }
      );

      if (response.data.success) {
        setSuccess('Settings saved! Changes will take effect on next unlock.');
        setTimeout(() => {
          onClose();
        }, 2000);
      }
    } catch (err: any) {
      console.error('Failed to save settings:', err);
      if (err.response?.status === 403) {
        setError('Permission denied. Admin access required.');
      } else if (err.code === 'ECONNABORTED') {
        setError('Connection timeout. Please check your network.');
      } else {
        setError('Failed to save settings. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="sm" 
      fullWidth
    >
      <DialogTitle sx={{ 
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        gap: 1,
      }}>
        <Settings />
        <Typography variant="h6" fontWeight="bold">
          Kiosk Security Settings
        </Typography>
      </DialogTitle>

      <DialogContent sx={{ mt: 2 }}>
        {loadingSettings ? (
          <Box display="flex" justifyContent="center" alignItems="center" minHeight="300px">
            <CircularProgress />
          </Box>
        ) : (
          <>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            {success && (
              <Alert severity="success" sx={{ mb: 2 }}>
                {success}
              </Alert>
            )}

            {/* Auto-Lock Timer */}
            <FormControl fullWidth sx={{ mb: 4 }}>
              <FormLabel sx={{ mb: 1, fontWeight: 'bold' }}>
                ⏱️ Auto-Lock Timer
              </FormLabel>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 2 }}>
                Kiosk will automatically lock after this many minutes of inactivity
              </Typography>
              <Box sx={{ px: 2 }}>
                <Slider
                  value={autoLockMinutes}
                  onChange={(_, value) => setAutoLockMinutes(value as number)}
                  min={1}
                  max={60}
                  marks={[
                    { value: 1, label: '1 min' },
                    { value: 5, label: '5 min' },
                    { value: 10, label: '10 min' },
                    { value: 30, label: '30 min' },
                    { value: 60, label: '60 min' },
                  ]}
                  valueLabelDisplay="on"
                  valueLabelFormat={(value) => `${value} min`}
                />
              </Box>
              <TextField
                type="number"
                value={autoLockMinutes}
                onChange={(e) => setAutoLockMinutes(Number(e.target.value))}
                inputProps={{ min: 1, max: 60 }}
                label="Minutes"
                size="small"
                sx={{ mt: 2 }}
              />
            </FormControl>

            {/* Max Failed Attempts */}
            <FormControl fullWidth sx={{ mb: 4 }}>
              <FormLabel sx={{ mb: 1, fontWeight: 'bold' }}>
                🔢 Maximum Failed Attempts
              </FormLabel>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 2 }}>
                Number of wrong passwords before temporary lockout
              </Typography>
              <Box sx={{ px: 2 }}>
                <Slider
                  value={maxAttempts}
                  onChange={(_, value) => setMaxAttempts(value as number)}
                  min={1}
                  max={10}
                  marks={[
                    { value: 1, label: '1' },
                    { value: 3, label: '3' },
                    { value: 5, label: '5' },
                    { value: 10, label: '10' },
                  ]}
                  valueLabelDisplay="on"
                />
              </Box>
              <TextField
                type="number"
                value={maxAttempts}
                onChange={(e) => setMaxAttempts(Number(e.target.value))}
                inputProps={{ min: 1, max: 10 }}
                label="Attempts"
                size="small"
                sx={{ mt: 2 }}
              />
            </FormControl>

            {/* Lockout Duration */}
            <FormControl fullWidth sx={{ mb: 2 }}>
              <FormLabel sx={{ mb: 1, fontWeight: 'bold' }}>
                ⏳ Lockout Duration
              </FormLabel>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 2 }}>
                How long to lock access after maximum failed attempts
              </Typography>
              <Box sx={{ px: 2 }}>
                <Slider
                  value={lockoutMinutes}
                  onChange={(_, value) => setLockoutMinutes(value as number)}
                  min={5}
                  max={60}
                  marks={[
                    { value: 5, label: '5 min' },
                    { value: 15, label: '15 min' },
                    { value: 30, label: '30 min' },
                    { value: 60, label: '60 min' },
                  ]}
                  valueLabelDisplay="on"
                  valueLabelFormat={(value) => `${value} min`}
                />
              </Box>
              <TextField
                type="number"
                value={lockoutMinutes}
                onChange={(e) => setLockoutMinutes(Number(e.target.value))}
                inputProps={{ min: 5, max: 60 }}
                label="Minutes"
                size="small"
                sx={{ mt: 2 }}
              />
            </FormControl>

            {/* Summary */}
            <Alert severity="info" sx={{ mt: 3 }}>
              <Typography variant="body2" fontWeight="bold">
                Current Configuration:
              </Typography>
              <Typography variant="caption" display="block" mt={1}>
                • Auto-lock after <strong>{autoLockMinutes} minutes</strong> of inactivity
              </Typography>
              <Typography variant="caption" display="block">
                • Max <strong>{maxAttempts} failed attempts</strong> before lockout
              </Typography>
              <Typography variant="caption" display="block">
                • Lockout for <strong>{lockoutMinutes} minutes</strong>
              </Typography>
            </Alert>
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button
          onClick={onClose}
          disabled={loading}
          startIcon={<Close />}
        >
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          disabled={loading || loadingSettings}
          variant="contained"
          startIcon={loading ? <CircularProgress size={20} /> : <Save />}
          sx={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            '&:hover': {
              background: 'linear-gradient(135deg, #5568d3 0%, #653a8a 100%)',
            },
          }}
        >
          {loading ? 'Saving...' : 'Save Settings'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
