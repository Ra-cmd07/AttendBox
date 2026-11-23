import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box, Typography, Button, CircularProgress, Alert, Fade, Slide, Divider,
  useMediaQuery, useTheme as useMuiTheme, IconButton, Tooltip, Badge,
} from '@mui/material';
import {
  QrCodeScanner, CreditCard, Bluetooth, CheckCircle,
  ErrorOutline, Wifi, SignalCellularAlt, CameraAlt, Lock, LockOpen, Settings, Assignment,
} from '@mui/icons-material';
import Webcam from 'react-webcam';
import jsQR from 'jsqr';
import { format } from 'date-fns';
import api from '../api/client';
import theme from '../theme/professionalTheme';
import { KioskPasswordDialog } from '../components/KioskPasswordDialog';
import { KioskSettingsDialog } from '../components/KioskSettingsDialog';
import { AttendanceActivityDialog } from '../components/AttendanceActivityDialog';

type ScanMethod = 'RFID' | 'QR' | 'BLE';
type ScanState  = 'idle' | 'scanning' | 'processing' | 'success' | 'error';

interface ScanResult {
  identifier:   string;
  student_name: string;
  status?:      string;
  session?:     string;
  photo_path?:  string;
  attendanceId?: number;
}

const KIOSK_ID = Number(import.meta.env.VITE_KIOSK_ID || 1);
const SCHOOL_NAME = import.meta.env.VITE_SCHOOL_NAME || 'Lapasan National High School';

// ─── Live Clock Component ────────────────────────────────────────────
function LiveClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <Box textAlign="center" sx={{ mb: 0.5 }}> {/* Minimal margin */}
      <Typography
        sx={{
          fontSize: { xs: '2rem', md: '2.5rem' }, // Even smaller
          fontFamily: theme.typography.fontFamily.display,
          fontWeight: theme.typography.fontWeight.light,
          color: '#fff',
          letterSpacing: '0.05em',
          lineHeight: 1,
          mb: 0.25, // Very small margin
        }}
      >
        {format(time, 'h:mm a').toUpperCase()}
      </Typography>
      <Typography
        sx={{
          fontSize: { xs: '0.7rem', md: '0.8rem' }, // Even smaller
          color: 'rgba(255,255,255,0.8)',
          fontFamily: theme.typography.fontFamily.primary,
          fontWeight: theme.typography.fontWeight.normal,
        }}
      >
        {format(time, 'EEEE, MMMM d, yyyy')}
      </Typography>
    </Box>
  );
}

// ─── Main Kiosk Page ─────────────────────────────────────────────────
export default function KioskPage() {
  const muiTheme = useMuiTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down('md')); // Below 900px = mobile
  
  const webcamRef       = useRef<Webcam>(null);
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rfidPollingRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const rfidBufferRef   = useRef('');
  const rfidTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastProcessedAttendanceRef = useRef<number | null>(null);

  const [method,      setMethod]      = useState<ScanMethod>('RFID');
  const [scanState,   setScanState]   = useState<ScanState>('idle');
  const [identifier,  setIdentifier]  = useState('');
  const [capturedB64, setCapturedB64] = useState<string | null>(null);
  const [result,      setResult]      = useState<ScanResult | null>(null);
  const [errorMsg,    setErrorMsg]    = useState('');
  const [countdown,   setCountdown]   = useState(0);
  const [kioskInfo,   setKioskInfo]   = useState({ name: 'Main Entrance', gate: 'Gate 1' });
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);

  // ── Password Lock State ──────────────────────────────────────────────
  const [isLocked, setIsLocked] = useState(true);
  const [showPasswordDialog, setShowPasswordDialog] = useState(true);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [showActivityDialog, setShowActivityDialog] = useState(false);
  const [activityCount, setActivityCount] = useState(0);
  const [autoLockMinutes, setAutoLockMinutes] = useState(5);
  const autoLockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Handle successful password verification
  const handlePasswordSuccess = (lockMinutes: number) => {
    setIsLocked(false);
    setShowPasswordDialog(false);
    setAutoLockMinutes(lockMinutes);
    console.log(`🔓 Kiosk unlocked! Auto-lock in ${lockMinutes} minutes`);
    
    // Start auto-lock timer
    if (autoLockTimerRef.current) {
      clearTimeout(autoLockTimerRef.current);
    }
    autoLockTimerRef.current = setTimeout(() => {
      console.log('🔒 Auto-locking kiosk due to inactivity');
      handleLockKiosk();
    }, lockMinutes * 60 * 1000);
  };

  // Reset auto-lock timer on activity
  const resetAutoLockTimer = () => {
    if (isLocked || !autoLockTimerRef.current) return;
    
    if (autoLockTimerRef.current) {
      clearTimeout(autoLockTimerRef.current);
    }
    autoLockTimerRef.current = setTimeout(() => {
      console.log('🔒 Auto-locking kiosk due to inactivity');
      handleLockKiosk();
    }, autoLockMinutes * 60 * 1000);
  };

  // Manual lock function
  const handleLockKiosk = () => {
    setIsLocked(true);
    setShowPasswordDialog(true);
    setScanState('idle');
    resetAll();
    console.log('🔒 Kiosk locked');
  };

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (autoLockTimerRef.current) {
        clearTimeout(autoLockTimerRef.current);
      }
    };
  }, []);

  // Poll activity count every 10 seconds
  useEffect(() => {
    const loadActivityCount = async () => {
      try {
        const response = await api.get('/kiosk/current-status');
        setActivityCount(response.data.totalIn || 0);
      } catch (error) {
        console.error('Failed to load activity count:', error);
      }
    };

    loadActivityCount();
    const interval = setInterval(loadActivityCount, 10000); // Every 10 seconds
    return () => clearInterval(interval);
  }, []);

  // Reset auto-lock timer on any user interaction
  useEffect(() => {
    if (scanState !== 'idle' || identifier) {
      resetAutoLockTimer();
    }
  }, [scanState, identifier]);

  // Handle camera errors
  const handleCameraError = (error: any) => {
    console.error('📷 Camera error:', error);
    if (error.name === 'NotAllowedError') {
      setCameraError('Camera permission denied. Please allow camera access in browser settings.');
    } else if (error.name === 'NotFoundError') {
      setCameraError('No camera found on this device.');
    } else if (error.name === 'NotReadableError') {
      setCameraError('Camera is being used by another application.');
    } else {
      setCameraError('Failed to access camera: ' + error.message);
    }
  };

  // Handle camera ready
  const handleCameraReady = () => {
    console.log('✅ Camera is ready!');
    setCameraReady(true);
    setCameraError(null);
  };

  // Fetch kiosk info on mount
  useEffect(() => {
    api.get('/kiosk/list').then(r => {
      const k = r.data.find((k: any) => k.id === KIOSK_ID);
      if (k) setKioskInfo({ name: k.name || 'Main Entrance', gate: k.gate || 'Gate 1' });
    }).catch(() => {});
  }, []);

  // Auto-reset after success/error
  useEffect(() => {
    if (scanState === 'success' || scanState === 'error') {
      setCountdown(1);
      const interval = setInterval(() => {
        setCountdown(c => {
          if (c <= 1) { clearInterval(interval); resetAll(); return 0; }
          return c - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [scanState]);

  const resetAll = () => {
    console.log('🔄 RESET CALLED - Returning to idle state');
    setScanState('idle');
    setIdentifier('');
    setCapturedB64(null);
    setResult(null);
    setErrorMsg('');
    setCountdown(0);
    stopBLEPolling();
    stopRFIDPolling();
  };

  // ── Stop RFID Polling ─────────────────────────────────────────────────
  const stopRFIDPolling = () => {
    if (rfidPollingRef.current) {
      clearInterval(rfidPollingRef.current);
      rfidPollingRef.current = null;
      console.log('⏹️  RFID polling stopped');
    }
  };

  // ── Start RFID Polling (WiFi-based ESP32) - AUTO-APPROVE ─────────────
  // Polls backend for pending RFID detections and auto-approves them
  const startRFIDPolling = () => {
    console.log('💳 Starting RFID auto-approval polling...');
    console.log('   Checking for pending RFID scans every 2 seconds');
    console.log('   Mode: AUTOMATIC APPROVAL (like QR)');
    
    const pollInterval = setInterval(async () => {
      try {
        console.log('📡 Polling /rfid/pending...');
        
        const { data } = await api.get('/rfid/pending', {
          params: { seconds: 60, kiosk_id: KIOSK_ID }
        });
        
        if (data && data.length > 0) {
          const pending = data[0];
          
          // Skip if we already processed this detection
          if (lastProcessedAttendanceRef.current === pending.id) {
            console.log('   Already displayed this detection, skipping');
            return;
          }
          
          console.log('🎯 New RFID detection found:', pending);
          console.log('⚡ AUTO-APPROVING...');
          lastProcessedAttendanceRef.current = pending.id;
          
          // Stop polling
          stopRFIDPolling();
          
          // Show processing
          setScanState('processing');
          
          // Capture photo
          const screenshot = webcamRef.current?.getScreenshot();
          const b64 = screenshot ? screenshot.split(',')[1] : null;
          setCapturedB64(b64);
          
          try {
            // Auto-approve the RFID detection
            console.log(`📤 Sending RFID auto-approval for detection ID: ${pending.id}`);
            const approvalResponse = await api.post(`/rfid/approve/${pending.id}`, {
              photo_base64: b64,
              approved_by: 'kiosk_auto',
            });
            
            console.log('✅ RFID detection AUTO-APPROVED - Attendance recorded!');
            
            // Show success screen
            setResult({
              identifier: pending.rfid_uid,
              student_name: pending.student_name,
              status: approvalResponse.data.status,
              session: approvalResponse.data.session,
              attendanceId: approvalResponse.data.attendance_id,
            });
            
            setScanState('success');
            console.log('✅ RFID auto-approved - Success screen displayed!');
          } catch (approveErr: any) {
            console.error('❌ RFID auto-approval failed');
            setErrorMsg(approveErr.response?.data?.error || 'Failed to approve attendance');
            setScanState('error');
          }
        }
      } catch (err) {
        console.error('❌ RFID polling error');
      }
    }, 2000); // Poll every 2 seconds
    
    rfidPollingRef.current = pollInterval;
  };

  // ── Start BLE Scan (Single scan per button click) ────────────────────
  const startBLEScan = async () => {
    console.log('🔵 Starting BLE single scan...');
    console.log('   Mode: One scan per button click (like QR/RFID)');
    
    setScanState('scanning');
    
    // Step 1: Capture photo FIRST (before scan)
    console.log('📸 Step 1: Capturing photo from webcam...');
    const screenshot = webcamRef.current?.getScreenshot();
    const b64 = screenshot ? screenshot.split(',')[1] : null;
    setCapturedB64(b64);
    
    if (b64) {
      console.log('✅ Photo captured successfully!');
      console.log(`📏 Photo size: ${(b64.length / 1024).toFixed(2)} KB`);
    } else {
      console.warn('⚠️ No photo captured (camera might not be ready)');
    }
    
    try {
      console.log('📡 Step 2: Calling backend for BLE scan with photo...');
      
      // Step 2: Scan for BLE device AND send photo in same request
      const response = await api.post('/attendance/scan-ble', {
        kiosk_id: KIOSK_ID,
        photo_base64: b64, // Send photo with scan request
      });
      
      const data = response.data;
      console.log('✅ BLE scan response:', data);
      
      if (data.success) {
        // Found student!
        console.log(`✅ Student detected: ${data.student_name}`);
        console.log(`   Attendance ID: ${data.attendance_id}`);
        console.log(`   Status: ${data.attendance_status}`);
        console.log(`   Photo saved: ${data.photo_path || 'No'}`);
        
        setScanState('processing');
        
        // Show success with attendance status
        setResult({
          identifier: data.student_id.toString(),
          student_name: data.student_name,
          status: data.attendance_status || 'Partial',
          session: 'Recorded',
          photo_path: data.photo_path,
          attendanceId: data.attendance_id,
        });
        setScanState('success');
        
        console.log(`✅ ${data.message}`);
        console.log('📸 Photo automatically saved with attendance record!');
      } else {
        // No student found
        console.log('❌ No BLE token detected');
        setErrorMsg('No BLE token detected. Please bring device closer.');
        setScanState('error');
      }
    } catch (err: any) {
      console.error('❌ BLE scan error:', err);
      if (err.response?.status === 404) {
        setErrorMsg('No BLE token detected. Please bring device closer.');
      } else {
        setErrorMsg(err.response?.data?.error || 'Failed to scan for BLE device');
      }
      setScanState('error');
    }
  };

  // ── Stop BLE Polling ──────────────────────────────────────────────────
  const stopBLEPolling = () => {
    if (scanIntervalRef.current) {
      console.log('🛑 Stopping BLE polling, interval ID:', scanIntervalRef.current);
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
      console.log('✅ BLE polling stopped successfully');
    }
  };

  // Note: BLE now uses single-scan mode, not polling
  // stopBLEPolling is kept for compatibility but won't be used

  // ── Approve BLE Detection ─────────────────────────────────────────────
  const handleApproveBLE = useCallback(async () => {
    console.log('👆 APPROVE button clicked (BLE)');
    if (!result || !result.attendanceId) {
      console.log('❌ Cannot approve - no result or attendanceId');
      return;
    }
    
    console.log('📸 Capturing photo...');
    setScanState('processing');
    
    // Capture photo
    const screenshot = webcamRef.current?.getScreenshot();
    const b64 = screenshot ? screenshot.split(',')[1] : null;
    setCapturedB64(b64);

    try {
      console.log(`📤 Sending BLE approval request for detection ID: ${result.attendanceId}`);
      const { data } = await api.post(`/ble/approve/${result.attendanceId}`, {
        photo_base64: b64,
        approved_by: 'kiosk_guard',
      });
      
      console.log('✅ BLE detection APPROVED - Attendance recorded!');
      console.log('   Setting scanState to: success');
      
      setResult({
        ...result,
        status: data.status,
        session: data.time,
        attendanceId: data.attendance_id,
      });
      setScanState('success');
      
      console.log('✅ Success state set - Success screen should show');
    } catch (err: any) {
      console.error('❌ Approval failed');
      setErrorMsg(err.response?.data?.error || 'Failed to approve attendance');
      setScanState('error');
    }
  }, [result]);

  // ── Reject BLE Detection ──────────────────────────────────────────────
  const handleRejectBLE = useCallback(async () => {
    if (!result || !result.attendanceId) return;
    
    try {
      await api.post(`/ble/reject/${result.attendanceId}`, {
        reason: 'Rejected by guard',
        rejected_by: 'kiosk_guard',
      });
      
      console.log('❌ BLE detection REJECTED');
      resetAll();  // Go back to idle state
    } catch (err) {
      console.error('Reject error');
      resetAll();
    }
  }, [result]);

  // ── Approve RFID Detection ────────────────────────────────────────────
  const handleApproveRFID = useCallback(async () => {
    console.log('👆 APPROVE button clicked (RFID)');
    if (!result || !result.attendanceId) {
      console.log('❌ Cannot approve - no result or attendanceId');
      return;
    }
    
    console.log('📸 Capturing photo...');
    setScanState('processing');
    
    // Capture photo
    const screenshot = webcamRef.current?.getScreenshot();
    const b64 = screenshot ? screenshot.split(',')[1] : null;
    setCapturedB64(b64);

    try {
      console.log(`📤 Sending RFID approval request for detection ID: ${result.attendanceId}`);
      const { data } = await api.post(`/rfid/approve/${result.attendanceId}`, {
        photo_base64: b64,
        approved_by: 'kiosk_guard',
      });
      
      console.log('✅ RFID detection APPROVED:', data);
      
      setResult({
        ...result,
        status: data.status,
        session: data.session,
        attendanceId: data.attendance_id,
      });
      setScanState('success');
      
      console.log('✅ Success state set - Success screen should show');
    } catch (err: any) {
      console.error('❌ RFID approval failed');
      setErrorMsg(err.response?.data?.error || 'Failed to approve attendance');
      setScanState('error');
    }
  }, [result]);

  // ── Reject RFID Detection ─────────────────────────────────────────────
  const handleRejectRFID = useCallback(async () => {
    if (!result || !result.attendanceId) return;
    
    try {
      await api.post(`/rfid/reject/${result.attendanceId}`, {
        reason: 'Rejected by guard',
        rejected_by: 'kiosk_guard',
      });
      
      console.log('❌ RFID detection REJECTED');
      resetAll();  // Go back to idle state
    } catch (err) {
      console.error('Reject error');
      resetAll();
    }
  }, [result]);

  // ── Confirm and submit attendance ─────────────────────────────────────
  const handleConfirm = useCallback(async (scanData: string) => {
    if (!scanData && !identifier) return;
    const dataToUse = scanData || identifier;
    
    console.log('🎯 handleConfirm called with:', dataToUse);
    console.log('📊 Data type:', typeof dataToUse);
    console.log('📏 Data length:', dataToUse.length);
    
    setScanState('processing');

    // Capture photo
    const screenshot = webcamRef.current?.getScreenshot();
    const b64 = screenshot ? screenshot.split(',')[1] : null;
    setCapturedB64(b64);

    try {
      console.log('📤 Sending POST to /api/kiosk/scan with:', {
        scan_method: method,
        identifier: dataToUse,
        kiosk_id: KIOSK_ID,
      });
      console.log('🔍 EXACT IDENTIFIER VALUE:', dataToUse);
      console.log('🔍 IDENTIFIER TYPE:', typeof dataToUse);
      console.log('🔍 IDENTIFIER LENGTH:', dataToUse.length);
      console.log('🔍 IDENTIFIER CHAR CODES:', Array.from(dataToUse).map((c: string) => c.charCodeAt(0)).join(','));
      
      const { data } = await api.post('/kiosk/scan', {
        scan_method:  method,
        identifier:   dataToUse,
        kiosk_id:     KIOSK_ID,
        photo_base64: b64,
      });
      
      console.log('✅ Backend response:', data);
      setResult(data);
      setScanState('success');
    } catch (err: any) {
      console.error('❌ Backend error:', err);
      console.error('❌ Response status:', err.response?.status);
      console.error('❌ Response data:', err.response?.data);
      
      if (err.response?.status === 409) {
        setResult({
          identifier: dataToUse,
          student_name: err.response.data.student_name || '',
          status: err.response.data.status
        });
        setErrorMsg(`Already recorded: ${err.response.data.student_name} — ${err.response.data.status}`);
      } else if (err.response?.status === 404) {
        setErrorMsg(`Student not found with LRN: ${dataToUse}. Please check if this student is registered.`);
      } else {
        setErrorMsg(err.response?.data?.error || 'Failed to record attendance');
      }
      setScanState('error');
    }
  }, [identifier, method]);

  // ── Start scanning based on method ──────────────────────────────────
  const startScanning = useCallback((scanMethod: ScanMethod) => {
    if (scanState !== 'idle') return;
    
    console.log(`🎯 Starting scan for method: ${scanMethod}`);
    
    if (scanMethod === 'QR') {
      setScanState('scanning');
      scanIntervalRef.current = setInterval(() => {
        if (!webcamRef.current) return;
        const video = webcamRef.current.video;
        if (!video || video.readyState !== 4) return;

        const canvas = document.createElement('canvas');
        canvas.width  = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(video, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);

        if (code?.data) {
          clearInterval(scanIntervalRef.current!);
          console.log('🎯 QR Code detected!');
          console.log('📋 Raw QR data:', code.data);
          console.log('📏 Data length:', code.data.length);
          
          // Try multiple methods to extract LRN
          let lrnToSubmit = null;
          
          // Method 1: Try to parse as JSON
          try {
            const payload = JSON.parse(code.data);
            console.log('✅ Successfully parsed JSON:', payload);
            console.log('🔍 JSON has lrn?', 'lrn' in payload, payload.lrn);
            console.log('🔍 JSON has LRN?', 'LRN' in payload, payload.LRN);
            console.log('🔍 JSON has student_lrn?', 'student_lrn' in payload, payload.student_lrn);
            // Support both lowercase 'lrn' and uppercase 'LRN'
            lrnToSubmit = payload.lrn || payload.LRN || payload.student_lrn;
            if (lrnToSubmit) {
              console.log('✅ Extracted LRN from JSON:', lrnToSubmit);
              console.log('🔍 LRN type:', typeof lrnToSubmit);
              console.log('🔍 LRN length:', lrnToSubmit.length);
            } else {
              console.log('⚠️ JSON parsed but no LRN field found. JSON keys:', Object.keys(payload));
            }
          } catch (parseError) {
            console.log('⚠️ Not valid JSON, trying other methods...', parseError);
          }
          
          // Method 2: If JSON parsing failed, try regex to find LRN pattern (9-12 digits)
          if (!lrnToSubmit) {
            const lrnMatch = code.data.match(/\b\d{9,12}\b/);
            if (lrnMatch) {
              lrnToSubmit = lrnMatch[0];
              console.log('✅ Extracted LRN via regex:', lrnToSubmit);
            }
          }
          
          // Method 3: If all else fails, use raw data (might be plain LRN)
          if (!lrnToSubmit) {
            lrnToSubmit = code.data.trim();
            console.log('📝 Using raw QR data as LRN:', lrnToSubmit);
          }
          
          if (!lrnToSubmit) {
            console.error('❌ Failed to extract LRN from QR code!');
            setScanState('error');
            setErrorMsg('Failed to extract student information from QR code');
            return;
          }
          
          setIdentifier(lrnToSubmit);
          setScanState('processing');
          
          // AUTOMATIC SUBMISSION - Backend will validate if LRN exists
          console.log('📤 Submitting to backend for validation...');
          console.log('🔍 About to call handleConfirm with:', lrnToSubmit);
          
          try {
            handleConfirm(lrnToSubmit);
          } catch (err) {
            console.error('❌ Error calling handleConfirm:', err);
            setScanState('error');
            setErrorMsg('Failed to process attendance');
          }
        }
      }, 250);
    } else if (scanMethod === 'RFID') {
      console.log('💳 RFID mode - AUTO-APPROVE (like QR)');
      setScanState('scanning');
      // Start polling for PENDING RFID detections and auto-approve
      startRFIDPolling();
      // Keyboard RFID will also auto-approve (see keyboard listener)
    } else if (scanMethod === 'BLE') {
      console.log('🔵 BLE mode - Web Kiosk Single Scan');
      console.log('   One scan per button click (like RFID/QR)');
      // Call single BLE scan (not continuous polling)
      startBLEScan();
    }
  }, [scanState, handleConfirm, startRFIDPolling, startBLEScan]);

  useEffect(() => {
    return () => {
      if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
      if (rfidPollingRef.current) clearInterval(rfidPollingRef.current);
    };
  }, []);

  // ── RFID/QR Scanner keyboard emulation ───────────────────────────────
  // Both RFID readers and USB QR scanners work the same way (keyboard emulation)
  useEffect(() => {
    if ((method !== 'RFID' && method !== 'QR') || scanState !== 'scanning') return;

    console.log(`⌨️  Keyboard listener activated for ${method} mode`);

    const handleKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (e.key === 'Enter') {
        const scannedData = rfidBufferRef.current.trim();
        rfidBufferRef.current = '';
        if (rfidTimerRef.current) clearTimeout(rfidTimerRef.current);
        
        if (scannedData) {
          console.log(`✅ ${method} scanned via keyboard:`, scannedData);
          
          // Stop WiFi polling if active (keyboard input takes priority)
          stopRFIDPolling();
          
          // Try multiple methods to extract LRN
          let identifierToSubmit = null;
          
          // Method 1: Try to parse as JSON
          try {
            const parsed = JSON.parse(scannedData);
            console.log('✅ Successfully parsed JSON:', parsed);
            // If it's QR code JSON, extract LRN (support both cases)
            identifierToSubmit = parsed.lrn || parsed.LRN || parsed.student_lrn;
            if (identifierToSubmit) {
              console.log('✅ Extracted LRN from JSON:', identifierToSubmit);
            }
          } catch {
            console.log('⚠️ Not valid JSON, trying other methods...');
          }
          
          // Method 2: Try regex to find LRN pattern (9-12 digits)
          if (!identifierToSubmit) {
            const lrnMatch = scannedData.match(/\b\d{9,12}\b/);
            if (lrnMatch) {
              identifierToSubmit = lrnMatch[0];
              console.log('✅ Extracted LRN via regex:', identifierToSubmit);
            }
          }
          
          // Method 3: Use raw data (might be RFID UID)
          if (!identifierToSubmit) {
            identifierToSubmit = scannedData.toUpperCase().trim();
            console.log('📝 Using raw data as identifier:', identifierToSubmit);
          }
          
          console.log(`📤 Submitting ${method} attendance (keyboard mode)`);
          setIdentifier(identifierToSubmit);
          handleConfirm(identifierToSubmit);
        }
        return;
      }
      if (e.key.length === 1) {
        rfidBufferRef.current += e.key;
        if (rfidTimerRef.current) clearTimeout(rfidTimerRef.current);
        // Increased timeout from 200ms to 500ms to handle long QR JSON strings
        rfidTimerRef.current = setTimeout(() => { rfidBufferRef.current = ''; }, 500);
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => {
      console.log(`⌨️  Keyboard listener deactivated`);
      window.removeEventListener('keydown', handleKey);
      if (rfidTimerRef.current) clearTimeout(rfidTimerRef.current);
    };
  }, [method, scanState, handleConfirm]);

  return (
    <Box sx={{
      height: '100vh',
      width: '100vw',
      display: 'flex',
      flexDirection: 'column',
      bgcolor: theme.colors.neutral[800],
      overflow: 'hidden',
    }}>
      {/* Top Header Bar - Professional Blue theme */}
      <Box sx={{
        background: theme.colors.primary.gradient,
        color: '#fff',
        px: { xs: 1.5, sm: 2, md: 3 },
        py: { xs: 1, sm: 1.5 },
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: theme.shadows.elevation3,
        flexWrap: isMobile ? 'wrap' : 'nowrap',
      }}>
        {/* Left: Time and Date */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
          <Typography sx={{ 
            fontSize: { xs: '0.9rem', sm: '1rem', md: '1.1rem' },
            fontWeight: theme.typography.fontWeight.bold, 
            fontFamily: theme.typography.fontFamily.mono,
            lineHeight: 1,
          }}>
            {format(new Date(), 'h:mm a').toUpperCase()}
          </Typography>
          <Typography sx={{ 
            fontSize: { xs: '0.65rem', sm: '0.7rem', md: '0.75rem' },
            fontWeight: theme.typography.fontWeight.normal, 
            fontFamily: theme.typography.fontFamily.primary,
            opacity: 0.9,
            lineHeight: 1,
          }}>
            {format(new Date(), 'EEE, MMM d, yyyy')}
          </Typography>
        </Box>

        {/* Center: Branding */}
        <Box textAlign="center" sx={{ flex: isMobile ? '1 1 100%' : '0 0 auto', order: isMobile ? 3 : 2 }}>
          <Typography sx={{ 
            fontSize: { xs: '1.1rem', sm: '1.3rem', md: '1.5rem' },
            fontWeight: theme.typography.fontWeight.extrabold, 
            fontFamily: theme.typography.fontFamily.display,
            letterSpacing: '0.05em',
          }}>
            AttendBox
          </Typography>
        </Box>

        {/* Right: Location & Status Icons */}
        <Box display="flex" alignItems="center" gap={{ xs: 1, sm: 1.5, md: 2 }} sx={{ order: isMobile ? 2 : 3 }}>
          <Typography sx={{ 
            fontSize: { xs: '0.7rem', sm: '0.85rem', md: '0.95rem' },
            fontWeight: theme.typography.fontWeight.medium,
            fontFamily: theme.typography.fontFamily.primary,
            display: { xs: 'none', sm: 'block' },
          }}>
            {SCHOOL_NAME} — {kioskInfo.gate}
          </Typography>
          {/* Mobile: Only show gate name */}
          <Typography sx={{ 
            fontSize: '0.75rem',
            fontWeight: theme.typography.fontWeight.medium,
            fontFamily: theme.typography.fontFamily.primary,
            display: { xs: 'block', sm: 'none' },
          }}>
            {kioskInfo.gate}
          </Typography>
          <Box display="flex" gap={0.5}>
            <Wifi sx={{ fontSize: { xs: 16, sm: 18, md: 20 }, opacity: 0.9 }} />
            <SignalCellularAlt sx={{ fontSize: { xs: 16, sm: 18, md: 20 }, opacity: 0.9 }} />
            
            {/* Activity Button */}
            <Tooltip title={isLocked ? "" : "View Attendance"}>
              <span>
                <IconButton
                  onClick={() => setShowActivityDialog(true)}
                  disabled={isLocked}
                  sx={{
                    color: 'white',
                    p: 0.5,
                    '&:hover': {
                      bgcolor: 'rgba(255,255,255,0.1)',
                    },
                  }}
                >
                  <Badge 
                    badgeContent={activityCount} 
                    color="error"
                    max={999}
                  >
                    <Assignment sx={{ fontSize: { xs: 16, sm: 18, md: 20 } }} />
                  </Badge>
                </IconButton>
              </span>
            </Tooltip>
            
            {/* Settings Button */}
            <Tooltip title={isLocked ? "" : "Settings"}>
              <span>
                <IconButton
                  onClick={() => setShowSettingsDialog(true)}
                  disabled={isLocked}
                  sx={{
                    color: 'white',
                    p: 0.5,
                    '&:hover': {
                      bgcolor: 'rgba(255,255,255,0.1)',
                    },
                  }}
                >
                  <Settings sx={{ fontSize: { xs: 16, sm: 18, md: 20 } }} />
                </IconButton>
              </span>
            </Tooltip>
            
            {/* Lock Button */}
            <Tooltip title={isLocked ? "Locked" : "Lock Kiosk"}>
              <span>
                <IconButton
                  onClick={handleLockKiosk}
                  disabled={isLocked}
                  sx={{
                    color: 'white',
                    p: 0.5,
                    '&:hover': {
                      bgcolor: 'rgba(255,255,255,0.1)',
                    },
                  }}
                >
                  {isLocked ? (
                    <Lock sx={{ fontSize: { xs: 16, sm: 18, md: 20 } }} />
                  ) : (
                    <LockOpen sx={{ fontSize: { xs: 16, sm: 18, md: 20 } }} />
                  )}
                </IconButton>
              </span>
            </Tooltip>
          </Box>
        </Box>
      </Box>

      {/* Main Content - Camera + Sidebar Layout */}
      <Box sx={{ 
        flex: 1, 
        display: 'flex',
        flexDirection: { xs: 'column', md: 'row' }, // Stack on mobile, side-by-side on desktop
        overflow: 'hidden',
      }}>
        
        {/* ═══════════════════════════════════════════════════════════ */}
        {/* LEFT PANEL - Clock & Camera (Larger!) */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <Box sx={{
          flex: 1, // Take all remaining space
          bgcolor: theme.colors.neutral[800],
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center', // Center the camera vertically
          p: { xs: 1, sm: 1.5, md: 2 }, // Even less padding for maximum camera space
        }}>
          {/* Camera Preview Box - FULL HEIGHT */}
          <Box sx={{
            width: '100%',
            flex: 1, // Take all remaining vertical space
            maxHeight: '100%',
            bgcolor: theme.colors.neutral[900],
            border: `3px dashed ${theme.colors.neutral[600]}`,
            borderRadius: theme.borderRadius.lg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            position: 'relative',
            boxShadow: theme.shadows.elevation2,
          }}>
            {/* Webcam for scanning and photo capture - ALWAYS VISIBLE */}
            <Webcam
              ref={webcamRef}
              audio={false}
              screenshotFormat="image/jpeg"
              videoConstraints={{ 
                facingMode: 'user',
                width: { ideal: 1280 },
                height: { ideal: 720 }
              }}
              onUserMedia={handleCameraReady}
              onUserMediaError={handleCameraError}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                // Hide webcam when showing captured photo
                display: (scanState === 'success' && capturedB64) ? 'none' : 'block',
              }}
            />

            {/* Camera Loading Overlay */}
            {!cameraReady && !cameraError && (
              <Box sx={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: 'rgba(0,0,0,0.8)',
                color: '#fff',
              }}>
                <CircularProgress size={60} sx={{ color: theme.colors.primary.light, mb: 2 }} />
                <Typography sx={{ 
                  fontSize: '1.1rem', 
                  fontWeight: theme.typography.fontWeight.semibold,
                  fontFamily: theme.typography.fontFamily.primary,
                }}>
                  Starting camera...
                </Typography>
                <Typography sx={{ 
                  fontSize: '0.9rem', 
                  color: theme.colors.neutral[400],
                  mt: 1,
                  fontFamily: theme.typography.fontFamily.primary,
                }}>
                  Please allow camera access if prompted
                </Typography>
              </Box>
            )}

            {/* Camera Error Overlay */}
            {cameraError && (
              <Box sx={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: 'rgba(0,0,0,0.9)',
                color: '#fff',
                p: 3,
              }}>
                <ErrorOutline sx={{ fontSize: 80, color: theme.colors.status.error.main, mb: 2 }} />
                <Typography sx={{ 
                  fontSize: '1.2rem', 
                  fontWeight: theme.typography.fontWeight.bold,
                  fontFamily: theme.typography.fontFamily.primary,
                  color: theme.colors.status.error.main,
                  mb: 2,
                  textAlign: 'center',
                }}>
                  Camera Access Error
                </Typography>
                <Typography sx={{ 
                  fontSize: '0.95rem', 
                  fontFamily: theme.typography.fontFamily.primary,
                  textAlign: 'center',
                  maxWidth: '400px',
                  mb: 3,
                }}>
                  {cameraError}
                </Typography>
                <Button
                  variant="contained"
                  onClick={() => window.location.reload()}
                  sx={{
                    bgcolor: theme.colors.primary.main,
                    '&:hover': { bgcolor: theme.colors.primary.dark },
                  }}
                >
                  Reload Page
                </Button>
              </Box>
            )}

            {/* Success Photo Display */}
            {scanState === 'success' && capturedB64 && (
              <Fade in timeout={500}>
                <img
                  src={`data:image/jpeg;base64,${capturedB64}`}
                  alt="captured"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </Fade>
            )}

            {/* Instruction Overlay - Inside Camera View */}
            {scanState === 'idle' && (
              <Fade in timeout={300}>
                <Box sx={{
                  position: 'absolute',
                  bottom: 16,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  bgcolor: 'rgba(0, 0, 0, 0.75)',
                  backdropFilter: 'blur(8px)',
                  color: '#fff',
                  px: 3,
                  py: 1.5,
                  borderRadius: 2,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                  maxWidth: '90%',
                }}>
                  {method === 'RFID' && (
                    <>
                      <CreditCard sx={{ fontSize: 28, color: theme.colors.primary.light }} />
                      <Typography sx={{ 
                        fontSize: '0.95rem',
                        fontWeight: theme.typography.fontWeight.semibold,
                        fontFamily: theme.typography.fontFamily.primary,
                      }}>
                        Tap your RFID card on the reader
                      </Typography>
                    </>
                  )}
                  {method === 'QR' && (
                    <>
                      <QrCodeScanner sx={{ fontSize: 28, color: theme.colors.primary.light }} />
                      <Typography sx={{ 
                        fontSize: '0.95rem',
                        fontWeight: theme.typography.fontWeight.semibold,
                        fontFamily: theme.typography.fontFamily.primary,
                      }}>
                        Show your QR code to the camera
                      </Typography>
                    </>
                  )}
                  {method === 'BLE' && (
                    <>
                      <Bluetooth sx={{ fontSize: 28, color: theme.colors.primary.light }} />
                      <Typography sx={{ 
                        fontSize: '0.95rem',
                        fontWeight: theme.typography.fontWeight.semibold,
                        fontFamily: theme.typography.fontFamily.primary,
                      }}>
                        Hold your BLE device near the kiosk
                      </Typography>
                    </>
                  )}
                </Box>
              </Fade>
            )}

            {/* Scanning Overlay - Inside Camera View */}
            {scanState === 'scanning' && (
              <Fade in timeout={300}>
                <Box sx={{
                  position: 'absolute',
                  bottom: 16,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  bgcolor: 'rgba(33, 150, 243, 0.9)', // Blue background
                  backdropFilter: 'blur(8px)',
                  color: '#fff',
                  px: 3,
                  py: 1.5,
                  borderRadius: 2,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  boxShadow: '0 4px 12px rgba(33, 150, 243, 0.5)',
                  animation: 'pulse 1.5s ease-in-out infinite',
                  '@keyframes pulse': {
                    '0%, 100%': { opacity: 1 },
                    '50%': { opacity: 0.8 },
                  },
                }}>
                  <CircularProgress size={24} sx={{ color: '#fff' }} />
                  <Typography sx={{ 
                    fontSize: '0.95rem',
                    fontWeight: theme.typography.fontWeight.bold,
                    fontFamily: theme.typography.fontFamily.primary,
                  }}>
                    {method === 'RFID' && 'Scanning RFID card...'}
                    {method === 'QR' && 'Scanning QR code...'}
                    {method === 'BLE' && 'Detecting BLE device...'}
                  </Typography>
                </Box>
              </Fade>
            )}

            {/* Success Overlay - Centered on Camera View */}
            {scanState === 'success' && result && (
              <Fade in timeout={500}>
                <Box sx={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  bgcolor: 'rgba(0, 0, 0, 0.9)',
                  backdropFilter: 'blur(12px)',
                  color: '#fff',
                  px: 4,
                  py: 4,
                  borderRadius: 3,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 2,
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
                  minWidth: '350px',
                  maxWidth: '90%',
                }}>
                  {/* Success Icon */}
                  <CheckCircle sx={{ 
                    fontSize: 80, 
                    color: theme.colors.status.success.main,
                    animation: 'scaleIn 0.5s ease-out',
                    '@keyframes scaleIn': {
                      '0%': { transform: 'scale(0)' },
                      '50%': { transform: 'scale(1.1)' },
                      '100%': { transform: 'scale(1)' },
                    },
                  }} />
                  
                  {/* Success Message */}
                  <Typography sx={{ 
                    fontSize: '1.8rem', 
                    fontFamily: theme.typography.fontFamily.display,
                    fontWeight: theme.typography.fontWeight.extrabold, 
                    color: theme.colors.status.success.main,
                    textAlign: 'center',
                    lineHeight: 1.2,
                  }}>
                    Attendance Recorded!
                  </Typography>
                  
                  {/* Student Name */}
                  <Typography sx={{ 
                    fontSize: '1.5rem', 
                    fontFamily: theme.typography.fontFamily.display,
                    fontWeight: theme.typography.fontWeight.bold, 
                    color: '#fff',
                    textAlign: 'center',
                  }}>
                    {result.student_name}
                  </Typography>
                  
                  {/* Status Badge */}
                  <Box sx={{
                    bgcolor: result.status === 'Time-In' || result.status === 'Present' 
                      ? theme.colors.status.success.main 
                      : result.status === 'Late'
                      ? '#f59e0b'
                      : result.status === 'Time-Out'
                      ? '#3b82f6' // Blue for Time-Out
                      : theme.colors.status.error.main,
                    color: '#fff',
                    px: 3,
                    py: 1,
                    borderRadius: 2,
                    fontSize: '1rem',
                    fontWeight: theme.typography.fontWeight.bold,
                    textTransform: 'uppercase',
                  }}>
                    {result.status || 'Present'}
                  </Box>
                  
                  {/* SMS Notification */}
                  <Typography sx={{ 
                    fontSize: '0.95rem', 
                    fontFamily: theme.typography.fontFamily.primary,
                    color: 'rgba(255, 255, 255, 0.8)',
                    textAlign: 'center',
                  }}>
                    📱 SMS notification sent to parent
                  </Typography>
                  
                  {/* Countdown Timer */}
                  <Typography sx={{ 
                    fontSize: '1rem', 
                    fontFamily: theme.typography.fontFamily.primary,
                    fontWeight: theme.typography.fontWeight.semibold, 
                    color: '#fff',
                    mt: 1,
                  }}>
                    Resetting in {countdown}s...
                  </Typography>
                </Box>
              </Fade>
            )}
          </Box>

        </Box>
        {/* End of Left Panel - Camera */}

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* RIGHT SIDEBAR - Method Selection (Always visible) */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <Box sx={{
          width: { xs: '100%', md: '200px' }, // Narrower sidebar: 200px instead of 280px
          height: { xs: 'auto', md: '100%' },
          bgcolor: theme.colors.neutral[700],
          display: 'flex',
          flexDirection: 'column',
          p: { xs: 2, md: 2 }, // Less padding
          borderLeft: { xs: 'none', md: `2px solid ${theme.colors.neutral[600]}` },
          borderTop: { xs: `2px solid ${theme.colors.neutral[600]}`, md: 'none' },
          overflowY: 'auto',
        }}>
          <Typography sx={{
            fontSize: { xs: '0.9rem', md: '1rem' }, // Smaller font
            fontFamily: theme.typography.fontFamily.display,
            fontWeight: theme.typography.fontWeight.semibold,
            color: '#fff',
            mb: 2, // Less margin
            textAlign: 'center',
          }}>
            Select your attendance method
          </Typography>

          {/* Method Buttons - Vertical Stack */}
          <Box sx={{ 
            display: 'flex', 
            flexDirection: 'column',
            gap: 1.5, // Less gap between buttons
          }}>
            {/* RFID Card Button */}
            <Button
              onClick={() => { 
                console.log('🔘 RFID button clicked');
                setMethod('RFID'); 
                startScanning('RFID'); 
              }}
              sx={{
                py: 2, // Less padding
                bgcolor: method === 'RFID' ? theme.colors.primary.light : theme.colors.neutral[600],
                color: method === 'RFID' ? '#fff' : theme.colors.neutral[200],
                border: method === 'RFID' ? `3px solid ${theme.colors.primary.main}` : `2px solid ${theme.colors.neutral[500]}`,
                borderRadius: theme.borderRadius.md,
                display: 'flex',
                flexDirection: 'column',
                gap: 0.5,
                fontFamily: theme.typography.fontFamily.primary,
                boxShadow: method === 'RFID' ? theme.shadows.elevation3 : theme.shadows.elevation1,
                '&:hover': {
                  bgcolor: method === 'RFID' ? theme.colors.primary[400] : theme.colors.neutral[500],
                  transform: 'translateY(-2px)',
                  boxShadow: theme.shadows.hoverLift,
                },
                transition: theme.transitions.button,
              }}
            >
              <CreditCard sx={{ fontSize: 36 }} /> {/* Smaller icon */}
              <Typography sx={{ 
                fontSize: '0.9rem', // Smaller text
                fontWeight: theme.typography.fontWeight.bold,
                fontFamily: theme.typography.fontFamily.primary,
              }}>
                RFID card
              </Typography>
            </Button>

            {/* QR Code Button */}
            <Button
              onClick={() => { 
                console.log('🔘 QR button clicked');
                setMethod('QR'); 
                startScanning('QR'); 
              }}
              sx={{
                py: 2,
                bgcolor: method === 'QR' ? theme.colors.primary.light : theme.colors.neutral[600],
                color: method === 'QR' ? '#fff' : theme.colors.neutral[200],
                border: method === 'QR' ? `3px solid ${theme.colors.primary.main}` : `2px solid ${theme.colors.neutral[500]}`,
                borderRadius: theme.borderRadius.md,
                display: 'flex',
                flexDirection: 'column',
                gap: 0.5,
                fontFamily: theme.typography.fontFamily.primary,
                boxShadow: method === 'QR' ? theme.shadows.elevation3 : theme.shadows.elevation1,
                '&:hover': {
                  bgcolor: method === 'QR' ? theme.colors.primary[400] : theme.colors.neutral[500],
                  transform: 'translateY(-2px)',
                  boxShadow: theme.shadows.hoverLift,
                },
                transition: theme.transitions.button,
              }}
            >
              <QrCodeScanner sx={{ fontSize: 36 }} />
              <Typography sx={{ 
                fontSize: '0.9rem',
                fontWeight: theme.typography.fontWeight.bold,
                fontFamily: theme.typography.fontFamily.primary,
              }}>
                QR code
              </Typography>
            </Button>

            {/* BLE Token Button */}
            <Button
              onClick={() => { 
                console.log('🔘 BLE button clicked');
                setMethod('BLE'); 
                startScanning('BLE'); 
              }}
              sx={{
                py: 2,
                bgcolor: method === 'BLE' ? theme.colors.primary.light : theme.colors.neutral[600],
                color: method === 'BLE' ? '#fff' : theme.colors.neutral[200],
                border: method === 'BLE' ? `3px solid ${theme.colors.primary.main}` : `2px solid ${theme.colors.neutral[500]}`,
                borderRadius: theme.borderRadius.md,
                display: 'flex',
                flexDirection: 'column',
                gap: 0.5,
                fontFamily: theme.typography.fontFamily.primary,
                boxShadow: method === 'BLE' ? theme.shadows.elevation3 : theme.shadows.elevation1,
                '&:hover': {
                  bgcolor: method === 'BLE' ? theme.colors.primary[400] : theme.colors.neutral[500],
                  transform: 'translateY(-2px)',
                  boxShadow: theme.shadows.hoverLift,
                },
                transition: theme.transitions.button,
              }}
            >
              <Bluetooth sx={{ fontSize: 36 }} />
              <Typography sx={{ 
                fontSize: '0.9rem',
                fontWeight: theme.typography.fontWeight.bold,
                fontFamily: theme.typography.fontFamily.primary,
              }}>
                BLE token
              </Typography>
            </Button>
          </Box>
        </Box>
        {/* End of Right Sidebar */}

      </Box>
      {/* End of Main Content */}

      {/* Password Dialog */}
      <KioskPasswordDialog
        open={showPasswordDialog}
        onSuccess={handlePasswordSuccess}
      />

      {/* Settings Dialog */}
      <KioskSettingsDialog
        open={showSettingsDialog}
        onClose={() => setShowSettingsDialog(false)}
      />

      {/* Attendance Activity Dialog */}
      <AttendanceActivityDialog
        open={showActivityDialog}
        onClose={() => setShowActivityDialog(false)}
      />

      {/* Locked Overlay */}
      {isLocked && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            bgcolor: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1200, // Below MUI Dialog (9999) but above page content
          }}
        >
          {/* Center content removed - Dialog will show the lock message */}
        </Box>
      )}
    </Box>
  );
}
