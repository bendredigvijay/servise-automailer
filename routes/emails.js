const express = require('express');
const router = express.Router();
const multer = require('multer');
const nodemailer = require('nodemailer');
const pool = require('../models/db');
const fs = require('fs');
const { getEmailTemplate } = require('../templates/emailTemplate'); // ✅ Import template

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

// ✅ BULK EMAIL SEND - USING TEMPLATE FILE
router.post('/bulk-send', upload.single('resume'), async (req, res) => {
  try {
    console.log('📤 BULK EMAIL REQUEST RECEIVED');
    console.log('📎 File received:', req.file ? req.file.originalname : 'No file');
    
    const { contactIds, contacts } = req.body;
    const resumeFile = req.file;
    
    if (!resumeFile) {
      return res.status(400).json({
        success: false,
        message: 'Resume file required'
      });
    }

    let contactsData = [];
    
    if (contacts) {
      console.log('📋 Using direct contacts data');
      contactsData = JSON.parse(contacts);
    } else if (contactIds) {
      console.log('📋 Using contactIds to fetch from database');
      const contactIdsArray = JSON.parse(contactIds);
      const contactsQuery = `SELECT * FROM automailer_schema.contacts WHERE id = ANY($1)`;
      const contactsResult = await pool.query(contactsQuery, [contactIdsArray]);
      contactsData = contactsResult.rows.map(row => ({
        id: row.id,
        hrName: row.hr_name,
        email: row.email,
        companyName: row.company_name,
        jobPosition: row.job_position,
        requiredSkills: row.required_skills // ✅ Ye array user se aayegi frontend se
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

    const batchId = `batch_${Date.now()}`;
    const results = [];

    for (let i = 0; i < contactsData.length; i++) {
      const contact = contactsData[i];
      
      try {
        // ✅ USING TEMPLATE FROM SEPARATE FILE
        const emailContent = getEmailTemplate(contact, process.env.EMAIL_USER);
        
        console.log(`📧 Skills for ${contact.hrName}: ${contact.requiredSkills.join(', ')}`); // Debug skills

        const subject = `Application for ${contact.jobPosition} position at ${contact.companyName} - Digvijay Bendre`;

        const mailOptions = {
          from: `Digvijay Bendre <${process.env.EMAIL_USER}>`,
          to: contact.email,
          subject: subject,
          text: emailContent, // ✅ Using template function
          attachments: [{
            filename: resumeFile.originalname,
            path: resumeFile.path,
            contentType: 'application/pdf'
          }]
        };

        console.log(`📧 Sending email ${i + 1}/${contactsData.length} to: ${contact.hrName} (${contact.email})`);
        
        const info = await transporter.sendMail(mailOptions);
        
        // Log success to database
        await pool.query(
          `INSERT INTO automailer_schema.email_logs 
           (batch_id, contact_id, email, subject, status, message_id, resume_filename, sent_at) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [batchId, contact.id, contact.email, subject, 'sent', info.messageId, resumeFile.originalname, new Date()]
        );

        results.push({
          contactId: contact.id,
          hrName: contact.hrName,
          email: contact.email,
          companyName: contact.companyName,
          jobPosition: contact.jobPosition,
          skills: contact.requiredSkills, 
          status: 'sent',
          messageId: info.messageId
        });

        console.log(`✅ Email sent to: ${contact.hrName} with skills: ${contact.requiredSkills.join(', ')}`);
        
        // Gmail rate limiting
        if (i < contactsData.length - 1) {
          console.log(`⏳ Waiting 3 seconds...`);
          await new Promise(resolve => setTimeout(resolve, 3000));
        }

      } catch (emailError) {
        console.error(`❌ Email failed for ${contact.email}:`, emailError.message);
        
        await pool.query(
          `INSERT INTO automailer_schema.email_logs 
           (batch_id, contact_id, email, subject, status, error_message, resume_filename) 
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [batchId, contact.id, contact.email, `Application for ${contact.jobPosition}`, 'failed', emailError.message, resumeFile.originalname]
        );

        results.push({
          contactId: contact.id,
          hrName: contact.hrName,
          email: contact.email,
          companyName: contact.companyName,
          jobPosition: contact.jobPosition,
          skills: contact.requiredSkills,
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

// Get email logs
router.get('/logs', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT el.*, c.hr_name, c.company_name 
      FROM automailer_schema.email_logs el
      LEFT JOIN automailer_schema.contacts c ON el.contact_id = c.id
      ORDER BY el.created_at DESC
      LIMIT 50
    `);
    
    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get statistics
router.get('/stats', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        COUNT(*) as total_emails,
        COUNT(CASE WHEN status = 'sent' THEN 1 END) as sent_emails,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_emails,
        COUNT(DISTINCT batch_id) as total_batches
      FROM automailer_schema.email_logs
    `);
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
