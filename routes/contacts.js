// routes/contacts.js
const express = require('express');
const router  = express.Router();
const pool    = require('../models/db');

/* =========================================================
   HELPERS
   ========================================================= */
const pickContactCols = `
  id, hr_name, email, company_name, job_position,
  required_skills, created_at, updated_at
`;

/* =========================================================
   GET - ALL active contacts
   ========================================================= */
router.get('/getAllContacts', async (_, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT ${pickContactCols}
       FROM   automailer_schema.contacts
       WHERE  deleted_at IS NULL
       ORDER  BY created_at DESC`
    );
    res.json({ success: true, data: rows, count: rows.length });
  } catch (err) {
    console.error('getAllContacts:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/* =========================================================
   GET - SINGLE contact
   ========================================================= */
router.get('/getContact/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT ${pickContactCols}
       FROM   automailer_schema.contacts
       WHERE  id = $1 AND deleted_at IS NULL`,
      [req.params.id]
    );
    if (!rows.length)
      return res.status(404).json({ success: false, message: 'Contact not found' });

    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('getContact:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/* =========================================================
   POST - ADD new contact
   ========================================================= */
router.post('/addContact', async (req, res) => {
  const { hrName, email, companyName, jobPosition, requiredSkills } = req.body;

  if (![hrName, email, companyName, jobPosition].every(Boolean) || !requiredSkills?.length)
    return res.status(400).json({ success: false, message: 'Missing fields' });

  try {
    // Prevent duplicates (ignore soft-deleted)
    const dupe = await pool.query(
      'SELECT 1 FROM automailer_schema.contacts WHERE email = $1 AND deleted_at IS NULL',
      [email]
    );
    if (dupe.rowCount)
      return res.status(409).json({ success: false, message: 'Contact already exists' });

    const { rows } = await pool.query(
      `INSERT INTO automailer_schema.contacts
       (hr_name,email,company_name,job_position,required_skills)
       VALUES ($1,$2,$3,$4,$5) RETURNING ${pickContactCols}`,
      [hrName, email, companyName, jobPosition, requiredSkills]
    );
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('addContact:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/* =========================================================
   PUT - UPDATE contact
   ========================================================= */
router.put('/updateContact/:id', async (req, res) => {
  const { hrName, email, companyName, jobPosition, requiredSkills } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE automailer_schema.contacts
       SET    hr_name=$1, email=$2, company_name=$3, job_position=$4,
              required_skills=$5, updated_at=CURRENT_TIMESTAMP
       WHERE  id=$6 AND deleted_at IS NULL
       RETURNING ${pickContactCols}`,
      [hrName, email, companyName, jobPosition, requiredSkills, req.params.id]
    );
    if (!rows.length)
      return res.status(404).json({ success: false, message: 'Contact not found' });

    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('updateContact:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/* =========================================================
   DELETE - Soft-delete contact
   ========================================================= */
router.delete('/deleteContact/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE automailer_schema.contacts
       SET    deleted_at = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
       WHERE  id = $1 AND deleted_at IS NULL
       RETURNING id, hr_name, company_name`,
      [req.params.id]
    );
    if (!rows.length)
      return res.status(404).json({ success: false, message: 'Contact not found' });

    res.json({ success: true, message: 'Contact deleted', data: rows[0] });
  } catch (err) {
    console.error('deleteContact:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/* =========================================================
   GET - Soft-deleted contacts (admin)
   ========================================================= */
router.get('/getDeletedContacts', async (_, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, hr_name, email, company_name, job_position, deleted_at
       FROM   automailer_schema.contacts
       WHERE  deleted_at IS NOT NULL
       ORDER  BY deleted_at DESC`
    );
    res.json({ success: true, data: rows, count: rows.length });
  } catch (err) {
    console.error('getDeletedContacts:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/* =========================================================
   POST - Restore soft-deleted contact
   ========================================================= */
router.post('/restoreContact/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE automailer_schema.contacts
       SET    deleted_at = NULL, updated_at = CURRENT_TIMESTAMP
       WHERE  id=$1 AND deleted_at IS NOT NULL
       RETURNING ${pickContactCols}`,
      [req.params.id]
    );
    if (!rows.length)
      return res.status(404).json({ success: false, message: 'Deleted contact not found' });

    res.json({ success: true, message: 'Contact restored', data: rows[0] });
  } catch (err) {
    console.error('restoreContact:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/* =========================================================
   DELETE - Permanent delete (admin)
   ========================================================= */
router.delete('/permanentDelete/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const logDel = await client.query(
      'DELETE FROM automailer_schema.email_logs WHERE contact_id=$1',
      [req.params.id]
    );
    const contactDel = await client.query(
      'DELETE FROM automailer_schema.contacts WHERE id=$1 RETURNING id, hr_name, company_name',
      [req.params.id]
    );
    if (!contactDel.rowCount) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Contact not found' });
    }
    await client.query('COMMIT');
    res.json({
      success: true,
      message: 'Contact and related logs permanently deleted',
      data: contactDel.rows[0],
      deletedLogs: logDel.rowCount
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('permanentDelete:', err);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
