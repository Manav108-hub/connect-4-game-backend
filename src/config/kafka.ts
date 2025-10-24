import { Kafka, Producer, Consumer } from 'kafkajs';
import { config } from './env';
import { logger } from '../utils/logger';

const kafka = new Kafka({
  clientId: config.kafka.clientId,
  brokers: [config.kafka.broker],
  retry: {
    retries: 3,
    initialRetryTime: 300,
  },
});

let producer: Producer | null = null;
let consumer: Consumer | null = null;

export const getProducer = async (): Promise<Producer> => {
  if (!producer) {
    producer = kafka.producer();
    await producer.connect();
    logger.info('✅ Kafka producer connected');
  }
  return producer;
};

export const getConsumer = async (): Promise<Consumer> => {
  if (!consumer) {
    consumer = kafka.consumer({ groupId: config.kafka.groupId });
    await consumer.connect();
    await consumer.subscribe({ topic: config.kafka.topic, fromBeginning: true });
    logger.info('✅ Kafka consumer connected');
  }
  return consumer;
};

export const disconnectKafka = async (): Promise<void> => {
  if (producer) {
    await producer.disconnect();
    logger.info('Kafka producer disconnected');
  }
  if (consumer) {
    await consumer.disconnect();
    logger.info('Kafka consumer disconnected');
  }
};