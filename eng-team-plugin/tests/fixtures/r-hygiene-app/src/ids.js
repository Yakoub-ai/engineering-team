function parseOrderId(raw) {
  const m = /^ord_([0-9]+)$/.exec(String(raw));
  return m ? Number(m[1]) : null;
}

module.exports = { parseOrderId };
