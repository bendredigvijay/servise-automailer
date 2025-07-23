// db.js
// Postgres connection + schema / table bootstrap
const { Pool } = require('pg');
require('dotenv').config();

/*
 *  Render (production) पर DATABASE_URL mandatory है.
 *  Local dev → .env में DATABASE_URL दो; या न दो तो
 *  पुराने host / port variables से fallback लेगा.
 */
const connectionString =
  process.env.DATABASE_URL ||
  `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}` +
  `@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`;

const pool = new Pool({
  connectionString,
  // Render में SSL ज़रूरी। लोकल में self-signed होने से बचने के लिये NODE_ENV check किया है.
  ssl:
    process.env.NODE_ENV === 'production'
      ? { rejectUnauthorized: false }
      : false,
});

// Simple diagnostics
pool.on('connect', () => console.log('✅ Connected to PostgreSQL'));
pool.on('error', (err) =>
  console.error('❌ PostgreSQL connection error:', err),
);

/* ----------  Schema & table creation  ---------- */
const createSchemaAndTables = async () => {
  try {
    await pool.query(`CREATE SCHEMA IF NOT EXISTS automailer_schema;`);
    console.log('✅ Schema ready -> automailer_schema');

    // -------- contacts ----------
    await pool.query(`
      CREATE TABLE IF NOT EXISTS automailer_schema.contacts (
        id SERIAL PRIMARY KEY,
        hr_name        VARCHAR(100) NOT NULL,
        email          VARCHAR(255) NOT NULL,
        company_name   VARCHAR(200) NOT NULL,
        job_position   VARCHAR(100) NOT NULL,
        required_skills TEXT[],
        created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        deleted_at     TIMESTAMP
      );`);
    console.log('✅ Table  -> automailer_schema.contacts');

    // -------- user_profiles ----------
    await pool.query(`
      CREATE TABLE IF NOT EXISTS automailer_schema.user_profiles (
        id SERIAL PRIMARY KEY,
        full_name       VARCHAR(100) NOT NULL,
        email           VARCHAR(255) NOT NULL UNIQUE,
        phone           VARCHAR(20)  NOT NULL,
        linkedin        VARCHAR(255),
        github          VARCHAR(255),
        location        VARCHAR(200) NOT NULL,
        availability    VARCHAR(100) NOT NULL,
        experience_years VARCHAR(50) NOT NULL,
        job_role        VARCHAR(100),
        skills          TEXT[],
        resume_filename VARCHAR(255),
        created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );`);
    console.log('✅ Table  -> automailer_schema.user_profiles');

    // -------- email_logs ----------
    await pool.query(`
      CREATE TABLE IF NOT EXISTS automailer_schema.email_logs (
        id SERIAL PRIMARY KEY,
        batch_id        VARCHAR(100) NOT NULL,
        contact_id      INTEGER REFERENCES automailer_schema.contacts(id) ON DELETE CASCADE,
        user_profile_id INTEGER REFERENCES automailer_schema.user_profiles(id) ON DELETE CASCADE,
        email           VARCHAR(255) NOT NULL,
        subject         VARCHAR(500) NOT NULL,
        status          VARCHAR(20)  DEFAULT 'pending' CHECK (status IN ('sent','failed','pending')),
        message_id      VARCHAR(200),
        error_message   TEXT,
        resume_filename VARCHAR(255),
        sent_at         TIMESTAMP,
        created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );`);
    console.log('✅ Table  -> automailer_schema.email_logs');

    // -------- indexes ----------
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_contacts_email          ON automailer_schema.contacts(email);
      CREATE INDEX IF NOT EXISTS idx_contacts_deleted_at     ON automailer_schema.contacts(deleted_at);
      CREATE INDEX IF NOT EXISTS idx_email_logs_batch_id     ON automailer_schema.email_logs(batch_id);
      CREATE INDEX IF NOT EXISTS idx_email_logs_status       ON automailer_schema.email_logs(status);
      CREATE INDEX IF NOT EXISTS idx_user_profiles_email     ON automailer_schema.user_profiles(email);
    `);
    console.log('✅ Indexes created');
  } catch (err) {
    console.error('❌ Schema/Table creation failed:', err.message);
  }
};

// Immediately bootstrap on server start
createSchemaAndTables();

module.exports = pool;
