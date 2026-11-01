#!/usr/bin/env node
const { formatMoney } = require('../src/money');
const { orderTotal } = require('../src/orders');

const [cmd, ...args] = process.argv.slice(2);
if (cmd === 'total') {
  const lines = args.map((c) => ({ cents: Number(c), qty: 1 }));
  console.log(formatMoney(orderTotal(lines)));
}
