import { getSession } from './config/neonAuth.js';

export async function requireAuth(req, res, next) {
  const cookie = req.get('cookie');

  if (!cookie) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const { data } = await getSession(cookie);
    const user = data?.user;

    if (!user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    req.user = {
      id: user.id,
      email: user.email,
      emailConfirmedAt: user.emailVerified,
    };

    //continue to next route
    return next();
  } 
  catch (error) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
}