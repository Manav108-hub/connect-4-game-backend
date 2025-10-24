import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { config } from './config/env';
import { connectDatabase, disconnectDatabase } from './config/database';
import { disconnectKafka } from './config/kafka';
import { logger } from './utils/logger';
import leaderboardRoutes from './routes/leaderboard.routes';
import { GameHandler } from './websocket/game.handler';
import { analyticsConsumer } from './consumer/analytics.consumer';

const app = express();
const httpServer = createServer(app);

// Socket.IO setup with CORS
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/leaderboard', leaderboardRoutes);

// WebSocket connection handler
const gameHandler = new GameHandler(io);
io.on('connection', (socket) => gameHandler.handleConnection(socket));

// Startup
const startServer = async () => {
  try {
    // Connect to database
    await connectDatabase();

    // Start Kafka analytics consumer
    await analyticsConsumer.start();

    // Start server
    httpServer.listen(config.port, () => {
      logger.info(`
╔════════════════════════════════════════╗
║   🎮 Connect Four Server Started      ║
║   Port: ${config.port}                      ║
║   Environment: ${config.nodeEnv}          
╚════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown
const shutdown = async () => {
  logger.info('Shutting down server...');
  
  httpServer.close(() => {
    logger.info('HTTP server closed');
  });

  await disconnectDatabase();
  await disconnectKafka();
  
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Start the server
startServer();