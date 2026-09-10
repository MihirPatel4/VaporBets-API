import express from 'express';
import db from '../config/db.js';
import { requireAuth } from '../authMiddleware.js';
import { sendVerificationOtp, signIn, signOut, signUp, verifyEmail } from '../config/neonAuth.js';

const router = express.Router();

function isValidEmail(email) {
	return typeof email === 'string' && /^\S+@\S+\.\S+$/.test(email);
}

function setAuthCookies(res, cookies) {
	if (cookies.length) {
		res.setHeader('set-cookie', cookies);
	}
}

router.post('/register', async (req, res, next) => {
	const { email, password, username } = req.body || {};

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

	//check if a user was returned before inserting into db
		if (authResult.data?.user) {
			await db.query(
				`INSERT INTO users (id, username, email, password_hash, is_premium, current_login_streak)
				 VALUES ($1, $2, $3, NULL, FALSE, 0)`,
				[authResult.data.user.id, username.trim(), email.trim().toLowerCase()],
			);
		}

		if (!authResult.data?.session) {
			await sendVerificationOtp({ email: email.trim().toLowerCase() });
		}

		setAuthCookies(res, authResult.setCookies);
		
		return res.status(201).json({
			user: authResult.data?.user || null,
			session: authResult.data?.session || null,
			//verification is required if no session was returned
			emailVerificationRequired: !authResult.data?.session,
		});
	} 
  catch (error) {
		return next(error);
	}
});

router.post('/login', async (req, res, next) => {
	const { email, password } = req.body || {};

	if (!isValidEmail(email) || typeof password !== 'string') {
		return res.status(400).json({ error: 'Email and password are required' });
	}

	try {
		const authResult = await signIn({
			email: email.trim().toLowerCase(),
			password,
		});

    //blocks unverified users
		if (!authResult.data?.user?.emailVerified) {
			return res.status(403).json({ error: 'Email verification is required' });
		}

		setAuthCookies(res, authResult.setCookies);
		return res.json({
			user: authResult.data.user,
			session: authResult.data.session || null,
		});
	} 
  catch (error) {
    //if status is bad request return invalid credentials, otherwise return bad gateway
		return res.status(error.status === 400 ? 401 : 502).json({
			error: error.status === 400 ? 'Invalid email or password' : 'Authentication service unavailable',
		});
	}
});

router.post('/verify-email', async (req, res, next) => {
	const { email, code } = req.body || {};

	if (!isValidEmail(email) || typeof code !== 'string' || !code.trim()) {
		return res.status(400).json({ error: 'Valid email and verification code are required' });
	}

	try {
		const authResult = await verifyEmail({
			email: email.trim().toLowerCase(),
			code: code.trim(),
		});

		setAuthCookies(res, authResult.setCookies);

		return res.json({
			user: authResult.data?.user || null,
			session: authResult.data?.session || null,
		});
	} 
	catch (error) {
		//if error status is not bad request, return bad gateway
		return res.status(error.status === 400 ? 400 : 502).json({
			error: error.status === 400 ? 'Invalid or expired verification code' : 'Authentication service unavailable',
		});
	}
});

router.post('/logout', async (req, res, next) => {
	try {
		const result = await signOut(req.get('cookie'));
		setAuthCookies(res, result.setCookies);
		return res.status(204).send();
	} catch (error) {
		return next(error);
	}
});

//gets user profile
router.get('/me', requireAuth, async (req, res, next) => {
	try {
    //parameter value ensures user ID is not inserted directly into SQL
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