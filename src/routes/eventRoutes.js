import express from 'express';
import db from '../config/db.js';

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const { rows } = await db.query(`
      SELECT e.id, e.title, COALESCE(
        json_agg(
          json_build_object(
            'id', m.id,
            'question', m.question,
            'slug', m.slug,
            'sportsMarketType', m.sports_market_type,
            'outcomes', COALESCE((
              SELECT json_agg(
                json_build_object(
                  'id', mo.id,
                  'team', mo.label,
                  'probability', mo.probability
                )
                ORDER BY mo.id
              )
              FROM market_outcomes mo WHERE mo.market_id = m.id
            ), '[]'::json)
          )
          ORDER BY m.id
        ) FILTER (WHERE m.id IS NOT NULL), '[]'::json
      ) AS markets
      FROM events e 
      JOIN market_categories c ON c.id = e.category_id
      LEFT JOIN markets m ON m.event_id = e.id AND m.status = 'OPEN' AND m.sports_market_type = 'moneyline'
      WHERE c.name = 'Sports' AND e.status <> 'COMPLETED'
      GROUP BY e.id
      ORDER BY e.start_time NULLS LAST, e.title ASC
    `);

    return res.json({ events: rows });
  } 
  catch (error) {
    return next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const eventResult = await db.query(`
      SELECT id, title, description, slug, game_id, start_time, status
      FROM events
      WHERE id = $1
      `, [req.params.id]);

    if (eventResult.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const marketsResult = await db.query(`
      SELECT m.id, m.question, m.slug, m.sports_market_type, m.status, m.closes_at, COALESCE(
        json_agg(
          json_build_object(
            'id', mo.id,
            'label', mo.label,
            'probability', mo.probability,
            'odds', mo.odds
          )
          ORDER BY mo.id
        ) FILTER (WHERE mo.id IS NOT NULL),
        '[]'::json
      ) AS outcomes
      FROM markets m
      LEFT JOIN market_outcomes mo ON mo.market_id = m.id WHERE m.event_id = $1
      GROUP BY m.id
      ORDER BY m.id
    `, [req.params.id]);

    return res.json({
      event: {
        ...eventResult.rows[0],
        markets: marketsResult.rows,
      },
    });
  }

  catch (error) {
    return next(error);
  }
});

export default router;
