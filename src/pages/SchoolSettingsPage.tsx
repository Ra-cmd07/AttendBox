import { useState, useEffect, useCallback } from 'react';
import {
  Box, Paper, Typography, Switch, FormControlLabel, TextField, Grid,
  Button, Alert, CircularProgress, Divider, Card, CardContent,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import SettingsIcon from '@mui/icons-material/Settings';
import BadgeIcon from '@mui/icons-material/Badge';
import SchoolIcon from '@mui/icons-material/School';
import { settingsAPI } from '../api/settings';
import api from '../api/client';

const FONT = '"Nunito", sans-serif';

export default function SchoolSettingsPage() {
  // Permission settings
  const [settings, setSettings] = useState({
    allow_teacher_id_generation: false,
  });
  
  // School information settings
  const [schoolInfo, setSchoolInfo] = useState({
    school_id: '', region: '', division: '', district: '',
    school_name: '', school_year: '', school_head_name: '',
  });
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingSchool, setSavingSchool] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  // Load current settings
  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      // Load permissions
      const { data } = await settingsAPI.getPermissions();
      setSettings({
        allow_teacher_id_generation: data.allow_teacher_id_generation || false,
      });
      
      // Load school information
      const schoolResponse = await api.get('/admin/school-settings');
      const d = schoolResponse.data || {};
      setSchoolInfo({
        school_id:        d.school_id        || '',
        region:           d.region           || '',
        division:         d.division         || '',
        district:         d.district         || '',
        school_name:      d.school_name      || '',
        school_year:      d.school_year      || '',
        school_head_name: d.school_head_name || '',
      });
    } catch (err) {
      setError('Failed to load settings');
      console.error('Load settings error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleToggle = (key: keyof typeof settings) => {
    setSettings(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSavePermissions = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    
    try {
      await settingsAPI.updatePermissions(settings);
      setSuccess('Permission settings saved successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Failed to save permission settings');
      console.error('Save settings error:', err);
    } finally {
      setSaving(false);
    }
  };
  
  const handleSaveSchoolInfo = async () => {
    setSavingSchool(true);
    setError('');
    setSuccess('');
    
    try {
      await api.put('/admin/school-settings', schoolInfo);
      setSuccess('School information saved successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Failed to save school information');
      console.error('Save school info error:', err);
    } finally {
      setSavingSchool(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <SettingsIcon sx={{ fontSize: 40, color: '#2d5016' }} />
        <Box>
          <Typography variant="h4" sx={{ fontFamily: FONT, fontWeight: 700 }}>
            School Settings
          </Typography>
          <Typography variant="body2" sx={{ fontFamily: FONT, color: 'text.secondary' }}>
            Configure system-wide permissions and school information
          </Typography>
        </Box>
      </Box>

      {/* Alerts */}
      {error && (
        <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" onClose={() => setSuccess('')} sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* SECTION 1: SCHOOL INFORMATION (for SF1/SF2) */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <Card sx={{ mb: 3, borderRadius: '12px' }}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
            <SchoolIcon sx={{ color: '#1565c0' }} />
            <Typography variant="h6" sx={{ fontFamily: FONT, fontWeight: 700 }}>
              School Information
            </Typography>
          </Box>
          <Typography variant="body2" sx={{ fontFamily: FONT, color: 'text.secondary', mb: 3 }}>
            Used to populate SF1 &amp; SF2 report headers and system identification
          </Typography>

          <Divider sx={{ mb: 3 }} />

          <Grid container spacing={3}>
            <Grid item xs={12} sm={6}>
              <TextField 
                label="School ID" 
                fullWidth 
                value={schoolInfo.school_id}
                onChange={e => setSchoolInfo(f => ({ ...f, school_id: e.target.value }))}
                helperText="DepEd-assigned school ID number"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField 
                label="School Year" 
                fullWidth 
                value={schoolInfo.school_year}
                onChange={e => setSchoolInfo(f => ({ ...f, school_year: e.target.value }))}
                placeholder="e.g. 2025-2026"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField 
                label="Name of School" 
                fullWidth 
                value={schoolInfo.school_name}
                onChange={e => setSchoolInfo(f => ({ ...f, school_name: e.target.value }))}
                placeholder="e.g. Iponan National High School"
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField 
                label="Region" 
                fullWidth 
                value={schoolInfo.region}
                onChange={e => setSchoolInfo(f => ({ ...f, region: e.target.value }))}
                placeholder="e.g. Region X" 
                helperText="For SF1 header"
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField 
                label="Division" 
                fullWidth 
                value={schoolInfo.division}
                onChange={e => setSchoolInfo(f => ({ ...f, division: e.target.value }))}
                placeholder="e.g. Cagayan de Oro City" 
                helperText="For SF1 header"
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField 
                label="District" 
                fullWidth 
                value={schoolInfo.district}
                onChange={e => setSchoolInfo(f => ({ ...f, district: e.target.value }))}
                placeholder="e.g. District III" 
                helperText="For SF1 header"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField 
                label="School Head Name" 
                fullWidth 
                value={schoolInfo.school_head_name}
                onChange={e => setSchoolInfo(f => ({ ...f, school_head_name: e.target.value }))}
                helperText="Appears on SF1 &amp; SF2 signature line"
              />
            </Grid>
          </Grid>

          {/* Save School Info Button */}
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
            <Button
              variant="contained"
              onClick={handleSaveSchoolInfo}
              disabled={savingSchool}
              startIcon={savingSchool ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
              sx={{
                fontFamily: FONT,
                bgcolor: '#1565c0',
                px: 4,
                '&:hover': {
                  bgcolor: '#0d47a1',
                },
              }}
            >
              {savingSchool ? 'Saving...' : 'Save School Information'}
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* SECTION 2: PERMISSIONS & ACCESS CONTROL (ID Generator) */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <Card sx={{ mb: 3, borderRadius: '12px' }}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
            <BadgeIcon sx={{ color: '#2d5016' }} />
            <Typography variant="h6" sx={{ fontFamily: FONT, fontWeight: 700 }}>
              Permissions & Access Control
            </Typography>
          </Box>

          <Divider sx={{ mb: 3 }} />

          {/* School ID Generation Permission */}
          <Box sx={{ mb: 3 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={settings.allow_teacher_id_generation}
                  onChange={() => handleToggle('allow_teacher_id_generation')}
                  sx={{
                    '& .MuiSwitch-switchBase.Mui-checked': {
                      color: '#4ade80',
                    },
                    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                      backgroundColor: '#2d5016',
                    },
                  }}
                />
              }
              label={
                <Box>
                  <Typography sx={{ fontFamily: FONT, fontWeight: 600 }}>
                    Allow Teachers to Generate School IDs
                  </Typography>
                  <Typography variant="body2" sx={{ fontFamily: FONT, color: 'text.secondary', mt: 0.5 }}>
                    When enabled, advisory teachers can generate School ID cards for students in their assigned section.
                    <br />
                    When disabled, only administrators can generate School IDs.
                  </Typography>
                </Box>
              }
              sx={{ alignItems: 'flex-start', m: 0 }}
            />
          </Box>

          {/* Info Box */}
          <Box
            sx={{
              p: 2,
              borderRadius: '8px',
              bgcolor: 'action.hover',
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Typography variant="body2" sx={{ fontFamily: FONT, color: 'text.secondary' }}>
              <strong>Note:</strong> This setting only affects <strong>advisory teachers</strong> (teachers assigned to a specific class section).
              Subject teachers who only teach subjects will not have access to ID generation regardless of this setting.
              Administrators always have access to generate IDs for all students.
            </Typography>
          </Box>

          {/* Save Permissions Button */}
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 3 }}>
            <Button
              variant="outlined"
              onClick={loadSettings}
              disabled={saving}
              sx={{
                fontFamily: FONT,
                borderColor: 'divider',
                color: 'text.secondary',
              }}
            >
              Reset
            </Button>
            <Button
              variant="contained"
              onClick={handleSavePermissions}
              disabled={saving}
              startIcon={saving ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
              sx={{
                fontFamily: FONT,
                bgcolor: '#2d5016',
                px: 4,
                '&:hover': {
                  bgcolor: '#1f3a0f',
                },
              }}
            >
              {saving ? 'Saving...' : 'Save Permissions'}
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Status Summary */}
      <Paper
        sx={{
          mt: 3,
          p: 2,
          borderRadius: '8px',
          bgcolor: settings.allow_teacher_id_generation
            ? 'rgba(74,222,128,0.08)'
            : 'rgba(239,68,68,0.08)',
          border: '1px solid',
          borderColor: settings.allow_teacher_id_generation
            ? 'rgba(74,222,128,0.3)'
            : 'rgba(239,68,68,0.3)',
        }}
      >
        <Typography variant="body2" sx={{ fontFamily: FONT, fontWeight: 600, mb: 0.5 }}>
          Current ID Generator Status:
        </Typography>
        <Typography variant="body2" sx={{ fontFamily: FONT }}>
          {settings.allow_teacher_id_generation ? (
            <>
              ✅ Advisory teachers <strong>CAN</strong> generate School IDs for their students.
            </>
          ) : (
            <>
              ❌ Advisory teachers <strong>CANNOT</strong> generate School IDs. Only admins can.
            </>
          )}
        </Typography>
      </Paper>
    </Box>
  );
}
