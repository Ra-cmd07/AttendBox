import { memo } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Box, Typography, IconButton, useTheme,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DescriptionIcon from '@mui/icons-material/Description';

const FONT = '"Nunito", sans-serif';

interface Props {
  open: boolean;
  onClose: () => void;
  teacherSection?: string;
}

const SF1GenerateModal = memo(function SF1GenerateModal({ open, onClose, teacherSection }: Props) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const accent = isDark ? '#4ade80' : '#2d5016';

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { borderRadius: '12px' } }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <DescriptionIcon sx={{ color: accent }} />
          <Box>
            <Typography variant="h6" sx={{ fontFamily: FONT, fontWeight: 700 }}>
              Generate SF1 Report
            </Typography>
            <Typography variant="body2" sx={{ fontFamily: FONT, color: 'text.secondary' }}>
              {teacherSection || 'All students'}
            </Typography>
          </Box>
        </Box>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent>
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <DescriptionIcon sx={{ fontSize: 80, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" sx={{ fontFamily: FONT, mb: 1 }}>
            SF1 Generator
          </Typography>
          <Typography variant="body2" sx={{ fontFamily: FONT, color: 'text.secondary' }}>
            SF1 (School Form 1) generation feature will be implemented here.
            <br />
            This will create the official DepEd enrollment registry report.
          </Typography>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button
          onClick={onClose}
          variant="outlined"
          sx={{ fontFamily: FONT, borderColor: 'divider', color: 'text.secondary' }}
        >
          Close
        </Button>
        <Button
          onClick={onClose}
          variant="contained"
          disabled
          sx={{
            fontFamily: FONT,
            bgcolor: accent,
            color: isDark ? '#1a1a1a' : '#fff',
          }}
        >
          Generate SF1
        </Button>
      </DialogActions>
    </Dialog>
  );
});

export default SF1GenerateModal;
