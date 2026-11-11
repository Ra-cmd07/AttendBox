import { useState, useCallback, useMemo, memo, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Box, Typography, Grid, CircularProgress, Alert,
  useTheme, IconButton, LinearProgress, Divider,
  Checkbox, FormControlLabel, List, ListItem, ListItemButton,
  ListItemIcon, ListItemText, Avatar, Tooltip,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DownloadIcon from '@mui/icons-material/Download';
import PrintIcon from '@mui/icons-material/Print';
import PersonIcon from '@mui/icons-material/Person';
import PhotoCamera from '@mui/icons-material/PhotoCamera';
import api from '../../api/client';
import { getApiBaseUrl } from '../../utils/apiUrl';

const FONT = '"Segoe UI", "Roboto", sans-serif';

// CR80 Standard ID Card Size: 53.98 × 85.6 mm @ 300 DPI (PORTRAIT)
const ID_DPI = 300;
const ID_WIDTH_MM = 53.98;  // Portrait: narrower width
const ID_HEIGHT_MM = 85.6;  // Portrait: taller height
const ID_WIDTH_PX = Math.round((ID_WIDTH_MM / 25.4) * ID_DPI);   // ~638px
const ID_HEIGHT_PX = Math.round((ID_HEIGHT_MM / 25.4) * ID_DPI);  // ~1012px

// A4 dimensions in points (72 DPI)
const MM_TO_PT = 72 / 25.4;
const A4_W_PT = 210 * MM_TO_PT;
const A4_H_PT = 297 * MM_TO_PT;
const ID_W_PT = ID_WIDTH_MM * MM_TO_PT;
const ID_H_PT = ID_HEIGHT_MM * MM_TO_PT;

// Grid layout: 2 columns × 4 rows = 8 cards per page
const CARDS_PER_ROW = 2;
const CARDS_PER_COL = 4;
const CARDS_PER_PAGE = CARDS_PER_ROW * CARDS_PER_COL;

interface Student {
  id: number;
  lrn: string;
  name: string;
  photo?: string;
  gender?: string;
  grade_level?: string;
  section?: string;
  strand?: string;
  school_year?: string;
  parents?: any[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  students: Student[];
  teacher?: any;
}

// Helper to strip "Grade " prefix from section
function stripGradePrefix(raw: string): string {
  return (raw || '').replace(/^grade\s*\d+\s*-?\s*/i, '').trim();
}

// Build QR payload (same as existing system)
function buildStudentQRPayload(student: Student): string {
  const grade = student.grade_level
    ? (String(student.grade_level).startsWith('Grade ')
        ? student.grade_level
        : `Grade ${student.grade_level}`)
    : '';
  const section = stripGradePrefix(student.section ?? '');
  
  let parent1Name = '';
  let parent1Contact = '';
  
  if (student.parents && student.parents.length > 0) {
    const parent = student.parents[0];
    parent1Name = parent.name || '';
    parent1Contact = parent.contact || '';
  }

  return JSON.stringify({
    lrn: student.lrn,
    name: student.name,
    section: grade && section ? `${grade} - ${section}` : grade || section || '',
    gender: student.gender ?? '',
    sy: student.school_year ?? '',
    parent1: parent1Name,
    contact: parent1Contact,
  });
}

// Generate QR code URL
function getQRCodeUrl(student: Student): string {
  const payload = buildStudentQRPayload(student);
  return `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(payload)}&margin=0&color=000000&bgcolor=ffffff&format=png`;
}

// Load image as promise
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image failed to load'));
    img.src = src;
  });
}

// Render text with word wrap
function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number): number {
  const words = text.split(' ');
  let line = '';
  let currentY = y;
  
  for (let i = 0; i < words.length; i++) {
    const testLine = line + words[i] + ' ';
    const metrics = ctx.measureText(testLine);
    
    if (metrics.width > maxWidth && i > 0) {
      ctx.fillText(line, x, currentY);
      line = words[i] + ' ';
      currentY += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, x, currentY);
  return currentY + lineHeight;
}

// Render FRONT of ID card (PORTRAIT)
async function renderIDCardFront(student: Student, schoolLogo: string | null, schoolName: string, city: string): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = ID_WIDTH_PX;
  canvas.height = ID_HEIGHT_PX;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');

  // Background - white
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, ID_WIDTH_PX, ID_HEIGHT_PX);

  const margin = 30;
  let currentY = 40;

  // Header: "DEPARTMENT OF EDUCATION"
  ctx.fillStyle = '#1a237e';
  ctx.font = `600 ${Math.round(ID_WIDTH_PX * 0.032)}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText('DEPARTMENT OF EDUCATION', ID_WIDTH_PX / 2, currentY);
  currentY += 35;

  // School Name (large, bold, centered, multi-line)
  ctx.fillStyle = '#1a237e';
  ctx.font = `bold ${Math.round(ID_WIDTH_PX * 0.052)}px ${FONT}`;
  ctx.textAlign = 'center';
  const schoolNameLines = schoolName.split('\n');
  schoolNameLines.forEach(line => {
    ctx.fillText(line.toUpperCase(), ID_WIDTH_PX / 2, currentY);
    currentY += 35;
  });
  
  currentY += 20;

  // Photo and Logo Section (side by side)
  const photoStartY = currentY;
  const photoWidth = Math.round(ID_WIDTH_PX * 0.45);  // ~287px
  const photoHeight = Math.round(photoWidth * 1.2);    // 1x1 / 2x2 aspect ratio
  const photoX = margin;
  
  // Student Photo on the LEFT
  const apiUrl = getApiBaseUrl().replace('/api', '');
  const photoUrl = student.photo ? `${apiUrl}${student.photo}` : null;

  if (photoUrl) {
    try {
      const photoImg = await loadImage(photoUrl);
      ctx.save();
      ctx.fillStyle = '#e0e0e0';
      ctx.fillRect(photoX, photoStartY, photoWidth, photoHeight);
      
      // Draw photo maintaining aspect ratio
      const scale = Math.min(photoWidth / photoImg.width, photoHeight / photoImg.height);
      const scaledW = photoImg.width * scale;
      const scaledH = photoImg.height * scale;
      const offsetX = (photoWidth - scaledW) / 2;
      const offsetY = (photoHeight - scaledH) / 2;
      
      ctx.drawImage(photoImg, photoX + offsetX, photoStartY + offsetY, scaledW, scaledH);
      ctx.restore();
      
      // Photo border
      ctx.strokeStyle = '#999999';
      ctx.lineWidth = 2;
      ctx.strokeRect(photoX, photoStartY, photoWidth, photoHeight);
    } catch (err) {
      console.error('Failed to load photo:', err);
      // Placeholder
      ctx.fillStyle = '#e0e0e0';
      ctx.fillRect(photoX, photoStartY, photoWidth, photoHeight);
      ctx.strokeStyle = '#999999';
      ctx.lineWidth = 2;
      ctx.strokeRect(photoX, photoStartY, photoWidth, photoHeight);
      
      ctx.fillStyle = '#666666';
      ctx.font = `${Math.round(photoWidth * 0.16)}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('1x1 / 2x2', photoX + photoWidth / 2, photoStartY + photoHeight / 2 - 15);
      ctx.fillText('PHOTO', photoX + photoWidth / 2, photoStartY + photoHeight / 2 + 15);
    }
  } else {
    // No photo - placeholder
    ctx.fillStyle = '#e0e0e0';
    ctx.fillRect(photoX, photoStartY, photoWidth, photoHeight);
    ctx.strokeStyle = '#999999';
    ctx.lineWidth = 2;
    ctx.strokeRect(photoX, photoStartY, photoWidth, photoHeight);
    
    ctx.fillStyle = '#666666';
    ctx.font = `${Math.round(photoWidth * 0.16)}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('1x1 / 2x2', photoX + photoWidth / 2, photoStartY + photoHeight / 2 - 15);
    ctx.fillText('PHOTO', photoX + photoWidth / 2, photoStartY + photoHeight / 2 + 15);
  }

  // School Logo (circular) on the RIGHT
  const logoSize = Math.round(ID_WIDTH_PX * 0.32);
  const logoX = photoX + photoWidth + 20;
  const logoY = photoStartY + 10;
  
  if (schoolLogo) {
    try {
      const logoUrl = `${apiUrl}${schoolLogo}`;
      const logoImg = await loadImage(logoUrl);
      
      ctx.save();
      ctx.beginPath();
      ctx.arc(logoX + logoSize / 2, logoY + logoSize / 2, logoSize / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.drawImage(logoImg, logoX, logoY, logoSize, logoSize);
      ctx.restore();
      
      // Dashed circle border
      ctx.strokeStyle = '#999999';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.arc(logoX + logoSize / 2, logoY + logoSize / 2, logoSize / 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    } catch {
      // Placeholder for logo
      ctx.strokeStyle = '#999999';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.arc(logoX + logoSize / 2, logoY + logoSize / 2, logoSize / 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      
      ctx.fillStyle = '#999999';
      ctx.font = `400 ${Math.round(logoSize * 0.14)}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('SCHOOL', logoX + logoSize / 2, logoY + logoSize / 2 - 10);
      ctx.fillText('LOGO', logoX + logoSize / 2, logoY + logoSize / 2 + 10);
    }
  } else {
    // No logo placeholder
    ctx.strokeStyle = '#999999';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.arc(logoX + logoSize / 2, logoY + logoSize / 2, logoSize / 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    
    ctx.fillStyle = '#999999';
    ctx.font = `400 ${Math.round(logoSize * 0.14)}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SCHOOL', logoX + logoSize / 2, logoY + logoSize / 2 - 10);
    ctx.fillText('LOGO', logoX + logoSize / 2, logoY + logoSize / 2 + 10);
  }

  // City name below logo
  const cityY = logoY + logoSize + 15;
  ctx.fillStyle = '#333333';
  ctx.font = `600 ${Math.round(ID_WIDTH_PX * 0.038)}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText(city || 'Cagayan de Oro', logoX + logoSize / 2, cityY);
  
  // "City" in italics
  ctx.font = `italic ${Math.round(ID_WIDTH_PX * 0.032)}px ${FONT}`;
  ctx.fillText('City', logoX + logoSize / 2, cityY + 20);

  // Learner's Signature line - positioned below photo with more spacing
  currentY = photoStartY + photoHeight + 65; // Increased from 55 to 65
  ctx.strokeStyle = '#999999';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(margin, currentY);
  ctx.lineTo(ID_WIDTH_PX - margin, currentY);
  ctx.stroke();
  
  ctx.fillStyle = '#666666';
  ctx.font = `400 ${Math.round(ID_WIDTH_PX * 0.028)}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText("LEARNER'S SIGNATURE", ID_WIDTH_PX / 2, currentY + 18);

  // Student Name
  currentY += 42;
  ctx.fillStyle = '#000000';
  ctx.font = `bold ${Math.round(ID_WIDTH_PX * 0.048)}px ${FONT}`;
  ctx.textAlign = 'center';
  
  // Handle long names
  let displayName = student.name.toUpperCase();
  const maxNameWidth = ID_WIDTH_PX - margin * 2;
  if (ctx.measureText(displayName).width > maxNameWidth) {
    ctx.font = `bold ${Math.round(ID_WIDTH_PX * 0.042)}px ${FONT}`;
    if (ctx.measureText(displayName).width > maxNameWidth) {
      ctx.font = `bold ${Math.round(ID_WIDTH_PX * 0.038)}px ${FONT}`;
    }
  }
  ctx.fillText(displayName, ID_WIDTH_PX / 2, currentY);

  // Bottom section with navy blue curved wave - moved higher
  const waveStartY = currentY + 30; // Reduced from 35 to 30 to compensate
  ctx.fillStyle = '#1a237e';
  ctx.beginPath();
  ctx.moveTo(0, waveStartY + 30);
  
  // Create wave curve
  const waveHeight = 25;
  const waveWidth = ID_WIDTH_PX / 3;
  for (let x = 0; x <= ID_WIDTH_PX; x += waveWidth) {
    ctx.quadraticCurveTo(
      x + waveWidth / 2, waveStartY + 30 - waveHeight,
      x + waveWidth, waveStartY + 30
    );
  }
  ctx.lineTo(ID_WIDTH_PX, ID_HEIGHT_PX);
  ctx.lineTo(0, ID_HEIGHT_PX);
  ctx.closePath();
  ctx.fill();

  // Yellow/Gold accent wave (thinner, on top of navy)
  const yellowWaveY = waveStartY + 12;
  ctx.fillStyle = '#fbbf24';
  ctx.beginPath();
  ctx.moveTo(0, yellowWaveY + 30);
  
  for (let x = 0; x <= ID_WIDTH_PX; x += waveWidth) {
    ctx.quadraticCurveTo(
      x + waveWidth / 2, yellowWaveY + 30 - waveHeight,
      x + waveWidth, yellowWaveY + 30
    );
  }
  ctx.lineTo(ID_WIDTH_PX, yellowWaveY + 70);
  ctx.lineTo(0, yellowWaveY + 70);
  ctx.closePath();
  ctx.fill();

  // Grade & Section on navy background
  const grade = student.grade_level?.startsWith('Grade') ? student.grade_level : `Grade ${student.grade_level || '7'}`;
  const section = stripGradePrefix(student.section || 'Bonifacio');
  
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${Math.round(ID_WIDTH_PX * 0.052)}px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.fillText(`${grade} - ${section}`, margin + 10, waveStartY + 90);
  
  ctx.font = `italic ${Math.round(ID_WIDTH_PX * 0.034)}px ${FONT}`;
  ctx.fillText('Grade & Section', margin + 10, waveStartY + 118);

  // LRN
  ctx.font = `bold ${Math.round(ID_WIDTH_PX * 0.048)}px ${FONT}`;
  ctx.fillText(student.lrn || '123456789012', margin + 10, waveStartY + 165);
  
  ctx.font = `italic ${Math.round(ID_WIDTH_PX * 0.03)}px ${FONT}`;
  ctx.fillText('LRN', margin + 10, waveStartY + 190);

  // QR Code on the right - reduced size for better balance
  try {
    const qrImg = await loadImage(getQRCodeUrl(student));
    const qrSize = Math.round(ID_WIDTH_PX * 0.35); // Reduced from 0.42 to 0.35
    const qrX = ID_WIDTH_PX - qrSize - margin - 5;
    const qrY = waveStartY + 70; // Moved down slightly
    
    // White background for QR
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(qrX - 5, qrY - 5, qrSize + 10, qrSize + 10);
    ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);
  } catch (err) {
    console.error('Failed to load QR code:', err);
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Failed to encode JPG'))),
      'image/jpeg',
      0.95
    );
  });
}

// Render BACK of ID card (PORTRAIT)
async function renderIDCardBack(student: Student, schoolName: string, city: string): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = ID_WIDTH_PX;
  canvas.height = ID_HEIGHT_PX;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');

  // Background - white
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, ID_WIDTH_PX, ID_HEIGHT_PX);

  const margin = 35;
  let currentY = 40;

  // Header: "DEPARTMENT OF EDUCATION"
  ctx.fillStyle = '#1a237e';
  ctx.font = `600 ${Math.round(ID_WIDTH_PX * 0.032)}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText('DEPARTMENT OF EDUCATION', ID_WIDTH_PX / 2, currentY);
  currentY += 35;

  // School Name
  ctx.fillStyle = '#1a237e';
  ctx.font = `bold ${Math.round(ID_WIDTH_PX * 0.052)}px ${FONT}`;
  const schoolNameLines = schoolName.split('\n');
  schoolNameLines.forEach(line => {
    ctx.fillText(line.toUpperCase(), ID_WIDTH_PX / 2, currentY);
    currentY += 35;
  });

  currentY += 15;

  // "IN CASE OF EMERGENCY" header
  ctx.fillStyle = '#1a237e';
  ctx.font = `bold ${Math.round(ID_WIDTH_PX * 0.04)}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText('IN CASE OF EMERGENCY', ID_WIDTH_PX / 2, currentY);
  currentY += 8;

  // Divider line
  ctx.strokeStyle = '#cccccc';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(margin, currentY);
  ctx.lineTo(ID_WIDTH_PX - margin, currentY);
  ctx.stroke();
  currentY += 30;

  // Emergency Contact Details
  const parent = student.parents && student.parents.length > 0 ? student.parents[0] : null;
  const parentName = parent?.name || 'Maria D. Dela Cruz';
  const relationship = parent?.relationship || 'Mother';
  const contact = parent?.contact || '0912 345 6789';
  const address = `Lapasan, ${city || 'Cagayan de Oro City'}`;

  // Contact Person
  ctx.fillStyle = '#666666';
  ctx.font = `400 ${Math.round(ID_WIDTH_PX * 0.03)}px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.fillText('CONTACT PERSON', margin, currentY);
  currentY += 26;
  
  ctx.fillStyle = '#000000';
  ctx.font = `bold ${Math.round(ID_WIDTH_PX * 0.04)}px ${FONT}`;
  ctx.fillText(parentName, margin, currentY);
  currentY += 35;

  // Relationship
  ctx.fillStyle = '#666666';
  ctx.font = `400 ${Math.round(ID_WIDTH_PX * 0.03)}px ${FONT}`;
  ctx.fillText('RELATIONSHIP', margin, currentY);
  currentY += 26;
  
  ctx.fillStyle = '#000000';
  ctx.font = `bold ${Math.round(ID_WIDTH_PX * 0.04)}px ${FONT}`;
  ctx.fillText(relationship, margin, currentY);
  currentY += 35;

  // Contact Number
  ctx.fillStyle = '#666666';
  ctx.font = `400 ${Math.round(ID_WIDTH_PX * 0.03)}px ${FONT}`;
  ctx.fillText('CONTACT NUMBER', margin, currentY);
  currentY += 26;
  
  ctx.fillStyle = '#000000';
  ctx.font = `bold ${Math.round(ID_WIDTH_PX * 0.04)}px ${FONT}`;
  ctx.fillText(contact, margin, currentY);
  currentY += 35;

  // Address
  ctx.fillStyle = '#666666';
  ctx.font = `400 ${Math.round(ID_WIDTH_PX * 0.03)}px ${FONT}`;
  ctx.fillText('ADDRESS', margin, currentY);
  currentY += 26;
  
  ctx.fillStyle = '#000000';
  ctx.font = `bold ${Math.round(ID_WIDTH_PX * 0.04)}px ${FONT}`;
  ctx.fillText(address, margin, currentY);
  currentY += 45;

  // Important Notice
  ctx.fillStyle = '#333333';
  ctx.font = `400 ${Math.round(ID_WIDTH_PX * 0.027)}px ${FONT}`;
  ctx.textAlign = 'left';
  const noticeText = 'This card belongs to the learner named on the front. It cannot be lent to anyone. Please wear it inside the school at all times. If found, please return it to the school office. Valid for S.Y. 2026-2027.';
  currentY = wrapText(ctx, noticeText, margin, currentY, ID_WIDTH_PX - margin * 2, 24);

  currentY += 25;

  // School Principal signature line
  ctx.strokeStyle = '#999999';
  ctx.lineWidth = 1;
  ctx.beginPath();
  const lineMargin = Math.round(ID_WIDTH_PX * 0.18);
  ctx.moveTo(lineMargin, currentY);
  ctx.lineTo(ID_WIDTH_PX - lineMargin, currentY);
  ctx.stroke();
  
  ctx.fillStyle = '#666666';
  ctx.font = `400 ${Math.round(ID_WIDTH_PX * 0.028)}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText('School Principal', ID_WIDTH_PX / 2, currentY + 22);

  // Bottom section with navy blue curved wave
  const waveStartY = ID_HEIGHT_PX - 100;
  ctx.fillStyle = '#1a237e';
  ctx.beginPath();
  ctx.moveTo(0, waveStartY + 15);
  
  // Create wave curve
  const waveHeight = 18;
  const waveWidth = ID_WIDTH_PX / 3;
  for (let x = 0; x <= ID_WIDTH_PX; x += waveWidth) {
    ctx.quadraticCurveTo(
      x + waveWidth / 2, waveStartY + 15 - waveHeight,
      x + waveWidth, waveStartY + 15
    );
  }
  ctx.lineTo(ID_WIDTH_PX, ID_HEIGHT_PX);
  ctx.lineTo(0, ID_HEIGHT_PX);
  ctx.closePath();
  ctx.fill();

  // Yellow/Gold accent wave
  const yellowWaveY = waveStartY + 3;
  ctx.fillStyle = '#fbbf24';
  ctx.beginPath();
  ctx.moveTo(0, yellowWaveY + 15);
  
  for (let x = 0; x <= ID_WIDTH_PX; x += waveWidth) {
    ctx.quadraticCurveTo(
      x + waveWidth / 2, yellowWaveY + 15 - waveHeight,
      x + waveWidth, yellowWaveY + 15
    );
  }
  ctx.lineTo(ID_WIDTH_PX, yellowWaveY + 45);
  ctx.lineTo(0, yellowWaveY + 45);
  ctx.closePath();
  ctx.fill();

  // "Learner Identification Card" text in italics
  ctx.fillStyle = '#ffffff';
  ctx.font = `italic ${Math.round(ID_WIDTH_PX * 0.038)}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText('Learner Identification Card', ID_WIDTH_PX / 2, waveStartY + 55);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Failed to encode JPG'))),
      'image/jpeg',
      0.95
    );
  });
}

// Build PDF with multiple ID cards (front and back)
function buildIDCardsPDF(fronts: Uint8Array[], backs: Uint8Array[]): Blob {
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let pos = 0;

  const push = (b: Uint8Array | string) => {
    const u = typeof b === 'string' ? enc.encode(b) : b;
    chunks.push(u);
    pos += u.length;
  };

  const startObj = (id: number) => {
    offsets[id] = pos;
    push(`${id} 0 obj\n`);
  };

  const totalImages = fronts.length + backs.length;
  const pageCount = Math.max(1, Math.ceil(totalImages / CARDS_PER_PAGE));
  const pageObjId = (p: number) => 3 + totalImages + p * 2;
  const contentObjId = (p: number) => 4 + totalImages + p * 2;
  const totalObjs = 2 + totalImages + pageCount * 2;

  push('%PDF-1.4\n%\u00e2\u00e3\u00cf\u00d3\n');

  // Catalog
  startObj(1);
  push('<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

  // Pages
  startObj(2);
  const kids = Array.from({ length: pageCount }, (_, p) => `${pageObjId(p)} 0 R`).join(' ');
  push(`<< /Type /Pages /Kids [${kids}] /Count ${pageCount} >>\nendobj\n`);

  // Image objects (fronts then backs)
  const allImages = [...fronts, ...backs];
  for (let i = 0; i < totalImages; i++) {
    startObj(3 + i);
    push(`<< /Type /XObject /Subtype /Image /Width ${ID_WIDTH_PX} /Height ${ID_HEIGHT_PX} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${allImages[i].length} >>\nstream\n`);
    push(allImages[i]);
    push('\nendstream\nendobj\n');
  }

  // Pages with content
  const leftMargin = (A4_W_PT - CARDS_PER_ROW * ID_W_PT) / 2;
  const topMargin = (A4_H_PT - CARDS_PER_COL * ID_H_PT) / 2;

  for (let p = 0; p < pageCount; p++) {
    const first = p * CARDS_PER_PAGE;
    const last = Math.min(first + CARDS_PER_PAGE, totalImages);
    let content = '';
    let xobjs = '';

    for (let i = first; i < last; i++) {
      const k = i - first;
      const col = k % CARDS_PER_ROW;
      const row = Math.floor(k / CARDS_PER_ROW);
      const x = leftMargin + col * ID_W_PT;
      const y = A4_H_PT - topMargin - (row + 1) * ID_H_PT;

      xobjs += `/Im${i} ${3 + i} 0 R `;
      content += `q ${ID_W_PT.toFixed(3)} 0 0 ${ID_H_PT.toFixed(3)} ${x.toFixed(3)} ${y.toFixed(3)} cm /Im${i} Do Q\n`;
    }

    // Cut lines
    content += 'q 0.3 w 0.7 G [2 2] 0 d\n';
    for (let i = first; i < last; i++) {
      const k = i - first;
      const col = k % CARDS_PER_ROW;
      const row = Math.floor(k / CARDS_PER_ROW);
      const x = leftMargin + col * ID_W_PT;
      const y = A4_H_PT - topMargin - (row + 1) * ID_H_PT;
      content += `${x.toFixed(3)} ${y.toFixed(3)} ${ID_W_PT.toFixed(3)} ${ID_H_PT.toFixed(3)} re S\n`;
    }
    content += 'Q\n';

    startObj(pageObjId(p));
    push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4_W_PT.toFixed(3)} ${A4_H_PT.toFixed(3)}] /Resources << /XObject << ${xobjs}>> >> /Contents ${contentObjId(p)} 0 R >>\nendobj\n`);

    const contentBytes = enc.encode(content);
    startObj(contentObjId(p));
    push(`<< /Length ${contentBytes.length} >>\nstream\n`);
    push(contentBytes);
    push('\nendstream\nendobj\n');
  }

  // Cross-reference table
  const xrefPos = pos;
  let xref = `xref\n0 ${totalObjs + 1}\n0000000000 65535 f \n`;
  for (let id = 1; id <= totalObjs; id++) {
    xref += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
  }
  push(xref);
  push(`trailer\n<< /Size ${totalObjs + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`);

  return new Blob(chunks as unknown as BlobPart[], { type: 'application/pdf' });
}

// Main component
const StudentIDGeneratorModal = memo(function StudentIDGeneratorModal({ open, onClose, students, teacher }: Props) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const accent = isDark ? '#4ade80' : '#1a237e';

  const [step, setStep] = useState<'select' | 'generate'>('select');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState('');
  const [previews, setPreviews] = useState<{ student: Student; frontUrl: string; backUrl: string }[]>([]);
  const [schoolLogo, setSchoolLogo] = useState<string | null>(null);
  const [schoolName, setSchoolName] = useState('LAPASAN NATIONAL\nHIGH SCHOOL');
  const [city, setCity] = useState('Cagayan de Oro');
  
  const [logoUploadDialog, setLogoUploadDialog] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Fetch school logo and settings on mount
  useEffect(() => {
    if (open) {
      api.get('/admin/school-logo').then(r => {
        setSchoolLogo(r.data.logo);
      }).catch(() => {});

      api.get('/admin/school-settings').then(r => {
        if (r.data.school_name) {
          // Split long school names into 2 lines
          const name = r.data.school_name.toUpperCase();
          if (name.length > 30) {
            const words = name.split(' ');
            const mid = Math.ceil(words.length / 2);
            setSchoolName(words.slice(0, mid).join(' ') + '\n' + words.slice(mid).join(' '));
          } else {
            setSchoolName(name);
          }
        }
        // Extract city from division or municipality
        if (r.data.division) {
          const cityMatch = r.data.division.match(/(.+?)\s+City/i);
          if (cityMatch) {
            setCity(cityMatch[0]);
          }
        }
      }).catch(() => {});
    }
  }, [open]);

  // Reset state when modal opens/closes
  useMemo(() => {
    if (open) {
      setStep('select');
      setSelectedIds(new Set());
      setPreviews([]);
      setProgress({ done: 0, total: 0 });
      setError('');
    }
  }, [open]);

  const toggleStudent = useCallback((id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    if (selectedIds.size === students.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(students.map(s => s.id)));
    }
  }, [selectedIds.size, students]);

  const selectedStudents = useMemo(() => {
    return students.filter(s => selectedIds.has(s.id));
  }, [students, selectedIds]);

  // Handle logo upload
  const handleLogoSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError('Logo file size must be less than 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      setLogoPreview(e.target?.result as string);
      setLogoUploadDialog(true);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleLogoUpload = useCallback(async () => {
    if (!logoPreview) return;
    
    setUploadingLogo(true);
    try {
      const response = await api.post('/admin/school-logo/upload', {
        logo_base64: logoPreview,
      });
      setSchoolLogo(response.data.path);
      setLogoUploadDialog(false);
      setLogoPreview(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to upload logo');
    } finally {
      setUploadingLogo(false);
    }
  }, [logoPreview]);

  // Generate IDs for selected students
  const handleGenerate = useCallback(async () => {
    if (selectedStudents.length === 0) return;
    
    setStep('generate');
    setGenerating(true);
    setError('');
    setProgress({ done: 0, total: selectedStudents.length * 2 }); // front + back
    const results: { student: Student; frontUrl: string; backUrl: string }[] = [];

    try {
      for (let i = 0; i < selectedStudents.length; i++) {
        const student = selectedStudents[i];
        try {
          // Generate front
          const frontBlob = await renderIDCardFront(student, schoolLogo, schoolName, city);
          const frontUrl = URL.createObjectURL(frontBlob);
          setProgress({ done: i * 2 + 1, total: selectedStudents.length * 2 });
          
          // Generate back
          const backBlob = await renderIDCardBack(student, schoolName, city);
          const backUrl = URL.createObjectURL(backBlob);
          setProgress({ done: i * 2 + 2, total: selectedStudents.length * 2 });
          
          results.push({ student, frontUrl, backUrl });
        } catch (err) {
          console.error('Failed to render ID for', student.name, err);
        }
      }
      setPreviews(results);
    } catch (err: any) {
      setError(err.message || 'Failed to generate ID cards');
    } finally {
      setGenerating(false);
    }
  }, [selectedStudents, schoolLogo, schoolName, city]);

  const handleDownloadImages = useCallback(async () => {
    if (previews.length === 0) return;
    
    setGenerating(true);
    try {
      // Create a zip-like experience by downloading each card
      for (let i = 0; i < previews.length; i++) {
        const { student } = previews[i];
        
        // Download Front
        const frontBlob = await renderIDCardFront(student, schoolLogo, schoolName, city);
        const frontUrl = URL.createObjectURL(frontBlob);
        const aFront = document.createElement('a');
        aFront.href = frontUrl;
        aFront.download = `${student.name.replace(/\s+/g, '_')}_ID_Front.jpg`;
        document.body.appendChild(aFront);
        aFront.click();
        document.body.removeChild(aFront);
        setTimeout(() => URL.revokeObjectURL(frontUrl), 100);
        
        // Small delay between downloads
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Download Back
        const backBlob = await renderIDCardBack(student, schoolName, city);
        const backUrl = URL.createObjectURL(backBlob);
        const aBack = document.createElement('a');
        aBack.href = backUrl;
        aBack.download = `${student.name.replace(/\s+/g, '_')}_ID_Back.jpg`;
        document.body.appendChild(aBack);
        aBack.click();
        document.body.removeChild(aBack);
        setTimeout(() => URL.revokeObjectURL(backUrl), 100);
        
        // Delay before next student
        if (i < previews.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to download images');
    } finally {
      setGenerating(false);
    }
  }, [previews, schoolLogo, schoolName, city]);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  if (!open) return null;

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="lg"
        fullWidth
        PaperProps={{ sx: { borderRadius: '12px', maxHeight: '90vh' } }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
          <Box>
            <Typography variant="h6" sx={{ fontFamily: FONT, fontWeight: 700 }}>
              {step === 'select' ? 'Select Students' : 'School ID Cards'}
            </Typography>
            <Typography variant="body2" sx={{ fontFamily: FONT, color: 'text.secondary' }}>
              {step === 'select' 
                ? `${students.length} student${students.length !== 1 ? 's' : ''} available • ${selectedIds.size} selected`
                : `${selectedStudents.length} student${selectedStudents.length !== 1 ? 's' : ''} • Front & Back`
              }
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            {step === 'select' && (
              <Tooltip title="Click to upload/change school logo">
                <Box
                  component="label"
                  sx={{
                    position: 'relative',
                    display: 'inline-block',
                    cursor: 'pointer',
                    '&:hover .upload-overlay': {
                      opacity: 1,
                    },
                  }}
                >
                  <Avatar
                    src={schoolLogo ? `${getApiBaseUrl().replace('/api', '')}${schoolLogo}` : undefined}
                    sx={{ width: 48, height: 48, bgcolor: '#1a237e' }}
                  >
                    🏫
                  </Avatar>
                  <Box
                    className="upload-overlay"
                    sx={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: 48,
                      height: 48,
                      borderRadius: '50%',
                      bgcolor: 'rgba(0,0,0,0.6)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: 0,
                      transition: 'opacity 0.2s',
                    }}
                  >
                    <PhotoCamera sx={{ color: '#fff', fontSize: 20 }} />
                  </Box>
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={handleLogoSelect}
                  />
                </Box>
              </Tooltip>
            )}
            <IconButton onClick={onClose} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>

        {generating && (
          <Box sx={{ px: 3, pb: 2 }}>
            <LinearProgress
              variant="determinate"
              value={progress.total > 0 ? (progress.done / progress.total) * 100 : 0}
              sx={{ height: 8, borderRadius: 4 }}
            />
            <Typography variant="body2" sx={{ fontFamily: FONT, textAlign: 'center', mt: 1, color: 'text.secondary' }}>
              Generating... {progress.done}/{progress.total}
            </Typography>
          </Box>
        )}

        {error && (
          <Box sx={{ px: 3, pb: 2 }}>
            <Alert severity="error" onClose={() => setError('')}>{error}</Alert>
          </Box>
        )}

        <DialogContent sx={{ minHeight: 400 }}>
          {step === 'select' ? (
            // SELECTION SCREEN
            <Box>
              <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={selectedIds.size === students.length && students.length > 0}
                      indeterminate={selectedIds.size > 0 && selectedIds.size < students.length}
                      onChange={toggleAll}
                    />
                  }
                  label={
                    <Typography sx={{ fontFamily: FONT, fontWeight: 600 }}>
                      Select All ({students.length})
                    </Typography>
                  }
                />
              </Box>

              <Divider sx={{ mb: 2 }} />

              {students.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 6 }}>
                  <PersonIcon sx={{ fontSize: 60, color: 'text.disabled', mb: 2 }} />
                  <Typography variant="h6" sx={{ fontFamily: FONT, color: 'text.secondary' }}>
                    No students found
                  </Typography>
                  <Typography variant="body2" sx={{ fontFamily: FONT, color: 'text.secondary', mt: 1 }}>
                    Please add students first before generating ID cards
                  </Typography>
                </Box>
              ) : (
                <List sx={{ maxHeight: 400, overflow: 'auto' }}>
                  {students.map((student) => (
                    <ListItem key={student.id} disablePadding>
                      <ListItemButton
                        onClick={() => toggleStudent(student.id)}
                        sx={{
                          borderRadius: 1,
                          mb: 0.5,
                          '&:hover': { bgcolor: 'action.hover' },
                        }}
                      >
                        <ListItemIcon>
                          <Checkbox
                            edge="start"
                            checked={selectedIds.has(student.id)}
                            tabIndex={-1}
                            disableRipple
                          />
                        </ListItemIcon>
                        <Avatar
                          src={student.photo ? `${getApiBaseUrl().replace('/api', '')}${student.photo}` : undefined}
                          sx={{ mr: 2, width: 40, height: 40 }}
                        >
                          {student.name?.charAt(0) || '?'}
                        </Avatar>
                        <ListItemText
                          primary={
                            <Typography sx={{ fontFamily: FONT, fontWeight: 600 }}>
                              {student.name || 'Unnamed'}
                            </Typography>
                          }
                          secondary={
                            <Box component="span">
                              <Typography
                                component="span"
                                variant="body2"
                                sx={{ fontFamily: FONT, color: 'text.secondary', display: 'block' }}
                              >
                                LRN: {student.lrn || 'N/A'}
                              </Typography>
                              <Typography
                                component="span"
                                variant="body2"
                                sx={{ fontFamily: FONT, color: 'text.secondary' }}
                              >
                                {student.grade_level || ''} {student.section ? `- ${student.section}` : ''}
                              </Typography>
                            </Box>
                          }
                        />
                      </ListItemButton>
                    </ListItem>
                  ))}
                </List>
              )}
            </Box>
          ) : (
            // GENERATION SCREEN
            previews.length === 0 && !generating ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <CircularProgress />
                <Typography variant="body2" sx={{ mt: 2, fontFamily: FONT }}>
                  Loading...
                </Typography>
              </Box>
            ) : (
              <Grid container spacing={2}>
                {previews.map(({ student, frontUrl, backUrl }) => (
                  <Grid item xs={12} key={student.id}>
                    <Box>
                      <Typography variant="subtitle1" sx={{ fontFamily: FONT, fontWeight: 600, mb: 1 }}>
                        {student.name} - LRN: {student.lrn}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                        {/* Front */}
                        <Box
                          sx={{
                            border: '1px solid',
                            borderColor: 'divider',
                            borderRadius: '8px',
                            overflow: 'hidden',
                            flex: '1 1 300px',
                            maxWidth: '400px',
                            '&:hover': { borderColor: accent },
                          }}
                        >
                          <img
                            src={frontUrl}
                            alt={`ID Front - ${student.name}`}
                            style={{ width: '100%', display: 'block' }}
                          />
                          <Box sx={{ p: 1, bgcolor: 'background.paper', textAlign: 'center' }}>
                            <Typography variant="caption" sx={{ fontFamily: FONT, fontWeight: 600 }}>
                              FRONT
                            </Typography>
                          </Box>
                        </Box>
                        
                        {/* Back */}
                        <Box
                          sx={{
                            border: '1px solid',
                            borderColor: 'divider',
                            borderRadius: '8px',
                            overflow: 'hidden',
                            flex: '1 1 300px',
                            maxWidth: '400px',
                            '&:hover': { borderColor: accent },
                          }}
                        >
                          <img
                            src={backUrl}
                            alt={`ID Back - ${student.name}`}
                            style={{ width: '100%', display: 'block' }}
                          />
                          <Box sx={{ p: 1, bgcolor: 'background.paper', textAlign: 'center' }}>
                            <Typography variant="caption" sx={{ fontFamily: FONT, fontWeight: 600 }}>
                              BACK
                            </Typography>
                          </Box>
                        </Box>
                      </Box>
                    </Box>
                    <Divider sx={{ my: 2 }} />
                  </Grid>
                ))}
              </Grid>
            )
          )}
        </DialogContent>

        <Divider />

        <DialogActions sx={{ px: 3, py: 2 }}>
          {step === 'select' ? (
            <>
              <Button
                onClick={onClose}
                variant="outlined"
                sx={{ fontFamily: FONT, borderColor: 'divider', color: 'text.secondary' }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleGenerate}
                variant="contained"
                disabled={selectedIds.size === 0}
                sx={{
                  fontFamily: FONT,
                  bgcolor: accent,
                  color: '#fff',
                  '&:hover': { bgcolor: isDark ? '#22c55e' : '#0d1757' },
                }}
              >
                Generate School IDs ({selectedIds.size})
              </Button>
            </>
          ) : (
            <>
              <Button
                onClick={() => setStep('select')}
                variant="outlined"
                disabled={generating}
                sx={{ fontFamily: FONT, borderColor: 'divider', color: 'text.secondary' }}
              >
                Back
              </Button>
              <Button
                onClick={handlePrint}
                variant="outlined"
                startIcon={<PrintIcon />}
                disabled={previews.length === 0 || generating}
                sx={{
                  fontFamily: FONT,
                  borderColor: isDark ? 'rgba(74,222,128,0.4)' : 'rgba(26,35,126,0.4)',
                  color: accent,
                }}
              >
                Print
              </Button>
              <Button
                onClick={handleDownloadImages}
                variant="contained"
                startIcon={generating ? <CircularProgress size={20} color="inherit" /> : <DownloadIcon />}
                disabled={previews.length === 0 || generating}
                sx={{
                  fontFamily: FONT,
                  bgcolor: accent,
                  color: '#fff',
                  '&:hover': { bgcolor: isDark ? '#22c55e' : '#0d1757' },
                }}
              >
                {generating ? 'Downloading...' : 'Download Images (JPG)'}
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>

      {/* Logo Upload Dialog */}
      <Dialog
        open={logoUploadDialog}
        onClose={() => !uploadingLogo && setLogoUploadDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ bgcolor: '#1a237e', color: '#fff', display: 'flex', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="h6" fontWeight={700}>Upload School Logo</Typography>
          </Box>
          <IconButton 
            onClick={() => setLogoUploadDialog(false)}
            disabled={uploadingLogo}
            sx={{ color: '#fff' }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          {logoPreview && (
            <Box sx={{ textAlign: 'center', mb: 2 }}>
              <Avatar
                src={logoPreview}
                sx={{ width: 200, height: 200, mx: 'auto', mb: 2 }}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button
            onClick={() => setLogoUploadDialog(false)}
            disabled={uploadingLogo}
            variant="outlined"
          >
            Cancel
          </Button>
          <Button
            onClick={handleLogoUpload}
            disabled={uploadingLogo || !logoPreview}
            variant="contained"
            startIcon={uploadingLogo ? <CircularProgress size={20} color="inherit" /> : null}
            sx={{ bgcolor: '#1a237e', '&:hover': { bgcolor: '#0d1757' } }}
          >
            {uploadingLogo ? 'Uploading...' : 'Upload Logo'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
});

export default StudentIDGeneratorModal;
