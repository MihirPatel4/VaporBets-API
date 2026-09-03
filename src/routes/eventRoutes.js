import express from 'express';
import db from '../config/db.js';

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const { rows } = await db.query(`
      SELECT e.id, e.title
      FROM events e JOIN market_categories c ON c.id = e.category_id
      WHERE c.name = 'Sports' AND e.status <> 'COMPLETED'
      ORDER BY e.start_time NULLS LAST, e.title ASC
    `);

    return res.json({ events: rows });
  } 
  catch (error) {
    return next(error);
  }
});

export default router;
