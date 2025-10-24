import { Router } from 'express';
import { leaderboardController } from '../controller/leardership.contoller';

const router = Router();

router.get('/', (req, res) => leaderboardController.getLeaderboard(req, res));
router.get('/player/:username', (req, res) => leaderboardController.getPlayerStats(req, res));

export default router;