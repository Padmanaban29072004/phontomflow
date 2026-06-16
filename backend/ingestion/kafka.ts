import { Consumer, Kafka, Producer } from 'kafkajs';
import { normalizeEvent } from './normaliser';
import { UnifiedEventSchema, KafkaIngestionConfig, NormalizationInput } from './types';
import { enrichWithGeoIp } from './enrichment/geoip';
import { ThreatIntelEnricher } from './enrichment/threatintel';
import { enrichWithAssetContext } from './enrichment/asset';

export class UnifiedEventKafkaPipeline {
  private readonly config: KafkaIngestionConfig;
  private readonly kafka: Kafka;
  private readonly producer: Producer;
  private readonly consumer: Consumer;
  private readonly threatIntel: ThreatIntelEnricher;

  constructor(config?: Partial<KafkaIngestionConfig>) {
    this.config = {
      clientId: config?.clientId || process.env.KAFKA_CLIENT_ID || 'phontomflow-ingestion',
      brokers: config?.brokers || (process.env.KAFKA_BROKERS?.split(',') ?? ['localhost:9092']),
      topic: config?.topic || process.env.KAFKA_UNIFIED_TOPIC || 'phontomflow.unified.events.v1',
      groupId: config?.groupId || process.env.KAFKA_GROUP_ID || 'phontomflow-normaliser-group',
    };

    this.kafka = new Kafka({
      clientId: this.config.clientId,
      brokers: this.config.brokers,
    });
    this.producer = this.kafka.producer();
    this.consumer = this.kafka.consumer({ groupId: this.config.groupId });
    this.threatIntel = new ThreatIntelEnricher();
  }

  public getUnifiedTopic(): string {
    return this.config.topic;
  }

  public async startConsumer(onEvent: (event: UnifiedEventSchema) => Promise<void>): Promise<void> {
    await this.consumer.connect();
    await this.consumer.subscribe({ topic: this.config.topic, fromBeginning: false });

    await this.consumer.run({
      eachMessage: async ({ message }) => {
        if (!message.value) {
          return;
        }
        const parsed = JSON.parse(message.value.toString()) as UnifiedEventSchema;
        await onEvent(parsed);
      },
    });
  }

  public async publishRawEvent(input: NormalizationInput): Promise<UnifiedEventSchema> {
    const normalized = normalizeEvent(input);
    const withGeo = enrichWithGeoIp(normalized);
    const withThreatIntel = await this.threatIntel.enrich(withGeo);
    const fullyEnriched = await enrichWithAssetContext(withThreatIntel);

    await this.producer.connect();
    await this.producer.send({
      topic: this.config.topic,
      messages: [
        {
          key: fullyEnriched.event_id,
          value: JSON.stringify(fullyEnriched),
        },
      ],
    });
    await this.producer.disconnect();

    return fullyEnriched;
  }
}

