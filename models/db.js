const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

// Test connection
pool.on('connect', () => {
  console.log('✅ Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('❌ PostgreSQL connection error:', err);
});

// Create schema and tables
const createSchemaAndTables = async () => {
  try {
    // Create schema
    await pool.query(`
      CREATE SCHEMA IF NOT EXISTS automailer_schema;
    `);
    console.log('✅ Schema created: automailer_schema');

    // Create contacts table in schema
    await pool.query(`
      CREATE TABLE IF NOT EXISTS automailer_schema.contacts (
        id SERIAL PRIMARY KEY,
        hr_name VARCHAR(100) NOT NULL,
        email VARCHAR(255) NOT NULL,
        company_name VARCHAR(200) NOT NULL,
        job_position VARCHAR(100) NOT NULL,
        required_skills TEXT[],
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP NULL
      )
    `);
    console.log('✅ Table created: automailer_schema.contacts');

    // Create user_profiles table (using "job_role" instead of "current_role")
    await pool.query(`
      CREATE TABLE IF NOT EXISTS automailer_schema.user_profiles (
        id SERIAL PRIMARY KEY,
        full_name VARCHAR(100) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        phone VARCHAR(20) NOT NULL,
        linkedin VARCHAR(255),
        github VARCHAR(255),
        location VARCHAR(200) NOT NULL,
        availability VARCHAR(100) NOT NULL,
        experience_years VARCHAR(50) NOT NULL,
        job_role VARCHAR(100),
        skills TEXT[],
        resume_filename VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Table created: automailer_schema.user_profiles');

    // ✅ Create email logs table with CASCADE DELETE constraints
    await pool.query(`
      CREATE TABLE IF NOT EXISTS automailer_schema.email_logs (
        id SERIAL PRIMARY KEY,
        batch_id VARCHAR(100) NOT NULL,
        contact_id INTEGER REFERENCES automailer_schema.contacts(id) ON DELETE CASCADE,
        user_profile_id INTEGER REFERENCES automailer_schema.user_profiles(id) ON DELETE CASCADE,
        email VARCHAR(255) NOT NULL,
        subject VARCHAR(500) NOT NULL,
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('sent', 'failed', 'pending')),
        message_id VARCHAR(200),
        error_message TEXT,
        resume_filename VARCHAR(255),
        sent_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Table created: automailer_schema.email_logs');

    // Add soft delete column if it doesn't exist
    await pool.query(`
      ALTER TABLE automailer_schema.contacts 
      ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL;
    `);
    console.log('✅ Soft delete column added/verified');

    // Create indexes for better performance
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_contacts_email ON automailer_schema.contacts(email);
      CREATE INDEX IF NOT EXISTS idx_contacts_deleted_at ON automailer_schema.contacts(deleted_at);
      CREATE INDEX IF NOT EXISTS idx_email_logs_batch_id ON automailer_schema.email_logs(batch_id);
      CREATE INDEX IF NOT EXISTS idx_email_logs_status ON automailer_schema.email_logs(status);
      CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON automailer_schema.user_profiles(email);
    `);
    console.log('✅ Indexes created successfully');

  } catch (err) {
    console.error('❌ Schema/Table creation failed:', err.message);
  }
};

createSchemaAndTables();

module.exports = pool;
