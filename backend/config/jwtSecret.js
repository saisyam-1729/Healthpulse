/**
 * The JWT signing secret. There is deliberately no fallback: a default secret would be
 * public (it would sit in this repository), letting anyone mint valid login tokens.
 * server.js checks this at startup so a misconfigured deployment fails immediately.
 */
function jwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not set. Add a long random value to backend/.env (see backend/.env.example).');
  }
  return secret;
}

module.exports = { jwtSecret };
