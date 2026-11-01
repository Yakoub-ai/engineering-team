const path = require('node:path');

// Handlers are loaded by action name: src/handlers/<action>.js
function runHandler(action, payload) {
  if (!/^[a-z]+$/.test(action)) throw new Error('bad action');
  const handler = require(path.join(__dirname, 'handlers', action));
  return handler(payload);
}

module.exports = { runHandler };
