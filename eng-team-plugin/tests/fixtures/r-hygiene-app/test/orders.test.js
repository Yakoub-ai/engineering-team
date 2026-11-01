const test = require('node:test');
const assert = require('node:assert');
const { createOrder } = require('../src');

test('createOrder totals and formats', () => {
  const o = createOrder([{ cents: 1250, qty: 2 }]);
  assert.equal(o.total, 2500);
  assert.equal(o.display, '25.00 EUR');
});
