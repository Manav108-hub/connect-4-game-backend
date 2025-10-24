import dotenv from 'dotenv';

dotenv.config();

export const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3001', 10),
  databaseUrl: process.env.DATABASE_URL || '',
  kafka: {
    broker: process.env.KAFKA_BROKER || 'localhost:9092',
    clientId: process.env.KAFKA_CLIENT_ID || 'connect-four-game',
    groupId: process.env.KAFKA_GROUP_ID || 'analytics-group',
    topic: 'game-analytics',
  },
  game: {
    matchmakingTimeout: parseInt(process.env.MATCHMAKING_TIMEOUT || '10000', 10),
    reconnectTimeout: parseInt(process.env.RECONNECT_TIMEOUT || '30000', 10),
    rows: 6,
    cols: 7,
  },
};