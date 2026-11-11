import { useEffect, useState } from 'react';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Chip,
  CircularProgress,
  Avatar,
  Tooltip,
  IconButton,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
} from '@mui/material';
import { Refresh, Photo, Person, Phone, Close } from '@mui/icons-material';
import { io, Socket } from 'socket.io-client';
import api from '../api/client';
import theme from '../theme/professionalTheme';
import { getApiBaseUrl } from '../utils/apiUrl';

interface ParentInfo {
  name: string;
  contact: string;
  username: string;
}

interface AttendanceRecord {
  id: number;
  student_id: number;
  student_name: string;
  grade: string;
  section: string;
  date: string;
  time_in: string;
  time_out?: string | null;
  scan_method: string;
  status: string;
  session: string;
  photo_path: string | null;
  subject_teacher_name: string | null;
  subject_teacher_username: string | null;
  subject_teacher_id: number | null;
  subject: string | null;
  adviser_name: string | null;
  adviser_username: string | null;
  adviser_id: number | null;
  has_assignment: boolean;
  parents: ParentInfo[];
}

export default function RecentAttendancePage() {
  const [data, setData] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  
  // Photo dialog state
  const [photoDialogOpen, setPhotoDialogOpen] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<{
    url: string;
    studentName: string;
  } | null>(null);

  // Fetch attendance data
  const fetchAttendance = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/attendance/recent-detailed');
      setData(response.data);
      setLastUpdate(new Date());
      console.log('✅ Fetched recent attendance:', response.data.length, 'records');
    } catch (err: any) {
      console.error('❌ Error fetching attendance:', err);
      setError(err.response?.data?.error || 'Failed to load attendance data');
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchAttendance();
  }, []);

  // WebSocket connection for real-time updates
  useEffect(() => {
    const socketUrl = getApiBaseUrl().replace('/api', '');
    console.log('🔌 Connecting to WebSocket:', socketUrl);
    const newSocket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    newSocket.on('connect', () => {
      console.log('✅ WebSocket connected');
      // Identify as admin to receive admin-specific events
      newSocket.emit('identify', { role: 'admin' });
    });

    newSocket.on('identified', (data: any) => {
      console.log('✅ Identified as admin:', data);
    });

    // Listen for assignment changes
    newSocket.on('assignment:changed', (data: any) => {
      console.log('📡 Assignment changed:', data);
      console.log('🔄 Refreshing attendance list...');
      fetchAttendance(); // Auto-refresh when assignments change
    });

    newSocket.on('disconnect', () => {
      console.log('🔌 WebSocket disconnected');
    });

    newSocket.on('connect_error', (err: any) => {
      console.error('❌ WebSocket connection error:', err);
    });

    setSocket(newSocket);

    return () => {
      console.log('🔌 Closing WebSocket connection');
      newSocket.close();
    };
  }, []);

  // Get scan method chip color
  const getMethodColor = (method: string) => {
    switch (method.toUpperCase()) {
      case 'BLE':
        return 'primary';
      case 'QR':
        return 'secondary';
      case 'RFID':
        return 'success';
      default:
        return 'default';
    }
  };

  // Get status chip color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Time-In':
        return 'success';
      case 'Late':
        return 'warning';
      case 'Excused':
        return 'info';
      default:
        return 'default';
    }
  };

  // Handle photo click
  const handlePhotoClick = (photoPath: string | null, studentName: string) => {
    if (photoPath) {
      const photoUrl = `${getApiBaseUrl().replace('/api', '')}${photoPath}`;
      setSelectedPhoto({ url: photoUrl, studentName });
      setPhotoDialogOpen(true);
    }
  };

  // Close photo dialog
  const handleClosePhotoDialog = () => {
    setPhotoDialogOpen(false);
    setSelectedPhoto(null);
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 600, color: theme.colors.primary.main }}>
            Recent Attendance
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Last 7 days • Real-time updates via WebSocket
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          {lastUpdate && (
            <Typography variant="caption" color="text.secondary">
              Updated: {lastUpdate.toLocaleTimeString()}
            </Typography>
          )}
          <Tooltip title="Refresh">
            <IconButton onClick={fetchAttendance} color="primary">
              <Refresh />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Connection Status */}
      {socket?.connected && (
        <Alert severity="success" sx={{ mb: 2 }}>
          🔌 Connected • Real-time updates active
        </Alert>
      )}

      {/* Error */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Loading */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
          <CircularProgress />
        </Box>
      ) : (
        /* Table */
        <TableContainer component={Paper} elevation={2}>
          <Table>
            <TableHead sx={{ bgcolor: theme.colors.primary.main }}>
              <TableRow>
                <TableCell sx={{ color: '#fff', fontWeight: 600 }}>Student</TableCell>
                <TableCell sx={{ color: '#fff', fontWeight: 600 }}>Grade/Section</TableCell>
                <TableCell sx={{ color: '#fff', fontWeight: 600 }}>Date</TableCell>
                <TableCell sx={{ color: '#fff', fontWeight: 600 }}>Time</TableCell>
                <TableCell sx={{ color: '#fff', fontWeight: 600 }}>Session</TableCell>
                <TableCell sx={{ color: '#fff', fontWeight: 600 }}>Method</TableCell>
                <TableCell sx={{ color: '#fff', fontWeight: 600 }}>Subject Teacher</TableCell>
                <TableCell sx={{ color: '#fff', fontWeight: 600 }}>Adviser</TableCell>
                <TableCell sx={{ color: '#fff', fontWeight: 600 }}>Parents</TableCell>
                <TableCell sx={{ color: '#fff', fontWeight: 600 }}>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">
                      No attendance records found for the last 7 days
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                data.map((row) => (
                  <TableRow key={row.id} hover>
                    {/* Student */}
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {row.photo_path ? (
                          <Avatar 
                            src={`${getApiBaseUrl().replace('/api', '')}${row.photo_path}`} 
                            sx={{ 
                              width: 32, 
                              height: 32,
                              cursor: 'pointer',
                              transition: 'transform 0.2s',
                              '&:hover': {
                                transform: 'scale(1.1)',
                                boxShadow: 2
                              }
                            }}
                            onClick={() => handlePhotoClick(row.photo_path, row.student_name)}
                          />
                        ) : (
                          <Avatar sx={{ width: 32, height: 32, bgcolor: theme.colors.primary.light }}>
                            <Person />
                          </Avatar>
                        )}
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {row.student_name}
                        </Typography>
                      </Box>
                    </TableCell>

                    {/* Grade/Section */}
                    <TableCell>
                      <Typography variant="body2">
                        {row.grade} {row.section}
                      </Typography>
                    </TableCell>

                    {/* Date */}
                    <TableCell>
                      <Typography variant="body2">
                        {new Date(row.date).toLocaleDateString('en-US', { 
                          month: 'short', 
                          day: 'numeric', 
                          year: 'numeric' 
                        })}
                      </Typography>
                    </TableCell>

                    {/* Time */}
                    <TableCell>
                      <Typography variant="body2">
                        {row.status === 'Time-Out' ? (row.time_out || '-') : row.time_in}
                      </Typography>
                    </TableCell>

                    {/* Session */}
                    <TableCell>
                      <Chip 
                        label={row.session} 
                        size="small" 
                        sx={{ 
                          bgcolor: row.session === 'AM' ? '#1565c0' : '#6a1b9a',
                          color: '#fff',
                          fontSize: '0.75rem'
                        }} 
                      />
                    </TableCell>

                    {/* Method */}
                    <TableCell>
                      <Chip 
                        label={row.scan_method} 
                        size="small" 
                        color={getMethodColor(row.scan_method)}
                      />
                    </TableCell>

                    {/* Subject Teacher */}
                    <TableCell>
                      {row.has_assignment ? (
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {row.subject_teacher_name || 'Not assigned'}
                            {row.subject_teacher_username && (
                              <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 0.5 }}>
                                ({row.subject_teacher_username})
                              </Typography>
                            )}
                          </Typography>
                          {row.subject && (
                            <Typography variant="caption" color="text.secondary">
                              {row.subject}
                            </Typography>
                          )}
                        </Box>
                      ) : (
                        <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                          No class assigned
                        </Typography>
                      )}
                    </TableCell>

                    {/* Adviser */}
                    <TableCell>
                      {row.has_assignment ? (
                        <Typography variant="body2">
                          {row.adviser_name || 'Not assigned'}
                          {row.adviser_username && (
                            <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 0.5 }}>
                              ({row.adviser_username})
                            </Typography>
                          )}
                        </Typography>
                      ) : (
                        <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                          No class assigned
                        </Typography>
                      )}
                    </TableCell>

                    {/* Parents */}
                    <TableCell>
                      {row.parents.length > 0 ? (
                        <Box>
                          {row.parents.map((parent, idx) => (
                            <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5, flexWrap: 'wrap' }}>
                              <Person sx={{ fontSize: 16, color: 'text.secondary' }} />
                              <Typography variant="caption" display="inline">
                                {parent.name}
                                {parent.username && (
                                  <Typography component="span" variant="caption" color="text.secondary">
                                    {' '}({parent.username})
                                  </Typography>
                                )}
                              </Typography>
                              {parent.contact && (
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: 1 }}>
                                  <Phone sx={{ fontSize: 14, color: 'text.secondary' }} />
                                  <Typography variant="caption" color="text.secondary">
                                    {parent.contact}
                                  </Typography>
                                </Box>
                              )}
                            </Box>
                          ))}
                        </Box>
                      ) : (
                        <Typography variant="caption" color="text.secondary">
                          No parents
                        </Typography>
                      )}
                    </TableCell>

                    {/* Status */}
                    <TableCell>
                      <Chip 
                        label={row.status} 
                        size="small" 
                        color={getStatusColor(row.status)}
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Footer info */}
      {!loading && data.length > 0 && (
        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            Showing {data.length} records from the last 7 days
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Updates automatically when assignments are modified
          </Typography>
        </Box>
      )}

      {/* Photo Enlargement Dialog */}
      <Dialog
        open={photoDialogOpen}
        onClose={(event, reason) => {
          // Only close via close button, not backdrop or ESC
          if (reason === 'backdropClick' || reason === 'escapeKeyDown') {
            return;
          }
          handleClosePhotoDialog();
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          bgcolor: theme.colors.primary.main,
          color: '#fff',
          py: 2
        }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            {selectedPhoto?.studentName || 'Student Photo'}
          </Typography>
          <IconButton 
            onClick={handleClosePhotoDialog}
            sx={{ color: '#fff' }}
            size="small"
          >
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center',
          p: 3,
          bgcolor: '#f5f5f5'
        }}>
          {selectedPhoto && (
            <Box
              component="img"
              src={selectedPhoto.url}
              alt={selectedPhoto.studentName}
              sx={{
                width: 400,
                height: 400,
                objectFit: 'cover',
                borderRadius: 2,
                boxShadow: 3
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
}
