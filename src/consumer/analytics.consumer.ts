import { getConsumer } from '../config/kafka';
import { AnalyticsEvent } from '../models/types';
import { logger } from '../utils/logger';

class AnalyticsConsumer {
  private metrics = {
    totalGames: 0,
    totalMoves: 0,
    avgGameDuration: 0,
    gamesPerHour: new Map<string, number>(),
    playerWins: new Map<string, number>(),
    gamesByDay: new Map<string, number>(),
  };

  async start(): Promise<void> {
    try {
      const consumer = await getConsumer();

      await consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
          try {
            if (!message.value) return;

            const event: AnalyticsEvent = JSON.parse(message.value.toString());
            this.processEvent(event);
          } catch (error) {
            logger.error('Error processing analytics message:', error);
          }
        },
      });

      logger.info('✅ Analytics consumer started');
    } catch (error) {
      logger.error('Failed to start analytics consumer:', error);
    }
  }

  private processEvent(event: AnalyticsEvent): void {
    switch (event.eventType) {
      case 'game_started':
        this.handleGameStarted(event);
        break;
      case 'game_ended':
        this.handleGameEnded(event);
        break;
      case 'move_made':
        this.handleMoveMade(event);
        break;
      case 'player_disconnected':
        this.handlePlayerDisconnected(event);
        break;
      case 'player_reconnected':
        this.handlePlayerReconnected(event);
        break;
    }
  }

  private handleGameStarted(event: AnalyticsEvent): void {
    this.metrics.totalGames++;

    const date = new Date(event.timestamp).toISOString().split('T')[0];
    const currentCount = this.metrics.gamesByDay.get(date) || 0;
    this.metrics.gamesByDay.set(date, currentCount + 1);

    const hour = new Date(event.timestamp).getHours().toString();
    const hourCount = this.metrics.gamesPerHour.get(hour) || 0;
    this.metrics.gamesPerHour.set(hour, hourCount + 1);

    logger.info(
      `📊 Game started: ${event.data.player1} vs ${event.data.player2} ${
        event.data.isVsBot ? '(Bot)' : ''
      }`
    );
  }

  private handleGameEnded(event: AnalyticsEvent): void {
    if (event.data.duration) {
      const currentAvg = this.metrics.avgGameDuration;
      const count = this.metrics.totalGames;
      this.metrics.avgGameDuration =
        (currentAvg * (count - 1) + event.data.duration) / count;
    }

    if (event.data.winner) {
      const currentWins = this.metrics.playerWins.get(event.data.winner) || 0;
      this.metrics.playerWins.set(event.data.winner, currentWins + 1);
    }

    logger.info(
      `📊 Game ended: Winner: ${event.data.winner || 'Draw'}, Duration: ${
        event.data.duration
      }s`
    );
  }

  private handleMoveMade(event: AnalyticsEvent): void {
    this.metrics.totalMoves++;
  }

  private handlePlayerDisconnected(event: AnalyticsEvent): void {
    logger.info(`📊 Player disconnected from game: ${event.gameId}`);
  }

  private handlePlayerReconnected(event: AnalyticsEvent): void {
    logger.info(`📊 Player reconnected to game: ${event.gameId}`);
  }

  getMetrics() {
    return {
      ...this.metrics,
      gamesPerHour: Object.fromEntries(this.metrics.gamesPerHour),
      playerWins: Object.fromEntries(this.metrics.playerWins),
      gamesByDay: Object.fromEntries(this.metrics.gamesByDay),
    };
  }
}

export const analyticsConsumer = new AnalyticsConsumer();