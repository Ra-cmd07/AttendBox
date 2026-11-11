import { Box, Button, Paper, Typography, Badge, Chip } from '@mui/material';
import { MeetingRoom, ArrowBack } from '@mui/icons-material';

interface Room {
  id: number;
  floor_id: number;
  room_name: string;
  room_number: number;
  esp32_ip: string;
  floor_name: string;
  building_name: string;
  zoom_level: number;
}

interface RoomGridProps {
  rooms: Room[];
  floorName: string;
  buildingName: string;
  studentCounts: Map<number, number>; // roomId -> student count
  onSelectRoom: (room: Room) => void;
  onBack: () => void;
}

export default function RoomGrid({
  rooms,
  floorName,
  buildingName,
  studentCounts,
  onSelectRoom,
  onBack,
}: RoomGridProps) {
  return (
    <Paper
      elevation={6}
      sx={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 1000,
        p: 3,
        bgcolor: 'rgba(255,255,255,0.98)',
        backdropFilter: 'blur(10px)',
        borderRadius: 3,
        minWidth: 400,
        maxWidth: 600,
      }}
    >
      {/* Header */}
      <Box mb={3}>
        <Typography variant="caption" color="#999" display="block">
          {buildingName}
        </Typography>
        <Box display="flex" alignItems="center" gap={1.5} mt={0.5}>
          <MeetingRoom sx={{ fontSize: 28, color: '#3b82f6' }} />
          <Typography variant="h6" fontWeight={700} color="#1a1a1a">
            {floorName}
          </Typography>
        </Box>
        <Typography variant="caption" color="#666" display="block" mt={0.5}>
          Select a room to view floor plan
        </Typography>
      </Box>

      {/* Room Grid */}
      <Box
        display="grid"
        gridTemplateColumns="repeat(auto-fit, minmax(160px, 1fr))"
        gap={2}
      >
        {rooms
          .sort((a, b) => a.room_number - b.room_number)
          .map((room) => {
            const studentCount = studentCounts.get(room.id) || 0;
            const isActive = room.esp32_ip !== '0.0.0.0';

            return (
              <Badge
                key={room.id}
                badgeContent={isActive && studentCount > 0 ? studentCount : null}
                color="primary"
                overlap="rectangular"
                sx={{
                  '& .MuiBadge-badge': {
                    top: 12,
                    right: 12,
                    fontSize: '0.9rem',
                    fontWeight: 700,
                    minWidth: 24,
                    height: 24,
                  },
                }}
              >
                <Button
                  variant="outlined"
                  fullWidth
                  onClick={() => onSelectRoom(room)}
                  disabled={!isActive}
                  sx={{
                    height: 120,
                    flexDirection: 'column',
                    gap: 1,
                    borderRadius: 2,
                    borderWidth: 2,
                    borderColor: isActive ? '#e0e0e0' : '#f5f5f5',
                    bgcolor: isActive ? 'white' : '#fafafa',
                    color: isActive ? '#1a1a1a' : '#bbb',
                    textTransform: 'none',
                    transition: 'all 0.2s',
                    opacity: isActive ? 1 : 0.5,
                    '&:hover': isActive
                      ? {
                          borderColor: '#3b82f6',
                          bgcolor: '#f0f7ff',
                          transform: 'scale(1.05)',
                        }
                      : {},
                    '&:disabled': {
                      borderColor: '#f5f5f5',
                    },
                  }}
                >
                  <MeetingRoom
                    sx={{
                      fontSize: 36,
                      color: isActive ? '#3b82f6' : '#ccc',
                    }}
                  />
                  <Typography variant="h6" fontWeight={700}>
                    {room.room_name}
                  </Typography>
                  {!isActive && (
                    <Chip
                      label="Not Active"
                      size="small"
                      sx={{
                        fontSize: '0.65rem',
                        height: 20,
                        bgcolor: '#f5f5f5',
                        color: '#999',
                      }}
                    />
                  )}
                </Button>
              </Badge>
            );
          })}
      </Box>

      {/* Back Button */}
      <Button
        fullWidth
        variant="text"
        startIcon={<ArrowBack />}
        onClick={onBack}
        sx={{
          mt: 3,
          color: '#666',
          textTransform: 'none',
          '&:hover': {
            bgcolor: '#f5f5f5',
          },
        }}
      >
        Back to Floor Selection
      </Button>
    </Paper>
  );
}
