const express = require('express');
const router = express.Router();
const pool = require('../models/db');

/* =========================================================
   HELPERS
   ========================================================= */
const pickUserCols = `
  id, full_name, email, phone, linkedin, github, 
  location, availability, experience_years, job_role,
  skills, resume_filename, created_at, updated_at
`;

/* =========================================================
   GET - User Profile
   ========================================================= */
router.get('/user/profile', async (req, res) => {
  try {
    // For now, we'll get the first profile (single user system)
    // In multi-user system, you'd get by user_id from auth token
    const { rows } = await pool.query(
      `SELECT ${pickUserCols}
       FROM automailer_schema.user_profiles
       ORDER BY created_at DESC
       LIMIT 1`
    );

    if (rows.length === 0) {
      return res.json({ 
        success: true, 
        data: null,
        message: 'No profile found' 
      });
    }

    // ✅ FIXED: Map job_role to currentRole for frontend
    const userData = {
      ...rows[0],
      currentRole: rows[0].job_role
    };

    res.json({ 
      success: true, 
      data: userData 
    });
  } catch (err) {
    console.error('getUserProfile:', err);
    res.status(500).json({ 
      success: false, 
      error: err.message 
    });
  }
});

/* =========================================================
   POST - Save/Create User Profile
   ========================================================= */
router.post('/user/profile', async (req, res) => {
  const { 
    fullName, email, phone, linkedin, github, 
    location, availability, experienceYears, 
    currentRole, skills 
  } = req.body;

  // Validation
  if (![fullName, email, phone, location, availability, experienceYears].every(Boolean) || !skills?.length) {
    return res.status(400).json({ 
      success: false, 
      message: 'Missing required fields' 
    });
  }

  try {
    // Check if profile exists
    const existingProfile = await pool.query(
      'SELECT id FROM automailer_schema.user_profiles WHERE email = $1',
      [email]
    );

    let result;

    if (existingProfile.rows.length > 0) {
      // ✅ FIXED: Update existing profile (using job_role)
      const { rows } = await pool.query(
        `UPDATE automailer_schema.user_profiles
         SET full_name=$1, phone=$2, linkedin=$3, github=$4,
             location=$5, availability=$6, experience_years=$7,
             job_role=$8, skills=$9, updated_at=CURRENT_TIMESTAMP
         WHERE email=$10
         RETURNING ${pickUserCols}`,
        [fullName, phone, linkedin, github, location, availability, 
         experienceYears, currentRole, skills, email]
      );
      result = rows[0];
      console.log('✅ User profile updated:', email);
    } else {
      // ✅ FIXED: Create new profile (using job_role)
      const { rows } = await pool.query(
        `INSERT INTO automailer_schema.user_profiles
         (full_name, email, phone, linkedin, github, location, 
          availability, experience_years, job_role, skills)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING ${pickUserCols}`,
        [fullName, email, phone, linkedin, github, location, 
         availability, experienceYears, currentRole, skills]
      );
      result = rows[0];
      console.log('✅ User profile created:', email);
    }

    // ✅ Map job_role to currentRole for frontend response
    const responseData = {
      ...result,
      currentRole: result.job_role
    };

    res.status(201).json({ 
      success: true, 
      data: responseData,
      message: existingProfile.rows.length > 0 ? 'Profile updated' : 'Profile created'
    });

  } catch (err) {
    console.error('saveUserProfile:', err);
    if (err.code === '23505') { // Unique constraint violation
      res.status(409).json({ 
        success: false, 
        message: 'Email already exists' 
      });
    } else {
      res.status(500).json({ 
        success: false, 
        error: err.message 
      });
    }
  }
});

/* =========================================================
   PUT - Update User Profile  
   ========================================================= */
router.put('/user/profile', async (req, res) => {
  const { 
    fullName, email, phone, linkedin, github, 
    location, availability, experienceYears, 
    currentRole, skills 
  } = req.body;

  try {
    // ✅ FIXED: Update query using job_role
    const { rows } = await pool.query(
      `UPDATE automailer_schema.user_profiles
       SET full_name=$1, phone=$2, linkedin=$3, github=$4,
           location=$5, availability=$6, experience_years=$7,
           job_role=$8, skills=$9, updated_at=CURRENT_TIMESTAMP
       WHERE email=$10
       RETURNING ${pickUserCols}`,
      [fullName, phone, linkedin, github, location, availability, 
       experienceYears, currentRole, skills, email]
    );

    if (!rows.length) {
      return res.status(404).json({ 
        success: false, 
        message: 'Profile not found' 
      });
    }

    // ✅ Map job_role to currentRole for frontend response
    const responseData = {
      ...rows[0],
      currentRole: rows[0].job_role
    };

    res.json({ 
      success: true, 
      data: responseData,
      message: 'Profile updated successfully'
    });

  } catch (err) {
    console.error('updateUserProfile:', err);
    res.status(500).json({ 
      success: false, 
      error: err.message 
    });
  }
});

/* =========================================================
   GET - Check if Profile Exists
   ========================================================= */
router.get('/user/profile/check', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT COUNT(*) as count FROM automailer_schema.user_profiles'
    );

    const exists = parseInt(rows[0].count) > 0;

    res.json({ 
      success: true, 
      exists: exists,
      count: parseInt(rows[0].count)
    });

  } catch (err) {
    console.error('checkProfileExists:', err);
    res.status(500).json({ 
      success: false, 
      error: err.message 
    });
  }
});

/* =========================================================
   DELETE - Delete User Profile (with cascade)
   ========================================================= */
router.delete('/user/profile/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // First delete related email logs
    const emailLogsDel = await client.query(
      'DELETE FROM automailer_schema.email_logs WHERE user_profile_id = $1',
      [req.params.id]
    );
    
    // Then delete the user profile
    const { rows } = await client.query(
      'DELETE FROM automailer_schema.user_profiles WHERE id = $1 RETURNING full_name, email',
      [req.params.id]
    );

    if (!rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ 
        success: false, 
        message: 'Profile not found' 
      });
    }

    await client.query('COMMIT');
    
    res.json({ 
      success: true, 
      message: 'Profile and related email logs deleted successfully',
      data: rows[0],
      deletedEmailLogs: emailLogsDel.rowCount
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('deleteUserProfile:', err);
    res.status(500).json({ 
      success: false, 
      error: err.message 
    });
  } finally {
    client.release();
  }
});

module.exports = router;
