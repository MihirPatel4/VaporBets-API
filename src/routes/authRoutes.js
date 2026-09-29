import express from 'express';
import { requireAuth } from '../authMiddleware.js';
import { getLocation, getProfile, login, logout, register, updateLocation, verifyEmailAddress } from '../controllers/authController.js';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/verify-email', verifyEmailAddress);
router.post('/logout', logout);
router.get('/me', requireAuth, getProfile);
router.get('/me/location', requireAuth, getLocation);
router.put('/me/location', requireAuth, updateLocation);

export default router;