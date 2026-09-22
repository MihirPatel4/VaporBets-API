import express from 'express';
import db from '../config/db.js';
import { requireAuth } from '../authMiddleware.js';

const router = express.Router();

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

//get a user's wallet information
router.get('/wallet', requireAuth, async (req, res, next) => {
	try {
		const { rows } = await db.query(`
			SELECT balance, updated_at
			FROM vaporcredits_wallets
			WHERE user_id = $1
		`, [req.user.id]);

		return res.json({ wallet: rows[0] || { balance: 0, updated_at: null } });
	}
	catch (error) {
		return next(error);
	}
});

//get a user's placed bets
router.get('/', requireAuth, async (req, res, next) => {
	try {
		const { rows } = await db.query(`
			SELECT b.id, b.amount_wagered, b.combined_odds, b.potential_payout, b.status, b.placed_at, b.settled_at,
				COALESCE(json_agg(
					json_build_object(
						'marketOutcomeId', bl.market_outcome_id,
						'label', mo.label,
						'oddsAtPlacement', bl.odds_at_placement
					) ORDER BY bl.id
				) FILTER (WHERE bl.id IS NOT NULL), '[]'::json) AS legs
			FROM bets b
			LEFT JOIN bet_legs bl ON bl.bet_id = b.id
			LEFT JOIN market_outcomes mo ON mo.id = bl.market_outcome_id
			WHERE b.user_id = $1
			GROUP BY b.id
			ORDER BY b.placed_at DESC
		`, [req.user.id]);

		return res.json({ bets: rows });
	}
	catch (error) {
		return next(error);
	}
});

//get a specific bet from a user
router.get('/:id', requireAuth, async (req, res, next) => {
	if (!UUID_PATTERN.test(req.params.id)) {
		return res.status(400).json({ error: 'Invalid bet ID' });
	}

	try {
		const { rows } = await db.query(`
			SELECT b.id, b.amount_wagered, b.combined_odds, b.potential_payout, b.status, b.placed_at, b.settled_at,
				COALESCE(json_agg(
					json_build_object(
						'id', bl.id,
						'marketOutcomeId', bl.market_outcome_id,
						'label', mo.label,
						'oddsAtPlacement', bl.odds_at_placement
					) ORDER BY bl.id
				) FILTER (WHERE bl.id IS NOT NULL), '[]'::json) AS legs
			FROM bets b
			LEFT JOIN bet_legs bl ON bl.bet_id = b.id
			LEFT JOIN market_outcomes mo ON mo.id = bl.market_outcome_id
			WHERE b.user_id = $1 AND b.id = $2
			GROUP BY b.id
		`, [req.user.id, req.params.id]);
		const bet = rows[0] || null;

		if (!bet) {
			return res.status(404).json({ error: 'Bet not found' });
		}

		return res.json({ bet });
	}
	catch (error) {
		return next(error);
	}
});

//place a bet
router.post('/', requireAuth, async (req, res, next) => {
	const amountWagered = req.body?.amountWagered;
	const legs = req.body?.legs;

	if (!Number.isSafeInteger(amountWagered) || amountWagered <= 0 || !Array.isArray(legs) || legs.length === 0 || legs.length > 10) {
		return res.status(400).json({ error: 'A positive amountWagered and 1 to 10 legs are required' });
	}

	const outcomeIds = legs.map((leg) => leg?.marketOutcomeId);
	if (outcomeIds.some((id) => typeof id !== 'string' || !UUID_PATTERN.test(id)) ||
		new Set(outcomeIds).size !== outcomeIds.length) {
		return res.status(400).json({ error: 'Each leg must contain a unique valid marketOutcomeId' });
	}

	const client = await db.connect();
	try {
		await client.query('BEGIN');

		const { rows: outcomes } = await client.query(`
			SELECT mo.id, mo.market_id, mo.odds, mo.result, m.status AS market_status, m.closes_at
			FROM market_outcomes mo
			JOIN markets m ON m.id = mo.market_id
			WHERE mo.id = ANY($1::uuid[])
			FOR UPDATE
		`, [outcomeIds]);

		if (outcomes.length !== outcomeIds.length) {
			await client.query('ROLLBACK');
			return res.status(404).json({ error: 'One or more market outcomes were not found' });
		}

		if (outcomes.some((outcome) => outcome.market_status !== 'OPEN' ||
			(outcome.closes_at && new Date(outcome.closes_at) <= new Date()) ||
			outcome.result !== 'PENDING')) {
			await client.query('ROLLBACK');
			return res.status(409).json({ error: 'One or more selected outcomes are not available for betting' });
		}

		if (new Set(outcomes.map((outcome) => outcome.market_id)).size !== outcomes.length) {
			await client.query('ROLLBACK');
			return res.status(400).json({ error: 'Only one outcome per market may be selected' });
		}

    //convert odds to number value if postgres returns a string
		const odds = outcomes.map((outcome) => Number(outcome.odds));
		if (odds.some((value) => !Number.isFinite(value) || value <= 0)) {
			await client.query('ROLLBACK');
			return res.status(409).json({ error: 'Current odds are unavailable' });
		}

    //combine all odds from each leg, round to 4 decimal places
		const combinedOdds = Math.round(odds.reduce((product, value) => product * value, 1) * 10000) / 10000;
		const potentialPayout = Math.floor(amountWagered * combinedOdds);
		if (!Number.isFinite(combinedOdds) || combinedOdds <= 0 || !Number.isFinite(potentialPayout) || potentialPayout < 0) {
			await client.query('ROLLBACK');
			return res.status(400).json({ error: 'Bet amount is too large' });
		}

		const { rows: walletRows } = await client.query(`
			SELECT balance
			FROM vaporcredits_wallets
			WHERE user_id = $1
			FOR UPDATE
		`, [req.user.id]);

		if (!walletRows[0]) {
			await client.query('ROLLBACK');
			return res.status(409).json({ error: 'Vaporcredits wallet not found' });
		}

		if (walletRows[0].balance < amountWagered) {
			await client.query('ROLLBACK');
			return res.status(409).json({ error: 'Insufficient Vaporcredits' });
		}

		await client.query(`
			UPDATE vaporcredits_wallets
			SET balance = balance - $1, updated_at = CURRENT_TIMESTAMP
			WHERE user_id = $2
		`, [amountWagered, req.user.id]);

		const { rows: betRows } = await client.query(`
			INSERT INTO bets (id, user_id, amount_wagered, combined_odds, potential_payout)
			VALUES (gen_random_uuid(), $1, $2, $3, $4)
			RETURNING id, amount_wagered, combined_odds, potential_payout, status, placed_at
				`, [req.user.id, amountWagered, combinedOdds, potentialPayout]);

		const bet = betRows[0];
		for (const outcome of outcomes) {
			await client.query(`
				INSERT INTO bet_legs (id, bet_id, market_outcome_id, odds_at_placement)
				VALUES (gen_random_uuid(), $1, $2, $3)
			`, [bet.id, outcome.id, Number(outcome.odds).toFixed(4)]);
		}

		await client.query(`
			INSERT INTO ledger_entries (id, user_id, currency, amount, reason, related_bet_id)
			VALUES (gen_random_uuid(), $1, 'VAPORCREDITS', $2, 'BET_PLACED', $3)
		`, [req.user.id, -amountWagered, bet.id]);

    //+1 point per 100 VC wagered
		const pointsEarned = Math.floor(amountWagered / 100);
		const { rows: userRows } = await client.query(`
			UPDATE users
			SET total_points = COALESCE(total_points, 0) + $1
			WHERE id = $2
			RETURNING total_points
		`, [pointsEarned, req.user.id]);

		await client.query('COMMIT');
		return res.status(201).json({
			bet: {
				...bet,
				combined_odds: combinedOdds,
				potential_payout: potentialPayout,
				legs: outcomes.map((outcome) => ({
					marketOutcomeId: outcome.id,
					oddsAtPlacement: Number(outcome.odds).toFixed(4),
				})),
			},
			wallet: { balance: walletRows[0].balance },
			points: {
				earned: pointsEarned,
				total: userRows[0]?.total_points ?? null,
			},
		});
	}
	catch (error) {
		await client.query('ROLLBACK');
		return next(error);
	}
	finally {
		client.release();
	}
});

export default router;