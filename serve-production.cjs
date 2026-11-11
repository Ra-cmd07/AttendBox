const express = require('express');
const https = require('https');
const fs = require('fs');
const path = require('path');

const app = express();

// Serve static files from the dist folder
app.use(express.static(path.join(__dirname, 'dist')));

// Handle React Router - send all requests to index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// HTTPS options
const httpsOptions = {
  key: fs.readFileSync(path.join(__dirname, 'certs', 'localhost-key.pem')),
  cert: fs.readFileSync(path.join(__dirname, 'certs', 'localhost.pem'))
};

// Start HTTPS server
const PORT = 3000;
https.createServer(httpsOptions, app).listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Production server running at https://10.67.214.63:${PORT}`);
  console.log(`   Also available at https://localhost:${PORT}`);
});
