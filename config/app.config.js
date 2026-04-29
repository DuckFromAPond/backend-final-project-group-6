// config/app.config.js
// get env info from this page 
// ADMIN_TOKEN: process.env.ADMIN_TOKEN || 'secret',

require('dotenv').config();
const isProd = process.env.NODE_ENV === "production";

module.exports = {
  PORT:        process.env.PORT        || 3000,
  DOMAIN:      process.env.DOMAIN      || 'localhost',
  NODE_ENV:    process.env.NODE_ENV    || 'development',

  BASE_URL: isProd
    ? process.env.BASE_URL
    : "http://localhost:3000",
    
  MONGO_URI: process.env.MONGO_URI || 'No DB',
  DB_PROVIDER:  process.env.DB_PROVIDER || 'mongodb',
  SUPABASE_URL:process.env.SUPABASE_URL || 'No DB',
  SUPABASE_SERVICE_ROLE_KEY:process.env.SUPABASE_SERVICE_ROLE_KEY || 'No Key',
  SESSION_SECRET:process.env.SESSION_SECRET || 'I-dont-have-a-key'
};