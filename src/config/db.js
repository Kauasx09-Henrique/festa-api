// src/config/db.js (Atualizado)
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

module.exports = {
  pool, // Exporta o pool para transações
  query: (text, params) => pool.query(text, params), // Exporta a função query simples
};