import express from 'express';
import db from '../config/db.js';
import { requireAuth } from '../authMiddleware.js';
import { getUser, refreshSession, signIn, signUp } from '../config/supabase.js';

const router = express.Router();

function isValidEmail(email) {
	return typeof email === 'string' && /^\S+@\S+\.\S+$/.test(email);
}

function publicSession(session) {
	return {
		access_token: session?.access_token || null,
		refresh_token: session?.refresh_token || null,
		expires_in: session?.expires_in || null,
		token_type: session?.token_type || null,
	};
}

router.post('/register', async (req, res, next) => {
	const { email, password, username } = req.body || {};

  //TO-DO: implement validation on frontend as well
	if (!isValidEmail(email) || typeof password !== 'string' || password.length < 8 ||
			typeof username !== 'string' || username.trim().length < 3 || username.length > 50) {
		return res.status(400).json({ error: 'Valid email, username, and password are required' });
	}

	try {
		const authResult = await signUp({
			email: email.trim().toLowerCase(),
			password,
			username: username.trim(),
		});

    //check if Supabase returned a user before adding to db
		if (authResult.user) {
			await db.query(
				`INSERT INTO users (id, username, email, password_hash, is_premium, current_login_streak)
				 VALUES ($1, $2, $3, NULL, FALSE, 0)`,
				[authResult.user.id, username.trim(), email.trim().toLowerCase()],
			);
		}

		return res.status(201).json({
			user: authResult.user ? { id: authResult.user.id, email: authResult.user.email } : null,
			//gives access if Supabase returns a session
      session: publicSession(authResult.session),
			//true if Supabase did not return a session
      emailVerificationRequired: !authResult.session,
		});
	} 
  catch (error) {
		return next(error);
	}
});

router.post('/login', async (req, res, next) => {
	const { email, password } = req.body || {};

  //TO-DO: also validate on frontend
	if (!isValidEmail(email) || typeof password !== 'string') {
		return res.status(400).json({ error: 'Email and password are required' });
	}

	try {
		const authResult = await signIn({
			email: email.trim().toLowerCase(),
			password,
		});

    //blocks unverified users
		if (!authResult.user?.email_confirmed_at) {
			return res.status(403).json({ error: 'Email verification is required' });
		}

		return res.json({
			user: { id: authResult.user.id, email: authResult.user.email },
			session: publicSession(authResult),
		});
	} 
  catch (error) {
    //if status is bad request return invalid credentials, otherwise return bad gateway
		return res.status(error.status === 400 ? 401 : 502).json({
			error: error.status === 400 ? 'Invalid email or password' : 'Authentication service unavailable',
		});
	}
});

//used by React Native app to refresh token
router.post('/refresh', async (req, res, next) => {
	const { refresh_token: refreshToken } = req.body || {};

	if (typeof refreshToken !== 'string' || !refreshToken) {
		return res.status(400).json({ error: 'Refresh token is required' });
	}

	try {
    //send refresh token to Supabase
		const session = await refreshSession(refreshToken);
    //returns replacement token
		return res.json({ session: publicSession(session) });
	} 
  catch (error) {
		return res.status(401).json({ error: 'Invalid or expired refresh token' });
	}
});

//gets user profile
router.get('/me', requireAuth, async (req, res, next) => {
	try {
    //$1 ensures user ID is not inserted directly into SQL
		const { rows } = await db.query(
			`SELECT id, username, email, is_premium, current_login_streak,
							created_at, last_login_at, total_points
			 FROM users WHERE id = $1`,
			[req.user.id],
		);

		if (!rows[0]) {
			return res.status(404).json({ error: 'Profile not found' });
		}

		return res.json({ user: rows[0] });
	} 
  catch (error) {
		return next(error);
	}
});

//gets user location
router.get('/me/location', requireAuth, async (req, res, next) => {
	try {
		const { rows } = await db.query(
			`SELECT id, country, region, consent_given, shared_at
			 FROM locations WHERE user_id = $1`,
			[req.user.id],
		);
		return res.json({ location: rows[0] || null });
	} 
  catch (error) {
		return next(error);
	}
});

//adds or updates user location
router.put('/me/location', requireAuth, async (req, res, next) => {
	const { country, region, consentGiven } = req.body || {};

	if (typeof country !== 'string' || typeof region !== 'string' || typeof consentGiven !== 'boolean') {
		return res.status(400).json({ error: 'Country, region, and consentGiven are required' });
	}

	try {
		const { rows } = await db.query(
			`INSERT INTO locations (id, user_id, country, region, consent_given, shared_at)
			 VALUES (gen_random_uuid(), $1, $2, $3, $4, CASE WHEN $4 THEN CURRENT_TIMESTAMP ELSE NULL END)
			 ON CONFLICT (user_id) DO UPDATE SET
				 country = EXCLUDED.country,
				 region = EXCLUDED.region,
				 consent_given = EXCLUDED.consent_given,
				 shared_at = EXCLUDED.shared_at
			 RETURNING id, country, region, consent_given, shared_at`,
			[req.user.id, country, region, consentGiven],
		);
		return res.json({ location: rows[0] });
	} 
  catch (error) {
		return next(error);
	}
});

export default router;