// config/app.config.js
// get env info from this page 

require('dotenv').config();

module.exports = {
  PORT:        process.env.PORT        || 3000,
  DOMAIN:      process.env.DOMAIN      || 'localhost',
  NODE_ENV:    process.env.NODE_ENV    || 'development',
  ADMIN_TOKEN: process.env.ADMIN_TOKEN || 'secret',
};
