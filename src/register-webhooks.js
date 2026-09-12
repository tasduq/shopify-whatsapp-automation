require('dotenv').config();

const shopify = require('./shopify');

// Usage:
//   BASE_ADDRESS=https://your-app.up.railway.app node src/register-webhooks.js
// The base address is the public URL of the deployed backend (no trailing slash).
async function main() {
  const baseAddress = process.env.BASE_ADDRESS;
  if (!baseAddress) {
    console.error('Set BASE_ADDRESS env var to your deployed backend URL, e.g.:');
    console.error('  BASE_ADDRESS=https://your-app.up.railway.app node src/register-webhooks.js');
    process.exit(1);
  }

  const results = await shopify.registerWebhooks(baseAddress);
  console.log(JSON.stringify(results, null, 2));
}

main().catch((err) => {
  console.error('Registration failed:', err);
  process.exit(1);
});
