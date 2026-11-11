import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  TextField,
  Button,
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Chip,
  CircularProgress,
  InputAdornment,
  Divider,
  Tabs,
  Tab,
  IconButton,
} from '@mui/material';
import {
  CheckCircle,
  AccessTime,
  ExitToApp,
  Search,
  Person,
  Close,
} from '@mui/icons-material';
import axios from 'axios';
import { getApiBaseUrl } from '../utils/apiUrl';

interface Student {
  id: number;
  studentId: number;
  studentName: string;
  status: string;
  timeIn?: string;
  timeOut?: string;
  photoPath?: string;
  gender?: string;
  grade?: string;
  section?: string;
  timestamp: string;
}

interface AttendanceData {
  date: string;
  currentlyIn: Student[];
  currentlyOut: Student[];
  totalIn: number;
  totalOut: number;
}

interface AttendanceActivityDialogProps {
  open: boolean;
  onClose: () => void;
}

export const AttendanceActivityDialog: React.FC<AttendanceActivityDialogProps> = ({ 
  open, 
  onClose 
}) => {
  const [data, setData] = useState<AttendanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState(0); // 0 = IN, 1 = OUT
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [showPhotoModal, setShowPhotoModal] = useState(false);

  // Handle photo click
  const handlePhotoClick = (student: Student) => {
    setSelectedStudent(student);
    setShowPhotoModal(true);
  };

  // Handle close photo modal
  const handleClosePhotoModal = () => {
    setShowPhotoModal(false);
    setSelectedStudent(null);
  };

  // Load data when dialog opens
  useEffect(() => {
    if (open) {
      loadData();
      // Auto-refresh every 5 seconds while dialog is open
      const interval = setInterval(loadData, 5000);
      return () => clearInterval(interval);
    }
  }, [open]);

  const loadData = async () => {
    try {
      const response = await axios.get(
        `${getApiBaseUrl()}/api/kiosk/current-status`,
        { timeout: 5000 }
      );
      setData(response.data);
    } catch (error) {
      console.error('Failed to load attendance status:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter students by search query
  const filterStudents = (students: Student[]) => {
    if (!searchQuery.trim()) return students;
    const query = searchQuery.toLowerCase();
    return students.filter(s => 
      s.studentName.toLowerCase().includes(query) ||
      s.section?.toLowerCase().includes(query) ||
      s.grade?.toLowerCase().includes(query)
    );
  };

  const filteredIn = data ? filterStudents(data.currentlyIn) : [];
  const filteredOut = data ? filterStudents(data.currentlyOut) : [];

  // Get status icon and color
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Time-In':
        return <CheckCircle sx={{ color: '#4caf50' }} />;
      case 'Late':
        return <AccessTime sx={{ color: '#ff9800' }} />;
      case 'Time-Out':
        return <ExitToApp sx={{ color: '#2196f3' }} />;
      default:
        return <Person />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Time-In':
        return 'success';
      case 'Late':
        return 'warning';
      case 'Time-Out':
        return 'info';
      default:
        return 'default';
    }
  };

  // Format photo URL
  const getPhotoUrl = (photoPath?: string) => {
    if (!photoPath) return undefined;
    if (photoPath.startsWith('http')) return photoPath;
    return `${getApiBaseUrl()}${photoPath}`;
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="md" 
      fullWidth
      PaperProps={{
        sx: {
          maxHeight: '80vh',
        }
      }}
    >
      <DialogTitle sx={{ 
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        pb: 2,
      }}>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box display="flex" alignItems="center" gap={1}>
            <Typography variant="h6" fontWeight="bold">
              📊 Today's Attendance Status
            </Typography>
          </Box>
          <Box display="flex" gap={1}>
            <Chip 
              label={`${data?.totalIn || 0} IN`}
              sx={{ 
                bgcolor: 'rgba(255,255,255,0.2)', 
                color: 'white',
                fontWeight: 'bold',
              }}
            />
            <Chip 
              label={`${data?.totalOut || 0} OUT`}
              sx={{ 
                bgcolor: 'rgba(255,255,255,0.2)', 
                color: 'white',
                fontWeight: 'bold',
              }}
            />
          </Box>
        </Box>

        {/* Search Bar */}
        <TextField
          fullWidth
          size="small"
          placeholder="Search student name, section, or grade..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          sx={{ 
            mt: 2,
            bgcolor: 'white',
            borderRadius: 1,
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search />
              </InputAdornment>
            ),
          }}
        />
      </DialogTitle>

      <DialogContent sx={{ p: 0 }}>
        {loading ? (
          <Box display="flex" justifyContent="center" alignItems="center" minHeight="300px">
            <CircularProgress />
          </Box>
        ) : (
          <>
            {/* Tabs */}
            <Tabs 
              value={activeTab} 
              onChange={(_, newValue) => setActiveTab(newValue)}
              sx={{ borderBottom: 1, borderColor: 'divider' }}
            >
              <Tab 
                label={
                  <Box display="flex" alignItems="center" gap={1}>
                    <CheckCircle sx={{ fontSize: 20, color: '#4caf50' }} />
                    <span>Currently IN ({filteredIn.length})</span>
                  </Box>
                }
              />
              <Tab 
                label={
                  <Box display="flex" alignItems="center" gap={1}>
                    <ExitToApp sx={{ fontSize: 20, color: '#2196f3' }} />
                    <span>Currently OUT ({filteredOut.length})</span>
                  </Box>
                }
              />
            </Tabs>

            {/* Currently IN Tab */}
            {activeTab === 0 && (
              <List sx={{ maxHeight: '400px', overflow: 'auto' }}>
                {filteredIn.length === 0 ? (
                  <Box textAlign="center" py={4}>
                    <Typography variant="body2" color="text.secondary">
                      {searchQuery ? 'No students found' : 'No students currently in'}
                    </Typography>
                  </Box>
                ) : (
                  filteredIn.map((student) => (
                    <React.Fragment key={student.id}>
                      <ListItem
                        component="button"
                        onClick={() => handlePhotoClick(student)}
                        sx={{
                          '&:hover': {
                            bgcolor: 'rgba(0,0,0,0.04)',
                            cursor: 'pointer',
                          },
                        }}
                      >
                        <ListItemAvatar>
                          <Avatar 
                            src={getPhotoUrl(student.photoPath)}
                            sx={{ 
                              width: 48, 
                              height: 48,
                              border: student.status === 'Late' ? '2px solid #ff9800' : '2px solid #4caf50',
                            }}
                          >
                            {student.studentName.charAt(0)}
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={
                            <Box display="flex" alignItems="center" gap={1}>
                              <Typography fontWeight="bold">
                                {student.studentName}
                              </Typography>
                              <Chip 
                                label={student.status}
                                size="small"
                                color={getStatusColor(student.status) as any}
                                icon={getStatusIcon(student.status)}
                              />
                            </Box>
                          }
                          secondary={
                            <Box>
                              <Typography variant="caption" display="block">
                                {student.grade} - {student.section}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                Time In: {student.timeIn}
                              </Typography>
                            </Box>
                          }
                        />
                      </ListItem>
                      <Divider variant="inset" component="li" />
                    </React.Fragment>
                  ))
                )}
              </List>
            )}

            {/* Currently OUT Tab */}
            {activeTab === 1 && (
              <List sx={{ maxHeight: '400px', overflow: 'auto' }}>
                {filteredOut.length === 0 ? (
                  <Box textAlign="center" py={4}>
                    <Typography variant="body2" color="text.secondary">
                      {searchQuery ? 'No students found' : 'No students currently out'}
                    </Typography>
                  </Box>
                ) : (
                  filteredOut.map((student) => (
                    <React.Fragment key={student.id}>
                      <ListItem
                        component="button"
                        onClick={() => handlePhotoClick(student)}
                        sx={{
                          '&:hover': {
                            bgcolor: 'rgba(0,0,0,0.04)',
                            cursor: 'pointer',
                          },
                        }}
                      >
                        <ListItemAvatar>
                          <Avatar 
                            src={getPhotoUrl(student.photoPath)}
                            sx={{ 
                              width: 48, 
                              height: 48,
                              border: '2px solid #2196f3',
                            }}
                          >
                            {student.studentName.charAt(0)}
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={
                            <Box display="flex" alignItems="center" gap={1}>
                              <Typography fontWeight="bold">
                                {student.studentName}
                              </Typography>
                              <Chip 
                                label={student.status}
                                size="small"
                                color="info"
                                icon={<ExitToApp />}
                              />
                            </Box>
                          }
                          secondary={
                            <Box>
                              <Typography variant="caption" display="block">
                                {student.grade} - {student.section}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                Time Out: {student.timeOut}
                              </Typography>
                            </Box>
                          }
                        />
                      </ListItem>
                      <Divider variant="inset" component="li" />
                    </React.Fragment>
                  ))
                )}
              </List>
            )}
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button
          onClick={onClose}
          startIcon={<Close />}
          variant="contained"
          sx={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            '&:hover': {
              background: 'linear-gradient(135deg, #5568d3 0%, #653a8a 100%)',
            },
          }}
        >
          Close
        </Button>
      </DialogActions>

      {/* Photo Viewer Modal */}
      <Dialog
        open={showPhotoModal}
        onClose={handleClosePhotoModal}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: 'transparent',
            boxShadow: 'none',
          }
        }}
      >
        <Box
          sx={{
            position: 'relative',
            bgcolor: 'white',
            borderRadius: 2,
            overflow: 'hidden',
          }}
        >
          {/* Header with student name */}
          <Box
            sx={{
              bgcolor: 'primary.main',
              color: 'white',
              p: 2,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Typography variant="h6" fontWeight="bold">
              {selectedStudent?.studentName}
            </Typography>
            <IconButton
              onClick={handleClosePhotoModal}
              sx={{
                color: 'white',
                '&:hover': {
                  bgcolor: 'rgba(255,255,255,0.1)',
                },
              }}
            >
              <Close />
            </IconButton>
          </Box>

          {/* Photo */}
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              bgcolor: '#f5f5f5',
              minHeight: 400,
              maxHeight: '70vh',
              overflow: 'auto',
            }}
          >
            {selectedStudent?.photoPath ? (
              <img
                src={getPhotoUrl(selectedStudent.photoPath)}
                alt={selectedStudent.studentName}
                style={{
                  maxWidth: '100%',
                  maxHeight: '70vh',
                  objectFit: 'contain',
                }}
              />
            ) : (
              <Box textAlign="center" py={8}>
                <Person sx={{ fontSize: 100, color: '#ccc' }} />
                <Typography variant="body2" color="text.secondary" mt={2}>
                  No photo available
                </Typography>
              </Box>
            )}
          </Box>
        </Box>
      </Dialog>
    </Dialog>
  );
};
