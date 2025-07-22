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

// API routes
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
      'PUT /api/updateContact/:id',
      'DELETE /api/deleteContact/:id (soft delete)',
      'GET /api/getDeletedContacts',
      'POST /api/restoreContact/:id',
      'DELETE /api/permanentDelete/:id',
      'POST /api/emails/bulk-send',
      'GET /api/emails/logs',
      'GET /api/emails/stats'
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
  console.log(`📍 API Endpoints:`);
  console.log(`   📋 Contacts:`);
  console.log(`      GET  /api/getAllContacts`);
  console.log(`      POST /api/addContact`);
  console.log(`      PUT  /api/updateContact/:id`);
  console.log(`      DELETE /api/deleteContact/:id (soft)`);
  console.log(`      GET  /api/getDeletedContacts`);
  console.log(`      POST /api/restoreContact/:id`);
  console.log(`   📧 Emails:`);
  console.log(`      POST /api/emails/bulk-send`);
  console.log(`      GET  /api/emails/logs`);
  console.log(`      GET  /api/emails/stats`);
});
