const test = require("node:test");
const assert = require("node:assert");
const { app } = require("../src/server.js");

test("app is exported", () => {
  assert.strictEqual(typeof app, "function");
});
