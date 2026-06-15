import { Kafka, Producer, Consumer } from 'kafkajs';
import { logger } from '@/utils/logger';

export class KafkaBus {
  private kafka: Kafka;
  private producer: Producer;
  private consumer: Consumer;
  private connected = false;

  constructor() {
    const brokers = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',');
    this.kafka = new Kafka({
      clientId: 'phantom-flow-backend',
      brokers,
      retry: {
        initialRetryTime: 1000,
        retries: 5,
      },
    });
    this.producer = this.kafka.producer();
    this.consumer = this.kafka.consumer({ groupId: 'phantom-flow-backend' });
  }

  async connect(): Promise<void> {
    try {
      await this.producer.connect();
      await this.consumer.connect();
      this.connected = true;
      logger.info('KafkaBus connected');
    } catch (err) {
      logger.warn('KafkaBus connection failed (Kafka may not be available):', (err as Error).message);
    }
  }

  async disconnect(): Promise<void> {
    if (!this.connected) return;
    try {
      await this.producer.disconnect();
      await this.consumer.disconnect();
    } catch (err) {
      logger.warn('KafkaBus disconnect error:', (err as Error).message);
    }
  }

  async publish(topic: string, message: object): Promise<void> {
    if (!this.connected) return;
    try {
      await this.producer.send({
        topic,
        messages: [{ value: JSON.stringify(message) }],
      });
    } catch (err) {
      logger.warn(`KafkaBus publish to ${topic} failed:`, (err as Error).message);
    }
  }

  async subscribe(topic: string, handler: (message: Record<string, unknown>) => Promise<void>): Promise<void> {
    if (!this.connected) return;
    try {
      await this.consumer.subscribe({ topic, fromBeginning: false });
      await this.consumer.run({
        eachMessage: async ({ topic: t, message }) => {
          try {
            const value = JSON.parse(message.value!.toString()) as Record<string, unknown>;
            await handler(value);
          } catch (err) {
            logger.warn(`KafkaBus handler error for ${t}:`, (err as Error).message);
          }
        },
      });
    } catch (err) {
      logger.warn(`KafkaBus subscribe to ${topic} failed:`, (err as Error).message);
    }
  }
}
