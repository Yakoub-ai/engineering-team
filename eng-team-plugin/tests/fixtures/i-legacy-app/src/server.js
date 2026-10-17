const express = require('express');
const { findCustomerByEmail, listOrders } = require('./db');

const app = express();
app.use(express.json());

app.get('/health', (req, res) => res.json({ ok: true }));

app.get('/customers', async (req, res) => {
  const customer = await findCustomerByEmail(req.query.email);
  res.json(customer || {});
});

app.get('/customers/:id/orders', async (req, res) => {
  res.json(await listOrders(req.params.id));
});

app.listen(process.env.PORT || 3000);
module.exports = app;
