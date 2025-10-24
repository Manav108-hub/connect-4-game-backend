import { CellValue } from '../models/types';
import { config } from '../config/env';
import { logger } from '../utils/logger';

class BotService {
  /**
   * Determines the best move for the bot using strategic analysis
   */
  getBestMove(board: CellValue[][], botPiece: 'player1' | 'player2'): number {
    const opponentPiece: CellValue = botPiece === 'player1' ? 'player2' : 'player1';

    // Priority 1: Win if possible
    for (let col = 0; col < config.game.cols; col++) {
      if (this.canPlacePiece(board, col)) {
        const row = this.getLowestEmptyRow(board, col);
        if (this.wouldWin(board, row, col, botPiece)) {
          logger.debug(`Bot choosing winning move: column ${col}`);
          return col;
        }
      }
    }

    // Priority 2: Block opponent's winning move
    for (let col = 0; col < config.game.cols; col++) {
      if (this.canPlacePiece(board, col)) {
        const row = this.getLowestEmptyRow(board, col);
        if (this.wouldWin(board, row, col, opponentPiece)) {
          logger.debug(`Bot blocking opponent at column ${col}`);
          return col;
        }
      }
    }

    // Priority 3: Create opportunities (look for moves that create 3 in a row)
    for (let col = 0; col < config.game.cols; col++) {
      if (this.canPlacePiece(board, col)) {
        const row = this.getLowestEmptyRow(board, col);
        if (this.createsThreeInRow(board, row, col, botPiece)) {
          logger.debug(`Bot creating opportunity at column ${col}`);
          return col;
        }
      }
    }

    // Priority 4: Play center column if available (strategic advantage)
    const centerCol = Math.floor(config.game.cols / 2);
    if (this.canPlacePiece(board, centerCol)) {
      logger.debug(`Bot choosing center column ${centerCol}`);
      return centerCol;
    }

    // Priority 5: Choose a column near the center
    const validMoves = this.getValidMoves(board);
    const sortedMoves = validMoves.sort((a, b) => {
      return Math.abs(a - centerCol) - Math.abs(b - centerCol);
    });

    logger.debug(`Bot choosing strategic column ${sortedMoves[0]}`);
    return sortedMoves[0];
  }

  private canPlacePiece(board: CellValue[][], col: number): boolean {
    return board[0][col] === 'empty';
  }

  private getLowestEmptyRow(board: CellValue[][], col: number): number {
    for (let row = config.game.rows - 1; row >= 0; row--) {
      if (board[row][col] === 'empty') {
        return row;
      }
    }
    return -1;
  }

  private getValidMoves(board: CellValue[][]): number[] {
    const moves: number[] = [];
    for (let col = 0; col < config.game.cols; col++) {
      if (this.canPlacePiece(board, col)) {
        moves.push(col);
      }
    }
    return moves;
  }

  private wouldWin(
    board: CellValue[][],
    row: number,
    col: number,
    piece: CellValue
  ): boolean {
    // Temporarily place the piece
    const originalValue = board[row][col];
    board[row][col] = piece;

    // Check if this creates a win
    const isWin =
      this.checkDirection(board, row, col, 0, 1, piece) || // horizontal
      this.checkDirection(board, row, col, 1, 0, piece) || // vertical
      this.checkDirection(board, row, col, 1, 1, piece) || // diagonal /
      this.checkDirection(board, row, col, 1, -1, piece); // diagonal \

    // Restore original value
    board[row][col] = originalValue;

    return isWin;
  }

  private createsThreeInRow(
    board: CellValue[][],
    row: number,
    col: number,
    piece: CellValue
  ): boolean {
    // Temporarily place the piece
    const originalValue = board[row][col];
    board[row][col] = piece;

    // Check if this creates 3 in a row
    const hasThree =
      this.countInDirection(board, row, col, 0, 1, piece) >= 3 || // horizontal
      this.countInDirection(board, row, col, 1, 0, piece) >= 3 || // vertical
      this.countInDirection(board, row, col, 1, 1, piece) >= 3 || // diagonal /
      this.countInDirection(board, row, col, 1, -1, piece) >= 3; // diagonal \

    // Restore original value
    board[row][col] = originalValue;

    return hasThree;
  }

  private checkDirection(
    board: CellValue[][],
    row: number,
    col: number,
    deltaRow: number,
    deltaCol: number,
    piece: CellValue
  ): boolean {
    return this.countInDirection(board, row, col, deltaRow, deltaCol, piece) >= 4;
  }

  private countInDirection(
    board: CellValue[][],
    row: number,
    col: number,
    deltaRow: number,
    deltaCol: number,
    piece: CellValue
  ): number {
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

    return count;
  }
}

export const botService = new BotService();