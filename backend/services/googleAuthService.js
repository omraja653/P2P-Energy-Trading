const { OAuth2Client } = require('google-auth-library');

let client;
function getClient() {
  if (!client) {
    client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
  }
  return client;
}

function isGoogleAuthConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID);
}

/**
 * Verifies a Google Identity Services ID token and returns the profile
 * fields we care about. Throws if the token is invalid, expired, or wasn't
 * issued for our client ID — callers should treat any throw as "reject the
 * login attempt".
 */
async function verifyGoogleIdToken(idToken) {
  const ticket = await getClient().verifyIdToken({
    idToken,
    audience: process.env.GOOGLE_CLIENT_ID,
  });
  const payload = ticket.getPayload();

  return {
    googleId: payload.sub,
    email: payload.email,
    emailVerified: Boolean(payload.email_verified),
    firstName: payload.given_name || 'Google',
    lastName: payload.family_name || 'User',
  };
}

module.exports = { verifyGoogleIdToken, isGoogleAuthConfigured };
