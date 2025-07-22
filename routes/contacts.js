const express = require('express');
const router = express.Router();
const pool = require('../models/db');

// GET /api/getAllContacts (NEW ENDPOINT)
router.get('/getAllContacts', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM automailer_schema.contacts ORDER BY created_at DESC'
    );
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Get contacts error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// POST /api/addContact (NEW ENDPOINT)
router.post('/addContact', async (req, res) => {
  try {
    const { hrName, email, companyName, jobPosition, requiredSkills } = req.body;
    
    // Validate required fields
    if (!hrName || !email || !companyName || !jobPosition || !requiredSkills) {
      return res.status(400).json({
        success: false,
        error: 'All fields are required'
      });
    }
    
    const result = await pool.query(
      `INSERT INTO automailer_schema.contacts (hr_name, email, company_name, job_position, required_skills) 
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [hrName, email, companyName, jobPosition, requiredSkills]
    );
    
    console.log('✅ CONTACT ADDED TO DB:', result.rows[0]);
    
    res.status(201).json({
      success: true,
      message: 'Contact added successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Add contact error:', error);
    
    // Handle duplicate email error
    if (error.code === '23505') {
      return res.status(400).json({
        success: false,
        error: 'Contact with this email already exists'
      });
    }
    
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// DELETE /api/deleteContact/:id (NEW ENDPOINT)
router.delete('/deleteContact/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      'DELETE FROM automailer_schema.contacts WHERE id = $1 RETURNING *', 
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Contact not found'
      });
    }
    
    console.log('🗑️ CONTACT DELETED FROM DB:', result.rows[0]);
    
    res.json({
      success: true,
      message: 'Contact deleted successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Delete contact error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Keep existing routes for backward compatibility
router.get('/', async (req, res) => {
  res.redirect('/getAllContacts');
});

router.post('/', async (req, res) => {
  res.redirect(307, '/addContact'); // 307 preserves POST method
});

module.exports = router;
