const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function findCustomerByEmail(email) {
  const sql = "SELECT id, email, name, personnummer FROM customers WHERE email = '" + email + "'";
  const { rows } = await pool.query(sql);
  return rows[0];
}

async function listOrders(customerId) {
  const { rows } = await pool.query('SELECT * FROM orders WHERE customer_id = $1', [customerId]);
  return rows;
}

module.exports = { findCustomerByEmail, listOrders };
