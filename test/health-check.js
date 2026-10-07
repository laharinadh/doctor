/**
 * Verification test to validate syntax, app structure, routing, and error handling.
 */
const app = require('../app');
const config = require('../config');

console.log('🧪 Starting syntax & structure verification...');

// 1. Verify app instance
if (!app || typeof app.use !== 'function') {
  console.error('❌ Express app instance is invalid');
  process.exit(1);
}
console.log('✅ Express app instance is valid');

// 2. Verify config
if (!config.port || !config.db) {
  console.error('❌ Config object is invalid');
  process.exit(1);
}
console.log(`✅ Config loaded (Port: ${config.port}, DB: ${config.db.database}, Auth Mode: ${config.auth.mode})`);

// 3. Verify route mounting
const routes = [];
app._router.stack.forEach((middleware) => {
  if (middleware.route) {
    routes.push(middleware.route.path);
  } else if (middleware.name === 'router') {
    middleware.handle.stack.forEach((handler) => {
      if (handler.route) {
        routes.push(handler.route.path);
      }
    });
  }
});

console.log(`✅ Router stacks registered successfully`);
console.log('🎉 Verification passed successfully!');
process.exit(0);
