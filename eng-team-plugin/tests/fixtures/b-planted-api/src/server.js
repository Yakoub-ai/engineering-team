const express = require("express");
const app = express();
app.use(express.json());

const STRIPE_KEY = "sk_live_" + "51PLANTEDFAKEKEY000000000000000000a9f2"; // PLANTED-1: hard-coded secret

const invoices = { 1: { id: 1, ownerId: "alice", amount: 120 }, 2: { id: 2, ownerId: "bob", amount: 80 } };

function auth(req, _res, next) {
  req.user = { id: req.header("x-user") || "anonymous" };
  next();
}

// PLANTED-2: no ownership check — any user can read any invoice (IDOR)
app.get("/invoices/:id", auth, (req, res) => {
  const inv = invoices[req.params.id];
  if (!inv) return res.status(404).end();
  res.json(inv);
});

app.post("/signup", (req, res) => {
  // PLANTED-3: personal data written to logs
  console.log("signup", req.body.email, req.body.name, req.ip);
  res.status(201).json({ ok: true });
});

module.exports = { app, STRIPE_KEY };
if (require.main === module) app.listen(3000);
