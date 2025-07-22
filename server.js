const express = require('express');
const cors = require('cors');
require('dotenv').config();

const contactRoutes = require('./routes/contacts');
const emailRoutes = require('./routes/emails');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// NEW: Direct API routes (no /contacts prefix)
app.use('/api', contactRoutes);
app.use('/api/emails', emailRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    time: new Date(),
    endpoints: [
      'GET /api/getAllContacts',
      'POST /api/addContact',
      'DELETE /api/deleteContact/:id',
      'POST /api/emails/bulk-send'
    ]
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 New API Endpoints:`);
  console.log(`   GET  /api/getAllContacts`);
  console.log(`   POST /api/addContact`);
  console.log(`   DELETE /api/deleteContact/:id`);
  console.log(`   POST /api/emails/bulk-send`);
});
