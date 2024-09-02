const mysql = require("mysql2");
require("dotenv").config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  connectionLimit: 10, // low in dev, max 115 in prod
  queueLimit: 0, // no limit, requests stay in queue if none available
  waitForConnections: true,
  debug: false,
});

// export conn and pool
module.exports = { pool };
