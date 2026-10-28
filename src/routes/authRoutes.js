import express from 'express';
import { requireAuth } from '../authMiddleware.js';
import { getLocation, getProfile, login, logout, register, updateLocation, verifyEmailAddress } from '../controllers/authController.js';
import { createLiveUpdatesTicket } from '../controllers/liveUpdatesController.js';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/verify-email', verifyEmailAddress);
router.post('/logout', logout);
router.get('/me', requireAuth, getProfile);
router.post('/websocket-ticket', requireAuth, createLiveUpdatesTicket);
router.get('/me/location', requireAuth, getLocation);
router.put('/me/location', requireAuth, updateLocation);

export default router;