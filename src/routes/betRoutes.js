import express from 'express';
import { requireAuth } from '../authMiddleware.js';
import { getBet, getBets, getWallet, placeBet } from '../controllers/betController.js';

const router = express.Router();

router.get('/wallet', requireAuth, getWallet);
router.get('/', requireAuth, getBets);
router.get('/:id', requireAuth, getBet);
router.post('/', requireAuth, placeBet);

export default router;