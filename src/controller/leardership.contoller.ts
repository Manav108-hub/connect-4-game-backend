import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { logger } from '../utils/logger';

export class LeaderboardController {
  async getLeaderboard(req: Request, res: Response): Promise<void> {
    try {
      const players = await prisma.player.findMany({
        orderBy: [
          { wins: 'desc' },
          { losses: 'asc' },
        ],
        take: 100,
      });

      const leaderboard = players.map((player: { username: any; wins: number; losses: any; draws: any; }) => ({
        username: player.username,
        wins: player.wins,
        losses: player.losses,
        draws: player.draws,
        winRate:
          player.wins + player.losses > 0
            ? ((player.wins / (player.wins + player.losses)) * 100).toFixed(1)
            : '0.0',
      }));

      res.json({ success: true, data: leaderboard });
    } catch (error) {
      logger.error('Error fetching leaderboard:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch leaderboard' });
    }
  }

  async getPlayerStats(req: Request, res: Response): Promise<void> {
    try {
      const { username } = req.params;

      const player = await prisma.player.findUnique({
        where: { username },
      });

      if (!player) {
        res.status(404).json({ success: false, error: 'Player not found' });
        return;
      }

      const stats = {
        username: player.username,
        wins: player.wins,
        losses: player.losses,
        draws: player.draws,
        totalGames: player.wins + player.losses + player.draws,
        winRate:
          player.wins + player.losses > 0
            ? ((player.wins / (player.wins + player.losses)) * 100).toFixed(1)
            : '0.0',
      };

      res.json({ success: true, data: stats });
    } catch (error) {
      logger.error('Error fetching player stats:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch player stats' });
    }
  }
}

export const leaderboardController = new LeaderboardController();