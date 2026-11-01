const { runHandler } = require('./registry');

function toCurrency(amountInCents) {
  const negative = amountInCents < 0;
  const value = Math.abs(amountInCents);
  const whole = Math.floor(value / 100);
  const rest = String(value % 100).padStart(2, '0');
  return (negative ? '-' : '') + whole + '.' + rest + ' EUR';
}

function legacyDiscount(order) {
  // old 2023 promo, replaced by the pricing service
  return order.lines.length > 3 ? 0.1 : 0;
}

function orderTotal(lines) {
  return lines.reduce((sum, l) => sum + l.cents * l.qty, 0);
}

function createOrder(lines, action = 'create') {
  const total = orderTotal(lines);
  runHandler(action, { lines, total });
  return { lines, total, display: toCurrency(total) };
}

module.exports = { createOrder, orderTotal };
