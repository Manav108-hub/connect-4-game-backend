import { Server, Socket } from 'socket.io';
import { gameService } from '../services/game.service';
import { matchmakingService } from '../services/matchmaking.service';
import { botService } from '../services/bot.service';
import { analyticsService } from '../services/analytic.service';
import { prisma } from '../config/database';
import { Player } from '../models/types';
import { config } from '../config/env';
import { logger } from '../utils/logger';

export class GameHandler {
  private io: Server;

  constructor(io: Server) {
    this.io = io;
  }

  handleConnection(socket: Socket): void {
    logger.info(`Client connected: ${socket.id}`);

    socket.on('find_match', (data: { username: string }) =>
      this.handleFindMatch(socket, data)
    );

    socket.on('make_move', (data: { gameId: string; column: number }) =>
      this.handleMakeMove(socket, data)
    );

    socket.on('rejoin_game', (data: { gameId: string; playerId: string }) =>
      this.handleRejoinGame(socket, data)
    );

    socket.on('disconnect', () => this.handleDisconnect(socket));
  }

  private async handleFindMatch(
    socket: Socket,
    data: { username: string }
  ): Promise<void> {
    try {
      const { username } = data;

      if (!username || username.trim().length === 0) {
        socket.emit('error', { message: 'Username is required' });
        return;
      }

      // Get or create player
      let player = await prisma.player.findUnique({ where: { username } });
      if (!player) {
        player = await prisma.player.create({ data: { username } });
      }

      const playerObj: Player = {
        id: player.id,
        username: player.username,
        socketId: socket.id,
        isBot: false,
      };

      // Try to match with another player
      const gameId = matchmakingService.addPlayerToQueue(playerObj);

      if (gameId) {
        // Matched with another player
        const game = gameService.getGame(gameId);
        if (game && game.player1 && game.player2) {
          socket.join(gameId);
          this.io.to(game.player1.socketId).emit('game_found', {
            gameId: game.id,
            playerId: game.player1.id,
            opponent: game.player2.username,
            isVsBot: game.player2.isBot,
            currentTurn: game.currentTurn,
          });

          socket.emit('game_found', {
            gameId: game.id,
            playerId: game.player2.id,
            opponent: game.player1.username,
            isVsBot: false,
            currentTurn: game.currentTurn,
          });

          await analyticsService.gameStarted(
            game.id,
            game.player1.username,
            game.player2.username,
            game.player2.isBot
          );
        }
      } else {
        // Waiting for opponent (or will match with bot after timeout)
        socket.emit('waiting_for_opponent');

        // Set up timeout to match with bot
        setTimeout(() => {
          if (matchmakingService.isPlayerInQueue(socket.id)) {
            // Find the game where this player was matched with bot
            const games = gameService.getAllActiveGames();
            const game = games.find(
              (g) =>
                (g.player1.id === player!.id || g.player2?.id === player!.id) &&
                g.status === 'active'
            );

            if (game) {
              socket.join(game.id);
              const isPlayer1 = game.player1.id === player!.id;
              socket.emit('game_found', {
                gameId: game.id,
                playerId: player!.id,
                opponent: 'Bot',
                isVsBot: true,
                currentTurn: game.currentTurn,
              });

              analyticsService.gameStarted(
                game.id,
                game.player1.username,
                game.player2?.username || 'Bot',
                true
              );

              // If it's bot's turn, make bot move
              if (
                (isPlayer1 && game.currentTurn === 'player2') ||
                (!isPlayer1 && game.currentTurn === 'player1')
              ) {
                this.makeBotMove(game.id);
              }
            }
          }
        }, config.game.matchmakingTimeout + 100);
      }
    } catch (error) {
      logger.error('Error in handleFindMatch:', error);
      socket.emit('error', { message: 'Failed to find match' });
    }
  }

  private async handleMakeMove(
    socket: Socket,
    data: { gameId: string; column: number }
  ): Promise<void> {
    try {
      const { gameId, column } = data;
      const game = gameService.getGame(gameId);

      if (!game) {
        socket.emit('error', { message: 'Game not found' });
        return;
      }

      const player =
        game.player1.socketId === socket.id ? game.player1 : game.player2;

      if (!player) {
        socket.emit('error', { message: 'Player not found in game' });
        return;
      }

      const result = gameService.makeMove(gameId, player.id, column);

      if (!result.success) {
        socket.emit('error', { message: result.error });
        return;
      }

      // Emit move to both players
      this.io.to(gameId).emit('move_made', {
        position: result.position,
        player: game.currentTurn === 'player1' ? 'player2' : 'player1',
        board: game.board,
      });

      await analyticsService.moveMade(gameId, player.id, result.position!);

      // Check for game end
      if (result.winner || result.isDraw) {
        await this.handleGameEnd(game, result.winner, result.isDraw);
      } else {
        // If opponent is bot and it's bot's turn, make bot move
        const opponent = player.id === game.player1.id ? game.player2 : game.player1;
        if (opponent?.isBot) {
          setTimeout(() => this.makeBotMove(gameId), 500);
        }
      }
    } catch (error) {
      logger.error('Error in handleMakeMove:', error);
      socket.emit('error', { message: 'Failed to make move' });
    }
  }

  private async makeBotMove(gameId: string): Promise<void> {
    const game = gameService.getGame(gameId);
    if (!game || game.status !== 'active') return;

    const bot = game.player2?.isBot ? game.player2 : game.player1.isBot ? game.player1 : null;
    if (!bot) return;

    const botPiece = bot.id === game.player1.id ? 'player1' : 'player2';
    const column = botService.getBestMove(game.board, botPiece);

    const result = gameService.makeMove(gameId, bot.id, column);

    if (result.success) {
      this.io.to(gameId).emit('move_made', {
        position: result.position,
        player: botPiece,
        board: game.board,
      });

      await analyticsService.moveMade(gameId, bot.id, result.position!);

      if (result.winner || result.isDraw) {
        await this.handleGameEnd(game, result.winner, result.isDraw);
      }
    }
  }

  private async handleGameEnd(
    game: any,
    winnerId?: string,
    isDraw?: boolean
  ): Promise<void> {
    const duration = Math.floor(
      (new Date().getTime() - game.createdAt.getTime()) / 1000
    );

    // Update player stats
    if (isDraw) {
      await prisma.player.update({
        where: { id: game.player1.id },
        data: { draws: { increment: 1 } },
      });
      if (game.player2 && !game.player2.isBot) {
        await prisma.player.update({
          where: { id: game.player2.id },
          data: { draws: { increment: 1 } },
        });
      }
    } else if (winnerId) {
      const loserId =
        winnerId === game.player1.id ? game.player2?.id : game.player1.id;

      await prisma.player.update({
        where: { id: winnerId },
        data: { wins: { increment: 1 } },
      });

      if (loserId && !game.player2?.isBot) {
        await prisma.player.update({
          where: { id: loserId },
          data: { losses: { increment: 1 } },
        });
      }
    }

    // Save game to database
    await prisma.game.create({
      data: {
        id: game.id,
        player1Id: game.player1.id,
        player2Id: game.player2?.id || game.player1.id,
        winnerId: winnerId || null,
        status: 'completed',
        board: JSON.stringify(game.board),
        duration,
        isVsBot: game.player2?.isBot || false,
        completedAt: new Date(),
      },
    });

    // Emit game over event
    this.io.to(game.id).emit('game_over', {
      winner: winnerId,
      isDraw,
      board: game.board,
    });

    await analyticsService.gameEnded(
      game.id,
      winnerId ?? undefined,
      duration,
      game.player2?.isBot || false
    );

    // Clean up game
    setTimeout(() => gameService.deleteGame(game.id), 5000);
  }

  private async handleRejoinGame(
    socket: Socket,
    data: { gameId: string; playerId: string }
  ): Promise<void> {
    try {
      const { gameId, playerId } = data;
      const game = gameService.getGame(gameId);

      if (!game) {
        socket.emit('error', { message: 'Game not found' });
        return;
      }

      const player =
        game.player1.id === playerId ? game.player1 : game.player2?.id === playerId ? game.player2 : null;

      if (!player) {
        socket.emit('error', { message: 'Player not in this game' });
        return;
      }

      // Update socket ID
      player.socketId = socket.id;
      socket.join(gameId);

      gameService.clearDisconnected(gameId);

      socket.emit('game_rejoined', {
        gameId: game.id,
        board: game.board,
        currentTurn: game.currentTurn,
        opponent: player.id === game.player1.id ? game.player2?.username : game.player1.username,
      });

      await analyticsService.playerReconnected(gameId, playerId);

      logger.info(`Player ${player.username} rejoined game ${gameId}`);
    } catch (error) {
      logger.error('Error in handleRejoinGame:', error);
      socket.emit('error', { message: 'Failed to rejoin game' });
    }
  }

  private handleDisconnect(socket: Socket): void {
    logger.info(`Client disconnected: ${socket.id}`);

    // Remove from matchmaking queue
    matchmakingService.removePlayerFromQueue(socket.id);

    // Handle disconnect in active games
    const games = gameService.getAllActiveGames();
    const game = games.find(
      (g) =>
        g.player1.socketId === socket.id ||
        (g.player2 && g.player2.socketId === socket.id)
    );

    if (game) {
      const player =
        game.player1.socketId === socket.id ? game.player1 : game.player2;

      if (player && !player.isBot) {
        gameService.setDisconnected(game.id, player.id);

        const timeout = setTimeout(() => {
          const currentGame = gameService.getGame(game.id);
          if (currentGame && currentGame.disconnectedPlayer === player.id) {
            gameService.forfeitGame(game.id, player.id);
            this.handleGameEnd(currentGame, currentGame.winner ?? undefined);
          }
        }, config.game.reconnectTimeout);

        game.disconnectTimeout = timeout;

        analyticsService.playerDisconnected(game.id, player.id);

        // Notify opponent
        const opponent =
          player.id === game.player1.id ? game.player2 : game.player1;
        if (opponent && !opponent.isBot) {
          this.io.to(opponent.socketId).emit('opponent_disconnected');
        }
      }
    }
  }
}