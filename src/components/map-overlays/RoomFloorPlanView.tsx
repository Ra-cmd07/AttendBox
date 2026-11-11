import { Box, Paper, Typography, IconButton, Chip, Avatar, Tooltip, Fade, Zoom } from '@mui/material';
import { ArrowBack, Close, Person } from '@mui/icons-material';
import { useState, useEffect } from 'react';

interface Student {
  id: number;
  student_name: string;
  grade: string;
  section: string;
  distance?: number; // Distance from anchor in meters
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  last_updated?: string;
}

interface RoomFloorPlanViewProps {
  roomName: string;
  floorName: string;
  buildingName: string;
  floorPlanUrl: string | null;
  students: Student[];
  roomBounds: any;
  onBack: () => void;
  onClose: () => void;
}

// Predefined armchair positions (20 desks in classroom layout)
// Positions are in percentage (x, y) relative to floor plan image
const DESK_POSITIONS = [
  // Row 1 (back)
  { x: 20, y: 30 }, { x: 35, y: 30 }, { x: 50, y: 30 }, { x: 65, y: 30 }, { x: 80, y: 30 },
  // Row 2
  { x: 20, y: 45 }, { x: 35, y: 45 }, { x: 50, y: 45 }, { x: 65, y: 45 }, { x: 80, y: 45 },
  // Row 3
  { x: 20, y: 60 }, { x: 35, y: 60 }, { x: 50, y: 60 }, { x: 65, y: 60 }, { x: 80, y: 60 },
  // Row 4 (front)
  { x: 20, y: 75 }, { x: 35, y: 75 }, { x: 50, y: 75 }, { x: 65, y: 75 }, { x: 80, y: 75 },
];

export default function RoomFloorPlanView({
  roomName,
  floorName,
  buildingName,
  floorPlanUrl,
  students,
  roomBounds,
  onBack,
  onClose,
}: RoomFloorPlanViewProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [previousStudentIds, setPreviousStudentIds] = useState<Set<number>>(new Set());
  const [previousStudents, setPreviousStudents] = useState<Student[]>([]);
  const [recentlyAdded, setRecentlyAdded] = useState<Set<number>>(new Set());
  const [recentlyRemoved, setRecentlyRemoved] = useState<Set<number>>(new Set());
  const [exitedStudentNames, setExitedStudentNames] = useState<string[]>([]);

  console.log('🖼️ RoomFloorPlanView rendering:', { 
    roomName, 
    floorPlanUrl, 
    studentsCount: students.length 
  });
  
  // Detect student changes (enter/exit)
  useEffect(() => {
    const currentIds = new Set(students.map(s => s.id));
    
    // Find newly added students
    const added = new Set<number>();
    currentIds.forEach(id => {
      if (!previousStudentIds.has(id)) {
        added.add(id);
        console.log('✅ Student entered:', students.find(s => s.id === id)?.student_name);
      }
    });
    
    // Find removed students
    const removed = new Set<number>();
    const removedNames: string[] = [];
    previousStudentIds.forEach(id => {
      if (!currentIds.has(id)) {
        removed.add(id);
        const studentName = previousStudents.find(s => s.id === id)?.student_name || 'Unknown';
        removedNames.push(studentName);
        console.log('❌ Student left:', studentName);
      }
    });
    
    if (added.size > 0) {
      setRecentlyAdded(added);
      // Clear the "recently added" highlight after 2 seconds
      setTimeout(() => setRecentlyAdded(new Set()), 2000);
    }
    
    if (removed.size > 0) {
      setRecentlyRemoved(removed);
      setExitedStudentNames(removedNames);
      // Clear the notification after 3 seconds
      setTimeout(() => {
        setRecentlyRemoved(new Set());
        setExitedStudentNames([]);
      }, 3000);
    }
    
    setPreviousStudentIds(currentIds);
    setPreviousStudents([...students]); // Save current students for next comparison
  }, [students]);

  // Get color by grade
  const getGradeColor = (grade: string) => {
    const gradeNum = parseInt(grade.replace(/\D/g, ''));
    const colors = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899'];
    return colors[gradeNum % colors.length] || '#3b82f6';
  };

  return (
    <Paper
      elevation={6}
      sx={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 1000,
        bgcolor: 'rgba(255,255,255,0.98)',
        backdropFilter: 'blur(10px)',
        borderRadius: 3,
        overflow: 'hidden',
        maxWidth: '90vw',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <Box
        display="flex"
        alignItems="center"
        gap={2}
        px={3}
        py={2}
        borderBottom="1px solid #e0e0e0"
      >
        <IconButton size="small" onClick={onBack} sx={{ color: '#666' }}>
          <ArrowBack />
        </IconButton>

        <Box flex={1}>
          <Typography variant="caption" color="#999" display="block">
            {buildingName} › {floorName}
          </Typography>
          <Typography variant="h6" fontWeight={700} color="#1a1a1a">
            {roomName}
          </Typography>
        </Box>

        <Chip
          icon={<Person sx={{ fontSize: 16 }} />}
          label={`${students.length} student${students.length !== 1 ? 's' : ''}`}
          size="small"
          sx={{
            bgcolor: students.length > 0 ? '#e3f2fd' : '#f5f5f5',
            color: students.length > 0 ? '#3b82f6' : '#999',
            fontWeight: 600,
            transition: 'all 0.3s',
          }}
        />

        <IconButton size="small" onClick={onClose} sx={{ color: '#666' }}>
          <Close />
        </IconButton>
      </Box>

      {/* Real-time Update Notifications */}
      {/* Entry Notification - Green */}
      <Fade in={recentlyAdded.size > 0} timeout={300}>
        <Box
          sx={{
            position: 'absolute',
            top: 80,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1100,
            bgcolor: '#4caf50',
            color: 'white',
            px: 3,
            py: 1.5,
            borderRadius: 2,
            boxShadow: '0 4px 12px rgba(76, 175, 80, 0.4)',
            display: recentlyAdded.size > 0 ? 'flex' : 'none',
            alignItems: 'center',
            gap: 1,
          }}
        >
          <Typography variant="body2" fontWeight={600}>
            ✓ {Array.from(recentlyAdded).map(id => 
              students.find(s => s.id === id)?.student_name
            ).filter(Boolean).join(', ')} entered the room
          </Typography>
        </Box>
      </Fade>

      {/* Exit Notification - Red */}
      <Fade in={recentlyRemoved.size > 0} timeout={300}>
        <Box
          sx={{
            position: 'absolute',
            top: 80,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1100,
            bgcolor: '#f44336',
            color: 'white',
            px: 3,
            py: 1.5,
            borderRadius: 2,
            boxShadow: '0 4px 12px rgba(244, 67, 54, 0.4)',
            display: recentlyRemoved.size > 0 ? 'flex' : 'none',
            alignItems: 'center',
            gap: 1,
          }}
        >
          <Typography variant="body2" fontWeight={600}>
            ✕ {exitedStudentNames.join(', ')} left the room
          </Typography>
        </Box>
      </Fade>

      {/* Floor Plan Content */}
      <Box
        sx={{
          position: 'relative',
          flex: 1,
          overflow: 'auto',
          bgcolor: '#f5f5f5',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: 3,
        }}
      >
        {/* Distance Threshold Indicator */}
        <Box
          sx={{
            position: 'absolute',
            top: 16,
            right: 16,
            zIndex: 10,
            bgcolor: 'rgba(255,255,255,0.95)',
            px: 2,
            py: 1,
            borderRadius: 1,
            border: '1px solid #e0e0e0',
            display: 'flex',
            alignItems: 'center',
            gap: 1,
          }}
        >
          <Box
            sx={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              bgcolor: '#4caf50',
            }}
          />
          <Typography variant="caption" color="#666">
            Within 3m range
          </Typography>
        </Box>
        
        {floorPlanUrl ? (
          <Box
            sx={{
              position: 'relative',
              maxWidth: '100%',
              maxHeight: '100%',
              display: imageLoaded ? 'block' : 'none',
            }}
          >
            {/* Floor Plan Image */}
            <img
              src={floorPlanUrl}
              alt="Floor Plan"
              onLoad={() => setImageLoaded(true)}
              style={{
                width: '100%',
                height: 'auto',
                display: 'block',
                borderRadius: 8,
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              }}
            />

            {/* Student Pins Overlay */}
            {imageLoaded && students.map((student, index) => {
              // Assign desk position (cycle through available desks)
              const deskIndex = index % DESK_POSITIONS.length;
              const position = DESK_POSITIONS[deskIndex];
              const color = getGradeColor(student.grade);
              const isNewlyAdded = recentlyAdded.has(student.id);

              return (
                <Zoom 
                  key={student.id} 
                  in={true} 
                  timeout={500}
                  style={{ transitionDelay: isNewlyAdded ? '0ms' : `${index * 100}ms` }}
                >
                  <Box
                    sx={{
                      position: 'absolute',
                      left: `${position.x}%`,
                      top: `${position.y}%`,
                      transform: 'translate(-50%, -50%)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 0.5,
                    }}
                  >
                    <Tooltip
                      title={
                        <Box>
                          <Typography variant="body2" fontWeight={700}>
                            {student.student_name}
                          </Typography>
                          <Typography variant="caption" display="block">
                            {student.grade} - {student.section}
                          </Typography>
                          {student.distance && (
                            <Typography variant="caption" display="block" sx={{ color: '#e3f2fd' }}>
                              📍 {student.distance.toFixed(1)}m from anchor
                            </Typography>
                          )}
                          {isNewlyAdded && (
                            <Typography variant="caption" display="block" sx={{ color: '#4caf50', fontWeight: 600 }}>
                              ✓ Just entered
                            </Typography>
                          )}
                        </Box>
                      }
                      arrow
                    >
                      <Avatar
                        sx={{
                          width: 36,
                          height: 36,
                          bgcolor: color,
                          border: isNewlyAdded ? '4px solid #4caf50' : '3px solid white',
                          boxShadow: isNewlyAdded 
                            ? '0 0 20px rgba(76, 175, 80, 0.8), 0 2px 8px rgba(0,0,0,0.2)' 
                            : '0 2px 8px rgba(0,0,0,0.2)',
                          cursor: 'pointer',
                          fontSize: '0.9rem',
                          fontWeight: 700,
                          transition: 'all 0.3s ease',
                          animation: isNewlyAdded ? 'pulse 1s ease-in-out 2' : 'none',
                          '@keyframes pulse': {
                            '0%, 100%': {
                              transform: 'scale(1)',
                            },
                            '50%': {
                              transform: 'scale(1.15)',
                            },
                          },
                          '&:hover': {
                            transform: 'scale(1.2)',
                            zIndex: 10,
                          },
                        }}
                      >
                        {student.student_name.charAt(0)}
                      </Avatar>
                    </Tooltip>

                    {/* Distance Badge - Always visible below avatar */}
                    {student.distance && (
                      <Chip
                        label={`${student.distance.toFixed(1)}m`}
                        size="small"
                        sx={{
                          height: 20,
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          bgcolor: 'white',
                          color: '#4caf50',
                          border: '1px solid #4caf50',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                          '& .MuiChip-label': {
                            px: 1,
                          },
                        }}
                      />
                    )}

                    {/* Student Name Label */}
                    <Typography
                      variant="caption"
                      sx={{
                        bgcolor: 'rgba(0,0,0,0.75)',
                        color: 'white',
                        px: 1,
                        py: 0.25,
                        borderRadius: 1,
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {student.student_name}
                    </Typography>
                  </Box>
                </Zoom>
              );
            })}
          </Box>
        ) : (
          <Box textAlign="center" p={4}>
            <Typography variant="body1" color="#666" mb={1}>
              ⚠️ No floor plan image available
            </Typography>
            <Typography variant="caption" color="#999">
              Upload a floor plan for {roomName} to see student positions
            </Typography>
          </Box>
        )}

        {/* Loading Indicator */}
        {floorPlanUrl && !imageLoaded && (
          <Box textAlign="center" p={4}>
            <Typography variant="body2" color="#999">
              Loading floor plan...
            </Typography>
          </Box>
        )}
      </Box>

      {/* Student List (if no floor plan) */}
      {!floorPlanUrl && students.length > 0 && (
        <Box p={3} borderTop="1px solid #e0e0e0">
          <Typography variant="subtitle2" fontWeight={700} mb={2}>
            Students in this room:
          </Typography>
          <Box display="flex" flexDirection="column" gap={1}>
            {students.map((student) => {
              const color = getGradeColor(student.grade);
              return (
                <Box
                  key={student.id}
                  display="flex"
                  alignItems="center"
                  gap={1.5}
                  p={1.5}
                  bgcolor="#f9f9f9"
                  borderRadius={1}
                >
                  <Avatar sx={{ width: 32, height: 32, bgcolor: color, fontSize: '0.85rem' }}>
                    {student.student_name.charAt(0)}
                  </Avatar>
                  <Box flex={1}>
                    <Typography variant="body2" fontWeight={600}>
                      {student.student_name}
                    </Typography>
                    <Typography variant="caption" color="#666">
                      {student.grade} - {student.section} • ID: {student.student_id_number}
                    </Typography>
                  </Box>
                </Box>
              );
            })}
          </Box>
        </Box>
      )}
    </Paper>
  );
}
