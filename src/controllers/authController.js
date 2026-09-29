import db from '../config/db.js';
import { sendVerificationOtp, signIn, signOut, signUp, verifyEmail } from '../config/neonAuth.js';
import { INITIAL_VAPORCREDITS } from '../config/vaporcredits.js';

function isValidEmail(email) {
	return typeof email === 'string' && /^\S+@\S+\.\S+$/.test(email);
}

function setAuthCookies(res, cookies) {
	if (cookies.length) {
		res.setHeader('set-cookie', cookies);
	}
}

export async function register(req, res, next) {
	const { email, password, username } = req.body || {};

	if (!isValidEmail(email) || password.length < 8 ||
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
			const client = await db.connect();
			try {
				await client.query('BEGIN');

				await client.query(
					`INSERT INTO users (id, username, email, is_premium, current_login_streak)
					 VALUES ($1, $2, $3, FALSE, 0)`,
					[authResult.data.user.id, username.trim(), email.trim().toLowerCase()],
				);

				//grant initial VC
				await client.query(
					`INSERT INTO vaporcredits_wallets (id, user_id, balance)
					 VALUES (gen_random_uuid(), $1, $2)`,
					[authResult.data.user.id, INITIAL_VAPORCREDITS],
				);

				await client.query(
					`INSERT INTO ledger_entries (id, user_id, currency, amount, reason)
					 VALUES (gen_random_uuid(), $1, 'VAPORCREDITS', $2, 'INITIAL_ALLOWANCE')`,
					[authResult.data.user.id, INITIAL_VAPORCREDITS],
				);

				await client.query('COMMIT');
			}
			catch (error) {
				await client.query('ROLLBACK');
				throw error;
			}
			finally {
				client.release();
			}
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
}

export async function login(req, res) {
	const { email, password } = req.body || {};

	if (!isValidEmail(email) || !password) {
		return res.status(400).json({ error: 'Email and password are required' });
	}

	try {
		const authResult = await signIn({ email: email.trim().toLowerCase(), password });

		//blocks unverified users
		if (!authResult.data?.user?.emailVerified) {
			return res.status(403).json({ error: 'Email verification is required' });
		}

		await db.query(
			`UPDATE users
			 SET last_login_at = CURRENT_TIMESTAMP
			 WHERE id = $1`,
			[authResult.data.user.id],
		);

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
}

export async function verifyEmailAddress(req, res) {
	const { email, code } = req.body || {};

	if (!isValidEmail(email) || !code) {
		return res.status(400).json({ error: 'Valid email and verification code are required' });
	}

	try {
		const authResult = await verifyEmail({
			email: email.trim().toLowerCase(),
			code: code.trim(),
		});

		await db.query(
			`UPDATE users
			 SET email_verified_at = CURRENT_TIMESTAMP
			 WHERE id = $1 OR email = $2`,
			[authResult.data?.user?.id || null, email.trim().toLowerCase()],
		);

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
}

export async function logout(req, res, next) {
	try {
		const result = await signOut(req.get('cookie'));
		setAuthCookies(res, result.setCookies);
		return res.status(204).send();
	} catch (error) {
		return next(error);
	}
}

export async function getProfile(req, res, next) {
	try {
		const { rows } = await db.query(
			`SELECT id, username, email, is_premium, current_login_streak, created_at, last_login_at, total_points
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
}

export async function getLocation(req, res, next) {
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
}

export async function updateLocation(req, res, next) {
	const { country, region, consentGiven } = req.body || {};

	if (!country || !region || !consentGiven) {
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
}
