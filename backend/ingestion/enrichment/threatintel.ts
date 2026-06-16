import axios, { AxiosInstance } from 'axios';
import { UnifiedEventSchema } from '../types';

interface ThreatIntelClientOptions {
  virusTotalApiKey?: string;
  abuseIpDbApiKey?: string;
  timeoutMs?: number;
}

export class ThreatIntelEnricher {
  private readonly http: AxiosInstance;
  private readonly virusTotalApiKey?: string;
  private readonly abuseIpDbApiKey?: string;

  constructor(options: ThreatIntelClientOptions = {}) {
    this.http = axios.create({
      timeout: options.timeoutMs ?? 5000,
    });
    this.virusTotalApiKey = options.virusTotalApiKey || process.env.VIRUSTOTAL_API_KEY;
    this.abuseIpDbApiKey = options.abuseIpDbApiKey || process.env.ABUSEIPDB_API_KEY;
  }

  public async enrich(event: UnifiedEventSchema): Promise<UnifiedEventSchema> {
    const [vtScore, abuseScore] = await Promise.all([
      this.fetchVirusTotalScore(event.src_ip),
      this.fetchAbuseIpDbScore(event.src_ip),
    ]);

    const maxScore = Math.max(vtScore ?? 0, abuseScore ?? 0);
    const verdict: 'clean' | 'suspicious' | 'malicious' =
      maxScore >= 80 ? 'malicious' : maxScore >= 40 ? 'suspicious' : 'clean';

    return {
      ...event,
      threat_intel: {
        virustotal_score: vtScore,
        abuseipdb_score: abuseScore,
        tags: this.buildTags(vtScore, abuseScore),
        verdict,
      },
    };
  }

  private buildTags(vt?: number, abuse?: number): string[] {
    const tags: string[] = [];
    if (typeof vt === 'number' && vt >= 60) {
      tags.push('virustotal-high-risk');
    }
    if (typeof abuse === 'number' && abuse >= 60) {
      tags.push('abuseipdb-high-confidence');
    }
    return tags;
  }

  private async fetchVirusTotalScore(ip: string): Promise<number | undefined> {
    if (!this.virusTotalApiKey) {
      return undefined;
    }

    try {
      const response = await this.http.get(`https://www.virustotal.com/api/v3/ip_addresses/${ip}`, {
        headers: { 'x-apikey': this.virusTotalApiKey },
      });
      const malicious = Number(response.data?.data?.attributes?.last_analysis_stats?.malicious ?? 0);
      const suspicious = Number(response.data?.data?.attributes?.last_analysis_stats?.suspicious ?? 0);
      return Math.min(100, (malicious * 10) + (suspicious * 5));
    } catch {
      return undefined;
    }
  }

  private async fetchAbuseIpDbScore(ip: string): Promise<number | undefined> {
    if (!this.abuseIpDbApiKey) {
      return undefined;
    }

    try {
      const response = await this.http.get('https://api.abuseipdb.com/api/v2/check', {
        headers: { Key: this.abuseIpDbApiKey, Accept: 'application/json' },
        params: { ipAddress: ip, maxAgeInDays: 90 },
      });
      return Number(response.data?.data?.abuseConfidenceScore ?? 0);
    } catch {
      return undefined;
    }
  }
}

