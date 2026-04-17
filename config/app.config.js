// config/app.config.js
// get env info from this page 

require('dotenv').config();

module.exports = {
  PORT:        process.env.PORT        || 3000,
  DOMAIN:      process.env.DOMAIN      || 'localhost',
  NODE_ENV:    process.env.NODE_ENV    || 'development',
  ADMIN_TOKEN: process.env.ADMIN_TOKEN || 'secret',

  DB_PROVIDER:  process.env.DB_PROVIDER || 'supabase',
  SUPABASE_URL:process.env.SUPABASE_URL || 'No DB',
  SUPABASE_SERVICE_ROLE_KEY:process.env.SUPABASE_SERVICE_ROLE_KEY || 'No Key',
  SESSION_SECRET:process.env.SESSION_SECRET || 'I-dont-have-a-key-:('
};