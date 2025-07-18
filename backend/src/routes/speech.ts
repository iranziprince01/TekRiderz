import { Router } from 'express';
import { speechToText, textToSpeech, checkHealth } from '../controllers/speechController';
import { authenticate } from '../middleware/auth';

const router = Router();

// Health check - no auth required
router.get('/health', checkHealth);

// Protected speech endpoints - require authentication
router.post('/speech-to-text', authenticate, speechToText);
router.post('/text-to-speech', authenticate, textToSpeech);

export default router; 