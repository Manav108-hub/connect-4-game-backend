import { v4 as uuidv4 } from 'uuid';
import { Player } from '../models/types';
import { gameService } from './game.service';
import { config } from '../config/env';
import { logger } from '../utils/logger';

interface WaitingPlayer {
  player: Player;
  timeout: NodeJS.Timeout;
}

class MatchmakingService {
  private waitingPlayers: Map<string, WaitingPlayer> = new Map();

  addPlayerToQueue(player: Player): string | null {
    // Check if there's already a waiting player
    const waitingEntry = Array.from(this.waitingPlayers.values())[0];

    if (waitingEntry && waitingEntry.player.id !== player.id) {
      // Match found! Clear timeout and create game
      clearTimeout(waitingEntry.timeout);
      this.waitingPlayers.delete(waitingEntry.player.socketId);

      const game = gameService.createGame(waitingEntry.player);
      gameService.joinGame(game.id, player);

      logger.info(`Matched players: ${waitingEntry.player.username} vs ${player.username}`);
      return game.id;
    }

    // No match found, add to queue and set timeout for bot
    const timeout = setTimeout(() => {
      this.matchWithBot(player);
    }, config.game.matchmakingTimeout);

    this.waitingPlayers.set(player.socketId, { player, timeout });
    logger.info(`Player ${player.username} added to matchmaking queue`);
    return null;
  }

  private matchWithBot(player: Player): void {
    const waitingEntry = this.waitingPlayers.get(player.socketId);
    if (!waitingEntry) return;

    this.waitingPlayers.delete(player.socketId);

    const bot: Player = {
      id: uuidv4(),
      username: 'Bot',
      socketId: 'bot',
      isBot: true,
    };

    const game = gameService.createGame(player);
    gameService.joinGame(game.id, bot);

    logger.info(`Player ${player.username} matched with bot`);
  }

  removePlayerFromQueue(socketId: string): void {
    const waitingEntry = this.waitingPlayers.get(socketId);
    if (waitingEntry) {
      clearTimeout(waitingEntry.timeout);
      this.waitingPlayers.delete(socketId);
      logger.info(`Player removed from matchmaking queue`);
    }
  }

  isPlayerInQueue(socketId: string): boolean {
    return this.waitingPlayers.has(socketId);
  }
}

export const matchmakingService = new MatchmakingService();