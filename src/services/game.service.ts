import { v4 as uuidv4 } from 'uuid';
import { GameState, Player, MoveResult, Position, CellValue } from '../models/types';
import { config } from '../config/env';
import { logger } from '../utils/logger';

class GameService {
  private games: Map<string, GameState> = new Map();

  createGame(player1: Player): GameState {
    const gameId = uuidv4();
    const board: CellValue[][] = Array(config.game.rows)
      .fill(null)
      .map(() => Array(config.game.cols).fill('empty'));

    const game: GameState = {
      id: gameId,
      board,
      player1,
      player2: null,
      currentTurn: 'player1',
      status: 'waiting',
      winner: null,
      createdAt: new Date(),
      lastMoveAt: new Date(),
      disconnectedPlayer: null,
      disconnectTimeout: null,
    };

    this.games.set(gameId, game);
    logger.info(`Game created: ${gameId} by player ${player1.username}`);
    return game;
  }

  getGame(gameId: string): GameState | undefined {
    return this.games.get(gameId);
  }

  getAllActiveGames(): GameState[] {
    return Array.from(this.games.values()).filter(
      (game) => game.status === 'active' || game.status === 'waiting'
    );
  }

  joinGame(gameId: string, player2: Player): GameState | null {
    const game = this.games.get(gameId);
    if (!game || game.player2 || game.status !== 'waiting') {
      return null;
    }

    game.player2 = player2;
    game.status = 'active';
    logger.info(`Player ${player2.username} joined game ${gameId}`);
    return game;
  }

  makeMove(gameId: string, playerId: string, column: number): MoveResult {
    const game = this.games.get(gameId);
    
    if (!game) {
      return { success: false, error: 'Game not found' };
    }

    if (game.status !== 'active') {
      return { success: false, error: 'Game is not active' };
    }

    const currentPlayer = game.currentTurn === 'player1' ? game.player1 : game.player2;
    if (!currentPlayer || currentPlayer.id !== playerId) {
      return { success: false, error: 'Not your turn' };
    }

    if (column < 0 || column >= config.game.cols) {
      return { success: false, error: 'Invalid column' };
    }

    // Find the lowest empty row in the column
    let row = -1;
    for (let r = config.game.rows - 1; r >= 0; r--) {
      if (game.board[r][column] === 'empty') {
        row = r;
        break;
      }
    }

    if (row === -1) {
      return { success: false, error: 'Column is full' };
    }

    // Place the piece
    game.board[row][column] = game.currentTurn;
    game.lastMoveAt = new Date();

    const position: Position = { row, col: column };

    // Check for winner
    if (this.checkWinner(game.board, row, column)) {
      game.status = 'completed';
      game.winner = currentPlayer.id;
      logger.info(`Game ${gameId} won by ${currentPlayer.username}`);
      return { success: true, position, winner: currentPlayer.id };
    }

    // Check for draw
    if (this.isBoardFull(game.board)) {
      game.status = 'completed';
      logger.info(`Game ${gameId} ended in a draw`);
      return { success: true, position, isDraw: true };
    }

    // Switch turns
    game.currentTurn = game.currentTurn === 'player1' ? 'player2' : 'player1';

    return { success: true, position };
  }

  private checkWinner(board: CellValue[][], row: number, col: number): boolean {
    const piece = board[row][col];
    if (piece === 'empty') return false;

    // Check horizontal
    if (this.checkDirection(board, row, col, 0, 1, piece)) return true;
    // Check vertical
    if (this.checkDirection(board, row, col, 1, 0, piece)) return true;
    // Check diagonal /
    if (this.checkDirection(board, row, col, 1, 1, piece)) return true;
    // Check diagonal \
    if (this.checkDirection(board, row, col, 1, -1, piece)) return true;

    return false;
  }

  private checkDirection(
    board: CellValue[][],
    row: number,
    col: number,
    deltaRow: number,
    deltaCol: number,
    piece: CellValue
  ): boolean {
    let count = 1;

    // Check positive direction
    let r = row + deltaRow;
    let c = col + deltaCol;
    while (
      r >= 0 &&
      r < config.game.rows &&
      c >= 0 &&
      c < config.game.cols &&
      board[r][c] === piece
    ) {
      count++;
      r += deltaRow;
      c += deltaCol;
    }

    // Check negative direction
    r = row - deltaRow;
    c = col - deltaCol;
    while (
      r >= 0 &&
      r < config.game.rows &&
      c >= 0 &&
      c < config.game.cols &&
      board[r][c] === piece
    ) {
      count++;
      r -= deltaRow;
      c -= deltaCol;
    }

    return count >= 4;
  }

  private isBoardFull(board: CellValue[][]): boolean {
    return board[0].every((cell) => cell !== 'empty');
  }

  deleteGame(gameId: string): void {
    this.games.delete(gameId);
    logger.info(`Game ${gameId} deleted`);
  }

  setDisconnected(gameId: string, playerId: string): void {
    const game = this.games.get(gameId);
    if (game) {
      game.disconnectedPlayer = playerId;
    }
  }

  clearDisconnected(gameId: string): void {
    const game = this.games.get(gameId);
    if (game) {
      game.disconnectedPlayer = null;
      if (game.disconnectTimeout) {
        clearTimeout(game.disconnectTimeout);
        game.disconnectTimeout = null;
      }
    }
  }

  forfeitGame(gameId: string, playerId: string): void {
    const game = this.games.get(gameId);
    if (game && game.status === 'active') {
      game.status = 'forfeited';
      const opponent =
        game.player1.id === playerId
          ? game.player2
          : game.player1;
      game.winner = opponent?.id || null;
      logger.info(`Game ${gameId} forfeited by player ${playerId}`);
    }
  }
}

export const gameService = new GameService();