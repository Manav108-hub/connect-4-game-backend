import { getProducer } from '../config/kafka';
import { AnalyticsEvent } from '../models/types';
import { config } from '../config/env';
import { logger } from '../utils/logger';

class AnalyticsService {
  async sendEvent(event: AnalyticsEvent): Promise<void> {
    try {
      const producer = await getProducer();
      await producer.send({
        topic: config.kafka.topic,
        messages: [
          {
            key: event.gameId,
            value: JSON.stringify(event),
          },
        ],
      });
      logger.debug(`Analytics event sent: ${event.eventType} for game ${event.gameId}`);
    } catch (error) {
      logger.error('Failed to send analytics event:', error);
    }
  }

  async gameStarted(
    gameId: string,
    player1: string,
    player2: string,
    isVsBot: boolean
  ): Promise<void> {
    await this.sendEvent({
      eventType: 'game_started',
      gameId,
      timestamp: new Date(),
      data: { player1, player2, isVsBot },
    });
  }

  async gameEnded(
    gameId: string,
    winner: string | undefined,
    duration: number,
    isVsBot: boolean
  ): Promise<void> {
    await this.sendEvent({
      eventType: 'game_ended',
      gameId,
      timestamp: new Date(),
      data: { winner, duration, isVsBot },
    });
  }

  async moveMade(
    gameId: string,
    playerId: string,
    position: { row: number; col: number }
  ): Promise<void> {
    await this.sendEvent({
      eventType: 'move_made',
      gameId,
      timestamp: new Date(),
      data: { playerId, movePosition: position },
    });
  }

  async playerDisconnected(gameId: string, playerId: string): Promise<void> {
    await this.sendEvent({
      eventType: 'player_disconnected',
      gameId,
      timestamp: new Date(),
      data: { playerId },
    });
  }

  async playerReconnected(gameId: string, playerId: string): Promise<void> {
    await this.sendEvent({
      eventType: 'player_reconnected',
      gameId,
      timestamp: new Date(),
      data: { playerId },
    });
  }
}

export const analyticsService = new AnalyticsService();