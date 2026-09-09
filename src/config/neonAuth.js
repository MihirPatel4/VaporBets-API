const neonAuthUrl = process.env.NEON_AUTH_URL;

if (!neonAuthUrl) {
  throw new Error('NEON_AUTH_URL is required');
}

async function authRequest(path, { body, cookie } = {}) {
  const response = await fetch(`${neonAuthUrl}${path}`, {
    //only a POST request if user info is provided
    method: body ? 'POST' : 'GET',
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(cookie ? { cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(data?.message || data?.error || 'Authentication request failed');
    error.status = response.status;
    throw error;
  }

  return {
    data,
    setCookies: response.headers.getSetCookie(),
  };
}

export function signUp({ email, password, username }) {
  return authRequest('/auth/sign-up/email', {
    body: { email, password, name: username },
  });
}

export function signIn({ email, password }) {
  return authRequest('/auth/sign-in/email', {
    body: { email, password },
  });
}

export function getSession(cookie) {
  return authRequest('/auth/get-session', { cookie });
}

export function signOut(cookie) {
  return authRequest('/auth/sign-out', { cookie, body: {} });
}

export function verifyEmail({ email, code }) {
  return authRequest('/email-otp/verify-email', {
    body: { email, otp: code },
  });
}

export function sendVerificationOtp({ email }) {
  return authRequest('/email-otp/send-verification-otp', {
    body: { email, type: 'email-verification' },
  });
}