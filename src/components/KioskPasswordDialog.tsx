import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  TextField,
  Button,
  Box,
  Alert,
  Typography,
  IconButton,
  InputAdornment,
  LinearProgress,
} from '@mui/material';
import { Visibility, VisibilityOff, Lock, Warning } from '@mui/icons-material';
import axios from 'axios';
import { getApiBaseUrl } from '../utils/apiUrl';

interface KioskPasswordDialogProps {
  open: boolean;
  onSuccess: (autoLockMinutes: number) => void;
}

export const KioskPasswordDialog: React.FC<KioskPasswordDialogProps> = ({ 
  open, 
  onSuccess 
}) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [locked, setLocked] = useState(false);
  const [lockedUntil, setLockedUntil] = useState<Date | null>(null);
  const [remainingMinutes, setRemainingMinutes] = useState(0);
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);

  // Update countdown timer
  useEffect(() => {
    if (!locked || !lockedUntil) return;

    const interval = setInterval(() => {
      const remaining = Math.ceil((lockedUntil.getTime() - Date.now()) / 60000);
      
      if (remaining <= 0) {
        setLocked(false);
        setLockedUntil(null);
        setRemainingMinutes(0);
        setError('');
      } else {
        setRemainingMinutes(remaining);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [locked, lockedUntil]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!password.trim()) {
      setError('Please enter a password');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await axios.post(
        `${getApiBaseUrl()}/api/kiosk/verify-password`,
        { password },
        { 
          headers: { 'Content-Type': 'application/json' },
          timeout: 5000 
        }
      );

      if (response.data.success) {
        // Success - unlock kiosk
        const autoLockMinutes = response.data.autoLockMinutes || 5;
        onSuccess(autoLockMinutes);
        setPassword('');
        setError('');
        setRemainingAttempts(null);
      }
    } catch (err: any) {
      console.error('Password verification error:', err);

      if (err.response?.status === 401) {
        // Incorrect password
        const data = err.response.data;
        setError(data.message || 'Incorrect password');
        setRemainingAttempts(data.remainingAttempts);
        setPassword(''); // Clear password field
      } else if (err.response?.status === 403) {
        // Locked out
        const data = err.response.data;
        setLocked(true);
        setLockedUntil(new Date(data.lockedUntil));
        setRemainingMinutes(data.remainingMinutes);
        setError(data.message || 'Access temporarily locked');
        setPassword('');
      } else if (err.code === 'ECONNABORTED') {
        setError('Connection timeout. Please check your network.');
      } else {
        setError('Connection error. Please check if the backend server is running.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
    // Clear error when user starts typing
    if (error && !locked) {
      setError('');
    }
  };

  return (
    <Dialog 
      open={open} 
      maxWidth="sm" 
      fullWidth
      disableEscapeKeyDown
      style={{ zIndex: 9999 }}
      BackdropProps={{
        style: { zIndex: 9998 }
      }}
      PaperProps={{
        sx: {
          borderRadius: 2,
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          zIndex: 9999,
        }
      }}
    >
      <DialogTitle sx={{ 
        textAlign: 'center', 
        pb: 1,
        pt: 3,
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white'
      }}>
        <Lock sx={{ fontSize: 48, mb: 1 }} />
        <Typography variant="h5" fontWeight="bold">
          Kiosk Locked
        </Typography>
      </DialogTitle>

      <DialogContent sx={{ pt: 3, pb: 4 }}>
        {/* Warning Message */}
        <Alert 
          severity="warning" 
          icon={<Warning />}
          sx={{ mb: 3 }}
        >
          <Typography variant="body2" fontWeight="600">
            ⚠️ AUTHORIZED PERSONNEL ONLY
          </Typography>
          <Typography variant="caption" display="block" mt={0.5}>
            This kiosk is for authorized users only. Unauthorized access attempts are logged and monitored.
          </Typography>
        </Alert>

        {/* Lockout Warning */}
        {locked && (
          <Alert severity="error" sx={{ mb: 2 }}>
            <Typography variant="body2" fontWeight="600">
              🚫 Access Locked
            </Typography>
            <Typography variant="caption" display="block" mt={0.5}>
              Too many failed attempts. Please wait {remainingMinutes} minute(s) before trying again.
            </Typography>
          </Alert>
        )}

        {/* Error Message */}
        {error && !locked && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
            {remainingAttempts !== null && (
              <Typography variant="caption" display="block" mt={0.5}>
                {remainingAttempts} attempt(s) remaining before lockout.
              </Typography>
            )}
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          <TextField
            fullWidth
            type={showPassword ? 'text' : 'password'}
            label="Enter Password"
            value={password}
            onChange={handlePasswordChange}
            disabled={loading || locked}
            autoFocus
            autoComplete="off"
            sx={{ mb: 3 }}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    onClick={() => setShowPassword(!showPassword)}
                    edge="end"
                    disabled={loading || locked}
                  >
                    {showPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />

          {loading && <LinearProgress sx={{ mb: 2 }} />}

          <Button
            type="submit"
            fullWidth
            variant="contained"
            size="large"
            disabled={loading || locked || !password.trim()}
            sx={{
              py: 1.5,
              fontSize: '1.1rem',
              fontWeight: 'bold',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              '&:hover': {
                background: 'linear-gradient(135deg, #5568d3 0%, #653a8a 100%)',
              },
            }}
          >
            {loading ? 'Verifying...' : locked ? 'Locked' : 'Unlock Kiosk'}
          </Button>
        </form>

        <Box sx={{ mt: 2, textAlign: 'center' }}>
          <Typography variant="caption" color="text.secondary">
            All login attempts are logged for security purposes
          </Typography>
        </Box>
      </DialogContent>
    </Dialog>
  );
};
