import { getUser } from './config/supabase.js';

export async function requireAuth(req, res, next) {
  //get HTTP auth header
  const authorization = req.get('authorization');
  //scheme = 'Bearer', accessToken = *the token*
  const [scheme, accessToken] = authorization?.split(' ') || [];

  if (scheme !== 'Bearer' || !accessToken) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const { id, email, email_confirmed_at: emailConfirmedAt } = await getUser(accessToken);

    if (!id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    req.user = {
      id,
      email,
      emailConfirmedAt,
    };

    //continue to next route
    return next();
  } 
  catch (error) {
    return res.status(401).json({ error: 'Invalid or expired access token' });
  }
}