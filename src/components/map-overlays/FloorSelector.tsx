import { Box, Button, Paper, Typography } from '@mui/material';
import { Layers } from '@mui/icons-material';

interface Floor {
  id: number;
  building_id: number;
  floor_number: number;
  floor_name: string;
  building_name: string;
  zoom_level: number;
}

interface FloorSelectorProps {
  floors: Floor[];
  buildingName: string;
  onSelectFloor: (floor: Floor) => void;
  onClose: () => void;
}

export default function FloorSelector({
  floors,
  buildingName,
  onSelectFloor,
  onClose,
}: FloorSelectorProps) {
  console.log('🏗️ FloorSelector rendering:', { floors, buildingName });
  
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
        minWidth: 350,
        maxWidth: 500,
      }}
    >
      {/* Header */}
      <Box display="flex" alignItems="center" gap={1.5} mb={3}>
        <Layers sx={{ fontSize: 32, color: '#3b82f6' }} />
        <Box>
          <Typography variant="h6" fontWeight={700} color="#1a1a1a">
            {buildingName}
          </Typography>
          <Typography variant="caption" color="#666">
            Select a floor to view rooms
          </Typography>
        </Box>
      </Box>

      {/* Floor Buttons */}
      <Box display="flex" flexDirection="column" gap={2}>
        {floors
          .sort((a, b) => b.floor_number - a.floor_number) // Descending order
          .map((floor) => (
            <Button
              key={floor.id}
              variant="outlined"
              size="large"
              onClick={() => onSelectFloor(floor)}
              sx={{
                justifyContent: 'flex-start',
                py: 2,
                px: 3,
                borderRadius: 2,
                borderWidth: 2,
                borderColor: '#e0e0e0',
                bgcolor: 'white',
                color: '#1a1a1a',
                textTransform: 'none',
                fontSize: '1.1rem',
                fontWeight: 600,
                transition: 'all 0.2s',
                '&:hover': {
                  borderColor: '#3b82f6',
                  bgcolor: '#f0f7ff',
                  transform: 'translateX(8px)',
                },
              }}
            >
              <Box display="flex" alignItems="center" gap={2} width="100%">
                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    borderRadius: 2,
                    bgcolor: '#3b82f6',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '1.2rem',
                  }}
                >
                  {floor.floor_number}
                </Box>
                <Typography variant="body1" fontWeight={600}>
                  {floor.floor_name}
                </Typography>
              </Box>
            </Button>
          ))}
      </Box>

      {/* Close Button */}
      <Button
        fullWidth
        variant="text"
        onClick={onClose}
        sx={{
          mt: 2,
          color: '#666',
          textTransform: 'none',
          '&:hover': {
            bgcolor: '#f5f5f5',
          },
        }}
      >
        ← Back to Map
      </Button>
    </Paper>
  );
}
