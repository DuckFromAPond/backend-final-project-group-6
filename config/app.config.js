// config/app.config.js
// get env info from this page 
// ADMIN_TOKEN: process.env.ADMIN_TOKEN || 'secret',

require('dotenv').config();

module.exports = {
  PORT:        process.env.PORT        || 3000,
  DOMAIN:      process.env.DOMAIN      || 'localhost',
  NODE_ENV:    process.env.NODE_ENV    || 'development',
  BASE_URL:    process.env.BASE_URL    || "http://localhost:3000",
  PRODUCTION_URL: process.env.PRODUCTION_URL || "https://websitename.com",
  DB_PROVIDER:  process.env.DB_PROVIDER || 'mongodb',
  SUPABASE_URL:process.env.SUPABASE_URL || 'No DB',
  SUPABASE_SERVICE_ROLE_KEY:process.env.SUPABASE_SERVICE_ROLE_KEY || 'No Key',
  // SESSION_SECRET:process.env.SESSION_SECRET || 'I-dont-have-a-key'
};