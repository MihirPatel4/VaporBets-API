import express from 'express';
import { getEvent, getEvents } from '../controllers/eventController.js';

const router = express.Router();

router.get('/', getEvents);
router.get('/:id', getEvent);

export default router;
