import { useEffect, useState, useRef, useCallback } from 'react';
import { Box, Paper, Typography, Chip, CircularProgress, Button } from '@mui/material';
import { LocationOn, RadioButtonChecked, SignalWifi4Bar } from '@mui/icons-material';
import api from '../api/client';
import theme from '../theme/professionalTheme';
import { getApiBaseUrl } from '../utils/apiUrl';

// Import floor plan overlay components
import FloorSelector from './map-overlays/FloorSelector';
import RoomGrid from './map-overlays/RoomGrid';
import RoomFloorPlanView from './map-overlays/RoomFloorPlanView';

interface AnchorInfo {
  id: number;
  lat: number;
  lng: number;
  distance: number;
  raw_distance: number;
  rssi: number;
}

interface BLEPosition {
  target_id: number;  // NEW: Student identifier
  target_name: string;  // NEW: Student name
  target_color: string;  // NEW: Display color
  lat: number;
  lng: number;
  accuracy_m: number;
  speed_mps: number;
  heading_deg: number | null;
  raw_residual_m: number;
  anchors_used: number;
  anchors: AnchorInfo[];
  zone_id: string | null;
  zone_name: string | null;
  in_zone: boolean;
  snapped: boolean;
  snap_distance_m: number | null;
  warming_up: boolean;
  timestamp: number;
  coasting?: boolean;
}

interface Building {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  bounds_north: number;
  bounds_south: number;
  bounds_east: number;
  bounds_west: number;
  min_zoom: number;
}

interface Floor {
  id: number;
  building_id: number;
  floor_number: number;
  floor_name: string;
  building_name: string;
  zoom_level: number;
}

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

interface RoomStudent {
  id: number;
  student_name: string;
  student_id_number: string;
  grade: string;
  section: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  last_updated: string;
}

interface BLEPositioningMapProps {
  trilaterationServerUrl?: string;
  studentName?: string;
  showDiagnostics?: boolean;
  filterStudentName?: string;  // NEW: Filter to show only specific student
}

export default function BLEPositioningMap({
  trilaterationServerUrl = 'http://localhost:8080',
  studentName,
  showDiagnostics = false,
  filterStudentName,  // NEW: If provided, only show this student
}: BLEPositioningMapProps) {
  const [connected, setConnected] = useState(false);
  const [positions, setPositions] = useState<BLEPosition[]>([]);  // Changed to array
  const [waiting, setWaiting] = useState<{ active_anchors: number; needed: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [diagnosticsMinimized, setDiagnosticsMinimized] = useState(false);  // NEW: State for collapsible panel
  const wsRef = useRef<WebSocket | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Floor plan system state
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null);
  const [floors, setFloors] = useState<Floor[]>([]);
  const [selectedFloor, setSelectedFloor] = useState<Floor | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [roomStudents, setRoomStudents] = useState<RoomStudent[]>([]);
  const [studentCounts, setStudentCounts] = useState<Map<number, number>>(new Map());
  const [floorPlanUrl, setFloorPlanUrl] = useState<string | null>(null);

  // Helper function to get API URL
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log('[BLE Map] Already connected');
      return;
    }

    try {
      const wsUrl = trilaterationServerUrl.replace(/^http/, 'ws') + '/ws';
      console.log('[BLE Map] Connecting to:', wsUrl);
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[BLE Map] ✅ Connected to trilateration server');
        setConnected(true);
        setError(null);
        
        // Clear any pending reconnect
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          // Reduced logging - only log type, not full data
          // console.log('[BLE Map] 📍 Received:', data.type);

          if (data.type === 'positions') {
            // Multi-beacon mode: array of positions
            let students = data.students || [];
            
            // Filter to show only specific student if filterStudentName is provided
            if (filterStudentName) {
              students = students.filter((s: BLEPosition) => s.target_name === filterStudentName);
            }
            
            setPositions(students);
            setWaiting(null);
            
            // Update iframe map if available - send filtered students
            if (iframeRef.current?.contentWindow) {
              iframeRef.current.contentWindow.postMessage(
                { type: 'update-positions', students: students },  // Send filtered list
                trilaterationServerUrl
              );
            }
          } else if (data.type === 'position') {
            // Single beacon mode (backward compatibility)
            setPositions([data]);
            setWaiting(null);
            
            if (iframeRef.current?.contentWindow) {
              iframeRef.current.contentWindow.postMessage(
                { type: 'update-position', position: data },
                trilaterationServerUrl
              );
            }
          } else if (data.type === 'waiting') {
            setWaiting({
              active_anchors: data.active_anchors,
              needed: data.needed,
            });
          }
        } catch (err) {
          console.error('[BLE Map] Failed to parse message:', err);
        }
      };

      ws.onerror = (err) => {
        console.error('[BLE Map] ❌ WebSocket error:', err);
        setError('Connection error');
      };

      ws.onclose = () => {
        console.log('[BLE Map] 🔌 Disconnected from trilateration server');
        setConnected(false);
        wsRef.current = null;

        // Attempt to reconnect after 3 seconds
        if (!reconnectTimeoutRef.current) {
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log('[BLE Map] 🔄 Attempting to reconnect...');
            reconnectTimeoutRef.current = null;
            connect();
          }, 3000);
        }
      };
    } catch (err) {
      console.error('[BLE Map] Failed to connect:', err);
      setError('Failed to connect to trilateration server');
    }
  }, [trilaterationServerUrl]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  // Listen for marker clicks from iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      console.log('📨 Message received in React:', event.data);
      
      // Handle student marker click
      if (event.data && event.data.type === 'student-marker-clicked') {
        console.log('🎯 Student marker clicked!', event.data);
        console.log('🏢 Buildings available:', buildings.length);
        
        // Auto-select Library building when student dot is clicked
        if (buildings.length > 0) {
          const library = buildings.find(b => b.name === 'Library');
          console.log('🔍 Library building found:', library);
          if (library) {
            console.log('✅ Setting selected building to Library');
            setSelectedBuilding(library);
          } else {
            console.log('❌ Library building not found in buildings list');
          }
        } else {
          console.log('⚠️ No buildings loaded yet!');
        }
      }
      
      // Handle building marker (anchor) click
      if (event.data && event.data.type === 'building-marker-clicked') {
        console.log('🏢 Building marker (Anchor) clicked!', event.data);
        console.log('🏢 Buildings available:', buildings.length);
        
        // Auto-select Library building when green anchor marker is clicked
        if (buildings.length > 0) {
          const library = buildings.find(b => b.name === event.data.buildingName || b.name === 'Library');
          console.log('🔍 Library building found:', library);
          if (library) {
            console.log('✅ Setting selected building to Library');
            setSelectedBuilding(library);
            
            // TODO: Add map zoom to anchor location
            // Send zoom command to iframe
            if (iframeRef.current?.contentWindow) {
              iframeRef.current.contentWindow.postMessage({
                type: 'zoom-to-location',
                lat: event.data.lat,
                lng: event.data.lng,
                zoom: 20
              }, '*');
            }
          } else {
            console.log('❌ Library building not found in buildings list');
          }
        } else {
          console.log('⚠️ No buildings loaded yet!');
        }
      }
    };

    console.log('👂 Message listener registered');
    window.addEventListener('message', handleMessage);
    
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [buildings]);

  // Fetch buildings on mount
  useEffect(() => {
    const fetchBuildings = async () => {
      try {
        console.log('🔗 Fetching buildings...');
        const response = await api.get('/buildings');
        console.log('🏢 Buildings loaded:', response.data);
        setBuildings(response.data);
      } catch (error) {
        console.error('❌ Failed to fetch buildings:', error);
      }
    };
    fetchBuildings();
  }, []);

  // Fetch floors when building is selected
  useEffect(() => {
    if (!selectedBuilding) return;

    console.log('🏢 Building selected:', selectedBuilding);

    const fetchFloors = async () => {
      try {
        console.log(`📡 Fetching floors for building ${selectedBuilding.id}...`);
        const response = await api.get(`/buildings/${selectedBuilding.id}/floors`);
        console.log('🏗️ Floors fetched:', response.data);
        setFloors(response.data);
      } catch (error) {
        console.error('❌ Failed to fetch floors:', error);
      }
    };
    fetchFloors();
  }, [selectedBuilding]);

  // Fetch rooms when floor is selected
  useEffect(() => {
    if (!selectedFloor) return;

    const fetchRooms = async () => {
      try {
        const response = await api.get(`/buildings/floors/${selectedFloor.id}/rooms`);
        setRooms(response.data);

        // Fetch student counts for each room
        const counts = new Map<number, number>();
        for (const room of response.data) {
          try {
            const studentsRes = await api.get(`/buildings/rooms/${room.id}/students`);
            counts.set(room.id, studentsRes.data.length);
          } catch (err) {
            counts.set(room.id, 0);
          }
        }
        setStudentCounts(counts);
      } catch (error) {
        console.error('Failed to fetch rooms:', error);
      }
    };
    fetchRooms();
  }, [selectedFloor]);

  // Fetch students and floor plan when room is selected
  useEffect(() => {
    if (!selectedRoom) return;

    console.log('🏠 Room selected:', selectedRoom);

    const fetchRoomData = async () => {
      try {
        console.log(`📡 Fetching data for Room ${selectedRoom.id}...`);
        
        const floorPlanRes = await api.get(`/buildings/rooms/${selectedRoom.id}/floor-plan`);

        console.log('🗺️ Floor plan response:', floorPlanRes.data);
        
        // Filter students from the current positions (WebSocket data) that match this room's ESP32
        // positions contains students currently tracked on the main map
        const roomESP32 = selectedRoom.esp32_ip;
        console.log('🔍 Filtering students for ESP32:', roomESP32);
        console.log('📊 Current positions from WebSocket:', positions);
        console.log('📊 Positions count:', positions.length);
        
        // Distance threshold for classroom presence (in meters)
        const CLASSROOM_DISTANCE_THRESHOLD = 3.0; // 3 meters - students beyond this are considered "outside" (exited)
        
        // Map positions to student format expected by floor plan
        const filteredStudents = positions
          .filter(pos => {
            // Find nearest anchor
            if (!pos.anchors || pos.anchors.length === 0) {
              console.log(`⚠️ ${pos.target_name} has no anchor data - skipping`);
              return false;
            }
            
            const nearestAnchor = pos.anchors.reduce((nearest, anchor) => 
              anchor.distance < nearest.distance ? anchor : nearest
            );
            
            const nearestDistance = nearestAnchor.distance;
            const nearestAnchorId = nearestAnchor.id;
            
            // Map anchor IDs to building names
            const anchorBuildingMap: {[key: number]: string} = {
              1: 'Classroom',
              2: 'Cafeteria',
              3: 'Library'
            };
            
            const studentBuilding = anchorBuildingMap[nearestAnchorId] || 'Unknown';
            
            console.log('🎯 Checking position:', {
              name: pos.target_name,
              nearestAnchor: nearestAnchorId,
              nearestAnchorDistance: nearestDistance.toFixed(2),
              studentBuilding: studentBuilding,
              selectedRoom: selectedRoom.name,
              id: pos.target_id
            });
            
            // CRITICAL FIX: Only show students whose nearest anchor matches the current room's building
            // For now, since we only have "Library" in database, show students near Anchor 3 (Library)
            // TODO: When Classroom and Cafeteria are added to database, update this logic
            const isCorrectBuilding = nearestAnchorId === 3; // Only show students near Library anchor (ID 3)
            
            if (!isCorrectBuilding) {
              console.log(`🚫 ${pos.target_name} is nearest to ${studentBuilding} (not Library) - removed from this room`);
              return false;
            }
            
            // Distance threshold for classroom presence (in meters)
            const CLASSROOM_DISTANCE_THRESHOLD = 3.0;
            const isInRange = nearestDistance <= CLASSROOM_DISTANCE_THRESHOLD;
            
            if (!isInRange) {
              console.log(`🚪 ${pos.target_name} is OUT OF RANGE (${nearestDistance.toFixed(1)}m > ${CLASSROOM_DISTANCE_THRESHOLD}m)`);
              return false;
            }
            
            console.log(`✅ ${pos.target_name} is IN LIBRARY RANGE (${nearestDistance.toFixed(1)}m from Anchor 3)`);
            return true;
          })
          .map(pos => {
            const nearestDistance = pos.anchors && pos.anchors.length > 0
              ? Math.min(...pos.anchors.map(a => a.distance))
              : pos.accuracy_m;
            
            return {
              id: pos.target_id,
              student_name: pos.target_name,
              grade: pos.grade || '10', // Default grade if not provided
              section: pos.section || 'A',
              distance: nearestDistance, // Use nearest anchor distance for display
            };
          });
        
        console.log('✅ Filtered students for floor plan (within 3m):', filteredStudents);
        console.log('📈 Will show', filteredStudents.length, 'students on floor plan');
        setRoomStudents(filteredStudents);
        
        if (floorPlanRes.data.floor_plan?.image_url) {
          const baseUrl = getApiBaseUrl().replace(/\/api\/?$/, '');
          const imageUrl = `${baseUrl}${floorPlanRes.data.floor_plan.image_url}`;
          console.log('🖼️ Floor plan URL:', imageUrl);
          setFloorPlanUrl(imageUrl);
        } else {
          console.log('⚠️ No floor plan in response');
          setFloorPlanUrl(null);
        }
      } catch (error) {
        console.error('❌ Failed to fetch room data:', error);
        setFloorPlanUrl(null);
      }
    };
    fetchRoomData();
  }, [selectedRoom, positions]); // Add positions as dependency so it updates when students move

  // Handler functions
  const handleOpenFloorPlan = () => {
    // Auto-select Library building
    const library = buildings.find(b => b.name === 'Library');
    if (library) {
      setSelectedBuilding(library);
    }
  };

  const handleSelectFloor = (floor: Floor) => {
    setSelectedFloor(floor);
  };

  const handleSelectRoom = (room: Room) => {
    setSelectedRoom(room);
  };

  const handleBackToFloors = () => {
    setSelectedFloor(null);
    setRooms([]);
  };

  const handleBackToRooms = () => {
    setSelectedRoom(null);
    setRoomStudents([]);
    setFloorPlanUrl(null);
  };

  const handleCloseOverlays = () => {
    setSelectedBuilding(null);
    setSelectedFloor(null);
    setSelectedRoom(null);
    setFloors([]);
    setRooms([]);
    setRoomStudents([]);
    setFloorPlanUrl(null);
  };

  // NEW: Manual trigger to open Library floors
  const handleQuickAccessLibrary = () => {
    const library = buildings.find(b => b.name === 'Library');
    if (library) {
      setSelectedBuilding(library);
    } else {
      console.warn('Library building not found in buildings array:', buildings);
    }
  };

  return (
    <Box sx={{ position: 'relative', width: '100%', height: '100%', minHeight: 500, bgcolor: 'transparent' }}>
      {/* Embedded map from trilateration server */}
      <iframe
        ref={iframeRef}
        src={`${trilaterationServerUrl}${filterStudentName ? `?filter=${encodeURIComponent(filterStudentName)}` : ''}`}
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          borderRadius: theme.borderRadius.base,
          pointerEvents: (selectedBuilding || selectedFloor || selectedRoom) ? 'none' : 'auto',
        }}
        title="BLE Positioning Map"
      />

      {/* Connection Status Overlay */}
      <Paper
        elevation={3}
        sx={{
          position: 'absolute',
          top: 16,
          left: 16,
          p: 1.5,
          bgcolor: 'rgba(255,255,255,0.98)',
          backdropFilter: 'blur(10px)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          borderRadius: theme.borderRadius.base,
        }}
      >
        <Box
          sx={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            bgcolor: connected ? theme.colors.status.success.main : theme.colors.status.error.main,
            animation: connected ? 'pulse 2s infinite' : 'none',
            '@keyframes pulse': {
              '0%, 100%': { opacity: 1 },
              '50%': { opacity: 0.5 },
            },
          }}
        />
        <Typography 
          variant="caption" 
          fontWeight={theme.typography.fontWeight.semibold}
          sx={{ fontFamily: theme.typography.fontFamily.primary }}
        >
          {connected ? '🟢 Connected' : '🔴 Disconnected'}
        </Typography>
        {error && (
          <Chip
            label={error}
            size="small"
            color="error"
            sx={{ fontSize: '0.65rem' }}
          />
        )}
      </Paper>

      {/* Student Name Badge */}
      {studentName && (
        <Paper
          elevation={3}
          sx={{
            position: 'absolute',
            top: 16,
            right: 16,
            p: 1.5,
            bgcolor: 'rgba(255,255,255,0.98)',
            backdropFilter: 'blur(10px)',
            zIndex: 1000,
            borderRadius: theme.borderRadius.base,
          }}
        >
          <Box display="flex" alignItems="center" gap={1}>
            <LocationOn sx={{ color: theme.colors.primary.main, fontSize: 18 }} />
            <Typography 
              variant="caption" 
              fontWeight={theme.typography.fontWeight.bold}
              sx={{ fontFamily: theme.typography.fontFamily.primary }}
            >
              {studentName}
            </Typography>
          </Box>
        </Paper>
      )}

      {/* Waiting for Signal Overlay */}
      {waiting && (
        <Paper
          elevation={3}
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            p: 4,
            bgcolor: 'rgba(255,255,255,0.98)',
            backdropFilter: 'blur(10px)',
            zIndex: 999,
            textAlign: 'center',
            minWidth: 300,
            borderRadius: theme.borderRadius.lg,
          }}
        >
          <CircularProgress sx={{ mb: 2, color: theme.colors.primary.main }} />
          <Typography 
            variant="h6" 
            fontWeight={theme.typography.fontWeight.bold}
            gutterBottom
            sx={{ fontFamily: theme.typography.fontFamily.display }}
          >
            Waiting for BLE Signal
          </Typography>
          <Typography 
            variant="body2" 
            color={theme.colors.neutral[600]}
            sx={{ fontFamily: theme.typography.fontFamily.primary }}
          >
            Active anchors: {waiting.active_anchors} / {waiting.needed} required
          </Typography>
          <Typography 
            variant="caption" 
            color={theme.colors.neutral[500]}
            sx={{ fontFamily: theme.typography.fontFamily.primary, display: 'block', mt: 1 }}
          >
            Position will appear when student's device is detected by at least {waiting.needed} beacons
          </Typography>
        </Paper>
      )}

      {/* Position Info Panel (Diagnostic Mode) */}
      {showDiagnostics && positions.length > 0 && (
        <Paper
          elevation={3}
          sx={{
            position: 'absolute',
            bottom: 16,
            left: 16,
            p: diagnosticsMinimized ? 1.5 : 2,
            bgcolor: 'rgba(255,255,255,0.98)',
            backdropFilter: 'blur(10px)',
            zIndex: 1000,
            minWidth: diagnosticsMinimized ? 'auto' : 250,
            maxWidth: diagnosticsMinimized ? 'auto' : 400,
            borderRadius: theme.borderRadius.base,
            transition: 'all 0.3s ease',
          }}
        >
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={diagnosticsMinimized ? 0 : 1}>
            <Typography 
              variant="subtitle2" 
              fontWeight={theme.typography.fontWeight.bold}
              sx={{ fontFamily: theme.typography.fontFamily.display }}
            >
              📍 Position Diagnostics
            </Typography>
            <Box
              component="button"
              onClick={() => setDiagnosticsMinimized(!diagnosticsMinimized)}
              sx={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '4px 8px',
                borderRadius: theme.borderRadius.sm,
                fontSize: '18px',
                color: theme.colors.neutral[600],
                transition: 'background 0.2s',
                '&:hover': {
                  bgcolor: theme.colors.neutral[100],
                },
              }}
              title={diagnosticsMinimized ? 'Expand' : 'Minimize'}
            >
              {diagnosticsMinimized ? '+' : '−'}
            </Box>
          </Box>

          {!diagnosticsMinimized && positions.map((position) => (
            <Box key={position.target_id} mb={2} pb={2} borderBottom={`1px solid ${theme.colors.neutral[200]}`}>
              <Box display="flex" alignItems="center" gap={1} mb={1}>
                <Box 
                  sx={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    bgcolor: position.target_color,
                  }}
                />
                <Typography variant="caption" fontWeight={theme.typography.fontWeight.bold}>
                  {position.target_name}
                </Typography>
              </Box>

              <Box display="flex" flexDirection="column" gap={0.5}>
                <Typography variant="caption" sx={{ fontFamily: theme.typography.fontFamily.primary }}>
                  <strong>Latitude:</strong> {position.lat.toFixed(7)}
                </Typography>
                <Typography variant="caption" sx={{ fontFamily: theme.typography.fontFamily.primary }}>
                  <strong>Longitude:</strong> {position.lng.toFixed(7)}
                </Typography>
                <Typography variant="caption" sx={{ fontFamily: theme.typography.fontFamily.primary }}>
                  <strong>Distance:</strong> {
                    position.anchors && position.anchors.length > 0
                      ? `${Math.min(...position.anchors.map(a => a.distance)).toFixed(1)}m (nearest anchor)`
                      : 'N/A'
                  }
                </Typography>
                <Typography variant="caption" sx={{ fontFamily: theme.typography.fontFamily.primary, color: '#666' }}>
                  <strong>Accuracy:</strong> ±{position.accuracy_m}m
                  {position.warming_up && ' (warming up...)'}
                </Typography>
                {position.speed_mps > 0.05 && (
                  <>
                    <Typography variant="caption" sx={{ fontFamily: theme.typography.fontFamily.primary }}>
                      <strong>Speed:</strong> {position.speed_mps.toFixed(2)} m/s
                    </Typography>
                    {position.heading_deg !== null && (
                      <Typography variant="caption" sx={{ fontFamily: theme.typography.fontFamily.primary }}>
                        <strong>Heading:</strong> {position.heading_deg.toFixed(1)}°
                      </Typography>
                    )}
                  </>
                )}
                <Typography variant="caption" sx={{ fontFamily: theme.typography.fontFamily.primary }}>
                  <strong>Anchors:</strong> {position.anchors_used} active
                </Typography>
                {position.coasting && (
                  <Chip
                    label="Coasting (no fresh fix)"
                    size="small"
                    color="warning"
                    sx={{ mt: 0.5, fontSize: '0.65rem' }}
                  />
                )}
              </Box>
            </Box>
          ))}
        </Paper>
      )}

      {/* Floor Selector Overlay */}
      {selectedBuilding && !selectedFloor && (
        <FloorSelector
          floors={floors}
          buildingName={selectedBuilding.name}
          onSelectFloor={handleSelectFloor}
          onClose={handleCloseOverlays}
        />
      )}

      {/* Room Grid Overlay */}
      {selectedFloor && !selectedRoom && (
        <RoomGrid
          rooms={rooms}
          floorName={selectedFloor.floor_name}
          buildingName={selectedFloor.building_name}
          studentCounts={studentCounts}
          onSelectRoom={handleSelectRoom}
          onBack={handleBackToFloors}
        />
      )}

      {/* Floor Plan View Overlay */}
      {(() => {
        console.log('🎨 Render check - selectedRoom:', !!selectedRoom, 'floorPlanUrl:', !!floorPlanUrl);
        return selectedRoom && floorPlanUrl ? (
          <RoomFloorPlanView
            roomName={selectedRoom.room_name}
            floorName={selectedRoom.floor_name}
            buildingName={selectedRoom.building_name}
            floorPlanUrl={floorPlanUrl}
            students={roomStudents}
            roomBounds={null}
            onBack={handleBackToRooms}
            onClose={handleCloseOverlays}
          />
        ) : null;
      })()}
    </Box>
  );
}

