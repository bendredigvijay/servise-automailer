const express = require('express');
const router = express.Router();
const multer = require('multer');
const nodemailer = require('nodemailer');
const pool = require('../models/db');
const fs = require('fs');
const { getEmailTemplate } = require('../templates/emailTemplate');

// ✅ DEBUG: Check environment variables on startup
console.log('🔍 EMAIL CONFIG DEBUG:', {
  emailUser: process.env.EMAIL_USER,
  emailPassExists: !!process.env.EMAIL_PASS,
  emailPassLength: process.env.EMAIL_PASS ? process.env.EMAIL_PASS.length : 0,
  emailPassPreview: process.env.EMAIL_PASS ? process.env.EMAIL_PASS.substring(0, 8) + '***' : 'NOT SET'
});

// File upload setup
const storage = multer.diskStorage({
  destination: './uploads/',
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }
});

// ✅ FIXED: createTransport (not createTransporter)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  pool: true,
  maxConnections: 1,
  rateDelta: 20000,
  rateLimit: 5
});

// ✅ Verify transporter on startup
transporter.verify((error, success) => {
  if (error) {
    console.log('❌ Gmail transporter verification failed:', error.message);
  } else {
    console.log('✅ Gmail transporter ready to send emails');
    console.log('📧 Connected with:', process.env.EMAIL_USER);
  }
});

// ✅ TEST AUTH ROUTE
router.post('/test-auth', async (req, res) => {
  try {
    console.log('🧪 Testing Gmail authentication...');
    
    const testInfo = await transporter.sendMail({
      from: `Digvijay Bendre <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_USER,
      subject: 'AutoMailer Test - Working Perfectly!',
      text: `
Hi there!

This is a test email from your AutoMailer system.

✅ Gmail authentication is working perfectly
✅ Your bulk email system is ready to use
✅ Time: ${new Date().toLocaleString()}

You can now start sending job applications!

Best regards,
Digvijay Bendre
Email: ${process.env.EMAIL_USER}
      `
    });
    
    console.log('✅ Test email sent successfully!');
    
    res.json({
      success: true,
      message: 'Test email sent successfully! Check your inbox.',
      messageId: testInfo.messageId
    });
    
  } catch (error) {
    console.error('❌ Gmail auth test failed:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ✅ BULK EMAIL SEND - WITH USER PROFILE SUPPORT
router.post('/bulk-send', upload.single('resume'), async (req, res) => {
  try {
    console.log('📤 BULK EMAIL REQUEST RECEIVED');
    console.log('📎 File received:', req.file ? req.file.originalname : 'No file');
    
    const { contactIds, contacts, userProfile } = req.body;
    const resumeFile = req.file;
    
    if (!resumeFile) {
      return res.status(400).json({
        success: false,
        message: 'Resume file required'
      });
    }

    // Parse user profile data
    let userProfileData = null;
    if (userProfile) {
      try {
        userProfileData = JSON.parse(userProfile);
        console.log('👤 User profile data received:', userProfileData.fullName);
      } catch (e) {
        console.log('⚠️ Failed to parse user profile, using default');
      }
    }

    // If no user profile provided, try to get from database
    if (!userProfileData) {
      try {
        const { rows } = await pool.query(
          'SELECT * FROM automailer_schema.user_profiles ORDER BY created_at DESC LIMIT 1'
        );
        if (rows.length > 0) {
          userProfileData = {
            fullName: rows[0].full_name,
            email: rows[0].email,
            phone: rows[0].phone,
            linkedin: rows[0].linkedin,
            github: rows[0].github,
            location: rows[0].location,
            availability: rows[0].availability,
            experienceYears: rows[0].experience_years,
            currentRole: rows[0].job_role, // ✅ FIXED: job_role instead of current_role
            skills: rows[0].skills
          };
          console.log('👤 User profile loaded from database:', userProfileData.fullName);
        }
      } catch (dbError) {
        console.log('⚠️ Failed to load user profile from database:', dbError.message);
      }
    }

    let contactsData = [];
    
    if (contacts) {
      console.log('📋 Using direct contacts data');
      contactsData = JSON.parse(contacts);
    } else if (contactIds) {
      console.log('📋 Using contactIds to fetch from database');
      const contactIdsArray = JSON.parse(contactIds);
      const contactsQuery = `SELECT * FROM automailer_schema.contacts WHERE id = ANY($1) AND deleted_at IS NULL`;
      const contactsResult = await pool.query(contactsQuery, [contactIdsArray]);
      contactsData = contactsResult.rows.map(row => ({
        id: row.id,
        hrName: row.hr_name,
        email: row.email,
        companyName: row.company_name,
        jobPosition: row.job_position,
        requiredSkills: row.required_skills
      }));
    } else {
      return res.status(400).json({
        success: false,
        message: 'Either contacts data or contactIds required'
      });
    }

    if (contactsData.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No contacts found'
      });
    }

    console.log(`📧 Starting Gmail bulk email process for ${contactsData.length} contacts`);
    console.log(`👤 Using profile: ${userProfileData ? userProfileData.fullName : 'Default Profile'}`);

    const batchId = `batch_${Date.now()}`;
    const results = [];

    // Get user profile ID for logging
    let userProfileId = null;
    if (userProfileData && userProfileData.email) {
      try {
        const { rows } = await pool.query(
          'SELECT id FROM automailer_schema.user_profiles WHERE email = $1',
          [userProfileData.email]
        );
        if (rows.length > 0) {
          userProfileId = rows[0].id;
        }
      } catch (e) {
        console.log('⚠️ Could not get user profile ID for logging');
      }
    }

    for (let i = 0; i < contactsData.length; i++) {
      const contact = contactsData[i];
      
      try {
        // ✅ USING TEMPLATE WITH USER PROFILE DATA
        const emailContent = getEmailTemplate(contact, userProfileData);
        
        console.log(`📧 Skills for ${contact.hrName}: ${contact.requiredSkills ? contact.requiredSkills.join(', ') : 'No skills listed'}`);

        const subject = `Application for ${contact.jobPosition} position at ${contact.companyName} - ${userProfileData ? userProfileData.fullName : 'Digvijay Bendre'}`;

        const mailOptions = {
          from: `${userProfileData ? userProfileData.fullName : 'Digvijay Bendre'} <${process.env.EMAIL_USER}>`,
          to: contact.email,
          subject: subject,
          text: emailContent,
          attachments: [{
            filename: resumeFile.originalname,
            path: resumeFile.path,
            contentType: resumeFile.mimetype || 'application/pdf'
          }]
        };

        console.log(`📧 Sending email ${i + 1}/${contactsData.length} to: ${contact.hrName} (${contact.email})`);
        
        const info = await transporter.sendMail(mailOptions);
        
        // Log success to database with user profile ID
        await pool.query(
          `INSERT INTO automailer_schema.email_logs 
           (batch_id, contact_id, user_profile_id, email, subject, status, message_id, resume_filename, sent_at) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [batchId, contact.id, userProfileId, contact.email, subject, 'sent', info.messageId, resumeFile.originalname, new Date()]
        );

        results.push({
          contactId: contact.id,
          hrName: contact.hrName,
          email: contact.email,
          companyName: contact.companyName,
          jobPosition: contact.jobPosition,
          skills: contact.requiredSkills || [], 
          status: 'sent',
          messageId: info.messageId
        });

        console.log(`✅ Email sent to: ${contact.hrName} with skills: ${contact.requiredSkills ? contact.requiredSkills.join(', ') : 'No skills'}`);
        
        // Gmail rate limiting
        if (i < contactsData.length - 1) {
          console.log(`⏳ Waiting 3 seconds...`);
          await new Promise(resolve => setTimeout(resolve, 3000));
        }

      } catch (emailError) {
        console.error(`❌ Email failed for ${contact.email}:`, emailError.message);
        
        await pool.query(
          `INSERT INTO automailer_schema.email_logs 
           (batch_id, contact_id, user_profile_id, email, subject, status, error_message, resume_filename) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [batchId, contact.id, userProfileId, contact.email, `Application for ${contact.jobPosition}`, 'failed', emailError.message, resumeFile.originalname]
        );

        results.push({
          contactId: contact.id,
          hrName: contact.hrName,
          email: contact.email,
          companyName: contact.companyName,
          jobPosition: contact.jobPosition,
          skills: contact.requiredSkills || [],
          status: 'failed',
          error: emailError.message
        });
      }
    }

    // Clean up uploaded file
    if (fs.existsSync(resumeFile.path)) {
      fs.unlinkSync(resumeFile.path);
      console.log('🗑️ Temporary resume file deleted');
    }

    const successCount = results.filter(r => r.status === 'sent').length;
    const failedCount = results.filter(r => r.status === 'failed').length;

    console.log(`\n🎉 EMAIL SENDING COMPLETED!`);
    console.log(`   📧 Total: ${contactsData.length}`);
    console.log(`   ✅ Sent: ${successCount}`);
    console.log(`   ❌ Failed: ${failedCount}`);

    res.json({
      success: true,
      message: `Email sending completed! ${successCount} sent successfully, ${failedCount} failed`,
      data: {
        batchId,
        totalContacts: contactsData.length,
        successCount,
        failedCount,
        results
      }
    });

  } catch (error) {
    console.error('❌ BULK EMAIL ERROR:', error);
    
    // Clean up file if error occurs
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to send bulk emails',
      error: error.message
    });
  }
});

// ✅ INDIVIDUAL EMAIL SEND
router.post('/send-individual', upload.single('resume'), async (req, res) => {
  try {
    console.log('📤 INDIVIDUAL EMAIL REQUEST RECEIVED');
    
    const { contact, userProfile } = req.body;
    const resumeFile = req.file;
    
    if (!resumeFile) {
      return res.status(400).json({
        success: false,
        message: 'Resume file required'
      });
    }

    const contactData = JSON.parse(contact);
    let userProfileData = null;

    // Parse user profile data if provided
    if (userProfile) {
      try {
        userProfileData = JSON.parse(userProfile);
      } catch (e) {
        console.log('⚠️ Failed to parse user profile for individual send');
      }
    }

    // If no user profile provided, try to get from database
    if (!userProfileData) {
      try {
        const { rows } = await pool.query(
          'SELECT * FROM automailer_schema.user_profiles ORDER BY created_at DESC LIMIT 1'
        );
        if (rows.length > 0) {
          userProfileData = {
            fullName: rows[0].full_name,
            email: rows[0].email,
            phone: rows[0].phone,
            linkedin: rows[0].linkedin,
            github: rows[0].github,
            location: rows[0].location,
            availability: rows[0].availability,
            experienceYears: rows[0].experience_years,
            currentRole: rows[0].job_role, // ✅ FIXED: job_role instead of current_role
            skills: rows[0].skills
          };
        }
      } catch (dbError) {
        console.log('⚠️ Failed to load user profile from database for individual send');
      }
    }

    console.log(`📧 Sending individual email to: ${contactData.hrName}`);

    const emailContent = getEmailTemplate(contactData, userProfileData);
    const subject = `Application for ${contactData.jobPosition} position at ${contactData.companyName} - ${userProfileData ? userProfileData.fullName : 'Digvijay Bendre'}`;

    const mailOptions = {
      from: `${userProfileData ? userProfileData.fullName : 'Digvijay Bendre'} <${process.env.EMAIL_USER}>`,
      to: contactData.email,
      subject: subject,
      text: emailContent,
      attachments: [{
        filename: resumeFile.originalname,
        path: resumeFile.path,
        contentType: resumeFile.mimetype || 'application/pdf'
      }]
    };

    const info = await transporter.sendMail(mailOptions);

    // Get user profile ID for logging
    let userProfileId = null;
    if (userProfileData && userProfileData.email) {
      try {
        const { rows } = await pool.query(
          'SELECT id FROM automailer_schema.user_profiles WHERE email = $1',
          [userProfileData.email]
        );
        if (rows.length > 0) {
          userProfileId = rows[0].id;
        }
      } catch (e) {
        console.log('⚠️ Could not get user profile ID for individual send logging');
      }
    }

    // Log to database
    const batchId = `individual_${Date.now()}`;
    await pool.query(
      `INSERT INTO automailer_schema.email_logs 
       (batch_id, contact_id, user_profile_id, email, subject, status, message_id, resume_filename, sent_at) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [batchId, contactData.id, userProfileId, contactData.email, subject, 'sent', info.messageId, resumeFile.originalname, new Date()]
    );

    // Clean up uploaded file
    if (fs.existsSync(resumeFile.path)) {
      fs.unlinkSync(resumeFile.path);
    }

    console.log(`✅ Individual email sent successfully to: ${contactData.hrName}`);

    res.json({
      success: true,
      message: `Email sent successfully to ${contactData.hrName}`,
      data: {
        contactId: contactData.id,
        hrName: contactData.hrName,
        email: contactData.email,  
        companyName: contactData.companyName,
        status: 'sent',
        messageId: info.messageId
      }
    });

  } catch (error) {
    console.error('❌ INDIVIDUAL EMAIL ERROR:', error);
    
    // Clean up file if error occurs
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to send individual email',
      error: error.message
    });
  }
});

// ✅ Get email logs with improved error handling
router.get('/logs', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        el.*, 
        c.hr_name, 
        c.company_name,
        up.full_name as sender_name,
        up.email as sender_email
      FROM automailer_schema.email_logs el
      LEFT JOIN automailer_schema.contacts c ON el.contact_id = c.id
      LEFT JOIN automailer_schema.user_profiles up ON el.user_profile_id = up.id
      ORDER BY el.created_at DESC
      LIMIT 50
    `);
    
    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching email logs:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ✅ Get statistics with improved error handling
router.get('/stats', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        COUNT(*) as total_emails,
        COUNT(CASE WHEN status = 'sent' THEN 1 END) as sent_emails,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_emails,
        COUNT(DISTINCT batch_id) as total_batches,
        COUNT(DISTINCT user_profile_id) as unique_senders
      FROM automailer_schema.email_logs
    `);
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error fetching email stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ✅ Get delivery status with improved error handling
router.get('/status/:emailId', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        el.*, 
        c.hr_name, 
        c.company_name,
        up.full_name as sender_name,
        up.email as sender_email
      FROM automailer_schema.email_logs el
      LEFT JOIN automailer_schema.contacts c ON el.contact_id = c.id
      LEFT JOIN automailer_schema.user_profiles up ON el.user_profile_id = up.id
      WHERE el.id = $1
    `, [req.params.emailId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Email log not found'
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error fetching email status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ✅ NEW: Get recent batches
router.get('/batches', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        batch_id,
        COUNT(*) as total_emails,
        COUNT(CASE WHEN status = 'sent' THEN 1 END) as sent_count,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_count,
        MIN(created_at) as batch_created_at,
        up.full_name as sender_name
      FROM automailer_schema.email_logs el
      LEFT JOIN automailer_schema.user_profiles up ON el.user_profile_id = up.id
      GROUP BY batch_id, up.full_name
      ORDER BY batch_created_at DESC
      LIMIT 20
    `);
    
    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching email batches:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ✅ NEW: Get emails by batch ID
router.get('/batch/:batchId', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        el.*, 
        c.hr_name, 
        c.company_name,
        up.full_name as sender_name
      FROM automailer_schema.email_logs el
      LEFT JOIN automailer_schema.contacts c ON el.contact_id = c.id
      LEFT JOIN automailer_schema.user_profiles up ON el.user_profile_id = up.id
      WHERE el.batch_id = $1
      ORDER BY el.created_at ASC
    `, [req.params.batchId]);
    
    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching batch emails:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
