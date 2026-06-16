import { normalizeEvent } from '../backend/ingestion/normaliser';
import { enrichWithGeoIp } from '../backend/ingestion/enrichment/geoip';
import { ThreatIntelEnricher } from '../backend/ingestion/enrichment/threatintel';
import { enrichWithAssetContext } from '../backend/ingestion/enrichment/asset';

describe('Phase 1 ingestion pipeline', () => {
  it('normalizes 1000 synthetic events with stable schema', async () => {
    const threatIntel = new ThreatIntelEnricher({
      // keep test offline and deterministic
      virusTotalApiKey: '',
      abuseIpDbApiKey: '',
      timeoutMs: 100,
    });

    const events = Array.from({ length: 1000 }, (_, idx) => ({
      source: idx % 2 === 0 ? 'splunk' : 'elk',
      payload: {
        src_ip: `8.8.8.${idx % 250}`,
        dst_ip: '10.10.10.10',
        timestamp: new Date().toISOString(),
        event_type: idx % 3 === 0 ? 'login_failed' : 'http_request',
        severity: idx % 10 === 0 ? 'high' : 'low',
        raw_payload: { id: idx, sample: true },
      },
    }));

    for (const event of events) {
      const normalized = normalizeEvent(event);
      const geo = enrichWithGeoIp(normalized);
      const intel = await threatIntel.enrich(geo);
      const enriched = await enrichWithAssetContext(intel);

      expect(enriched).toHaveProperty('src_ip');
      expect(enriched).toHaveProperty('timestamp');
      expect(enriched).toHaveProperty('event_type');
      expect(enriched).toHaveProperty('severity');
      expect(enriched).toHaveProperty('raw_payload');
      expect(enriched).toHaveProperty('asset.criticality_score');
      expect(typeof enriched.src_ip).toBe('string');
    }
  });
});

