const express = require('express');
const cors = require('cors');
require('dotenv').config();

// Import database connection (this will also create schema and tables)
require('./models/db');

const contactRoutes = require('./routes/contacts');
const emailRoutes = require('./routes/emails');
const userRoutes = require('./routes/users');

const app = express();

// ✅ UPDATED: Proper CORS configuration with specific origins
app.use(cors({
  origin: [
    'http://localhost:3000',                              // Local React dev
    'http://localhost:5173',                              // Vite dev server
    'https://automailer-by-jay.onrender.com',            // ✅ Your frontend URL
    'https://servise-automailer-1.onrender.com'          // ✅ Your backend URL
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Requested-With',
    'Accept',
    'Origin'
  ],
  optionsSuccessStatus: 200 // For legacy browser support
}));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true })); 

// API routes
app.use('/api', contactRoutes);
app.use('/api', userRoutes);
app.use('/api/emails', emailRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    time: new Date(),
    database: 'Connected to Render PostgreSQL',
    environment: process.env.NODE_ENV || 'development',
    corsOrigins: [
      'https://automailer-by-jay.onrender.com',
      'https://servise-automailer-1.onrender.com'
    ],
    endpoints: [
      // Contact endpoints
      'GET /api/getAllContacts',
      'POST /api/addContact',
      'PUT /api/updateContact/:id',
      'DELETE /api/deleteContact/:id (soft delete)',
      'GET /api/getDeletedContacts',
      'POST /api/restoreContact/:id',
      'DELETE /api/permanentDelete/:id',
      
      // User profile endpoints
      'GET /api/user/profile',
      'POST /api/user/profile',
      'PUT /api/user/profile',
      'GET /api/user/profile/check',
      'DELETE /api/user/profile/:id',
      
      // Email endpoints
      'POST /api/emails/bulk-send',
      'POST /api/emails/send-individual',
      'GET /api/emails/logs',
      'GET /api/emails/stats',
      'GET /api/emails/status/:emailId',
      'POST /api/emails/test-auth'
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
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🗄️  Database: Render PostgreSQL`);
  console.log(`🔗 CORS Configuration:`);
  console.log(`   ✅ Frontend: https://automailer-by-jay.onrender.com`);
  console.log(`   ✅ Backend:  https://servise-automailer-1.onrender.com`);
  console.log(`   ✅ Local:    http://localhost:3000, http://localhost:5173`);
  console.log(`📍 API Endpoints:`);
  console.log(`   📋 Contacts:`);
  console.log(`      GET    /api/getAllContacts`);
  console.log(`      POST   /api/addContact`);
  console.log(`      PUT    /api/updateContact/:id`);
  console.log(`      DELETE /api/deleteContact/:id (soft)`);
  console.log(`      GET    /api/getDeletedContacts`);
  console.log(`      POST   /api/restoreContact/:id`);
  console.log(`      DELETE /api/permanentDelete/:id`);
  console.log(`   👤 User Profile:`);
  console.log(`      GET    /api/user/profile`);
  console.log(`      POST   /api/user/profile`);
  console.log(`      PUT    /api/user/profile`);
  console.log(`      GET    /api/user/profile/check`);
  console.log(`      DELETE /api/user/profile/:id`);
  console.log(`   📧 Emails:`);
  console.log(`      POST   /api/emails/bulk-send`);
  console.log(`      POST   /api/emails/send-individual`);
  console.log(`      GET    /api/emails/logs`);
  console.log(`      GET    /api/emails/stats`);
  console.log(`      GET    /api/emails/status/:emailId`);
  console.log(`      POST   /api/emails/test-auth`);
  console.log(`   🔍 Health Check:`);
  console.log(`      GET    /api/health`);
  console.log(`────────────────────────────────────────────────`);
});
