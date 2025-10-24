export type CellValue = 'empty' | 'player1' | 'player2';
export type GameStatus = 'waiting' | 'active' | 'completed' | 'forfeited';
export type GameResult = 'win' | 'draw' | 'forfeit';

export interface Position {
  row: number;
  col: number;
}

export interface Player {
  id: string;
  username: string;
  socketId: string;
  isBot: boolean;
}

export interface GameBoard {
  cells: CellValue[][];
}

export interface GameState {
  id: string;
  board: CellValue[][];
  player1: Player;
  player2: Player | null;
  currentTurn: 'player1' | 'player2';
  status: GameStatus;
  winner: string | null;
  createdAt: Date;
  lastMoveAt: Date;
  disconnectedPlayer: string | null;
  disconnectTimeout: NodeJS.Timeout | null;
}

export interface MoveResult {
  success: boolean;
  position?: Position;
  winner?: string;
  isDraw?: boolean;
  error?: string;
}

export interface AnalyticsEvent {
  eventType: 'game_started' | 'game_ended' | 'move_made' | 'player_disconnected' | 'player_reconnected';
  gameId: string;
  timestamp: Date;
  data: {
    player1?: string;
    player2?: string;
    winner?: string;
    duration?: number;
    isVsBot?: boolean;
    movePosition?: Position;
    [key: string]: any;
  };
}

export interface LeaderboardEntry {
  username: string;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
}