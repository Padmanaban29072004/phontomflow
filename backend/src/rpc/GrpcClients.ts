import path from 'path';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { logger } from '@/utils/logger';

const PROTO_DIR = path.resolve(__dirname, '../../../proto');
const DEFAULT_TIMEOUT_MS = 5000;

export interface PredictResult {
  success: boolean;
  threatScore: number;
  anomalyScore: number;
  confidence: number;
  error?: string;
}

export interface AnalyzeResult {
  success: boolean;
  isMalicious: boolean;
  threatScore: number;
  riskFactors: string[];
  confidence: number;
  error?: string;
}

export interface ThreatAnalysisResult {
  success: boolean;
  threatScore: number;
  confidence: number;
  riskLevel: string;
  threatType: string;
  signaturesMatched: string[];
  error?: string;
}

export class GrpcClients {
  private mlClient?: ReturnType<typeof this.createClient>;
  private rustClient?: ReturnType<typeof this.createClient>;
  private goClient?: ReturnType<typeof this.createClient>;
  private ready = false;
  private mlHost: string;
  private rustHost: string;
  private goHost: string;

  constructor() {
    this.mlHost = process.env.ML_GRPC_HOST || 'localhost:8001';
    this.rustHost = process.env.RUST_GRPC_HOST || 'localhost:9091';
    this.goHost = process.env.GO_GRPC_HOST || 'localhost:8081';
  }

  init(): void {
    try {
      const threatPkg = this.loadPackage('threat_service.proto', 'phantom_flow.threat');
      const mlPkg = this.loadPackage('ml_service.proto', 'phantom_flow.ml');
      const enginePkg = this.loadPackage('engine_service.proto', 'phantom_flow.engine');

      this.goClient = new threatPkg.ThreatAnalysis(this.goHost, grpc.credentials.createInsecure());
      this.mlClient = new mlPkg.MLInference(this.mlHost, grpc.credentials.createInsecure());
      this.rustClient = new enginePkg.SecurityEngine(this.rustHost, grpc.credentials.createInsecure());

      this.ready = true;
      logger.info('gRPC clients initialized');
    } catch (err) {
      logger.warn('gRPC clients init failed (services may not be available):', (err as Error).message);
    }
  }

  private loadPackage(filename: string, packageName: string): Record<string, any> {
    const packageDef = protoLoader.loadSync(path.join(PROTO_DIR, filename), {
      keepCase: false,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    });
    const loaded = grpc.loadPackageDefinition(packageDef) as Record<string, any>;
    const parts = packageName.split('.');
    let result = loaded;
    for (const part of parts) {
      result = result[part];
    }
    return result;
  }

  private createClient(Service: new (...args: any[]) => any, host: string): any {
    return new Service(host, grpc.credentials.createInsecure());
  }

  private callRpc<T>(client: any, method: string, request: Record<string, any>, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!this.ready || !client) {
        reject(new Error('gRPC clients not initialized'));
        return;
      }
      const deadline = new Date();
      deadline.setMilliseconds(deadline.getMilliseconds() + timeoutMs);
      client[method](request, { deadline }, (error: grpc.ServiceError | null, response: T) => {
        if (error) reject(error);
        else resolve(response);
      });
    });
  }

  async predictThreat(
    features: number[],
    ipAddress?: string,
    userAgent?: string,
    requestPath?: string,
    requestMethod?: string,
  ): Promise<PredictResult> {
    try {
      const res = await this.callRpc<any>(this.mlClient, 'Predict', {
        features,
        ipAddress: ipAddress || '',
        userAgent: userAgent || '',
        requestPath: requestPath || '',
        requestMethod: requestMethod || '',
      }, 3000);
      return {
        success: res.success,
        threatScore: res.threatScore,
        anomalyScore: res.anomalyScore,
        confidence: res.confidence,
      };
    } catch (err) {
      return { success: false, threatScore: 0, anomalyScore: 0, confidence: 0, error: (err as Error).message };
    }
  }

  async analyzeWithRust(request: Record<string, any>): Promise<AnalyzeResult> {
    try {
      const res = await this.callRpc<any>(this.rustClient, 'Analyze', request, 5000);
      return {
        success: res.success,
        isMalicious: res.isMalicious,
        threatScore: res.threatScore,
        riskFactors: (res.riskFactors || []) as string[],
        confidence: res.confidence,
      };
    } catch (err) {
      return { success: false, isMalicious: false, threatScore: 0, riskFactors: [], confidence: 0, error: (err as Error).message };
    }
  }

  async analyzeWithGo(request: Record<string, any>): Promise<ThreatAnalysisResult> {
    try {
      const res = await this.callRpc<any>(this.goClient, 'AnalyzeThreat', request, 5000);
      return {
        success: res.success,
        threatScore: res.threatScore,
        confidence: res.confidence,
        riskLevel: res.riskLevel,
        threatType: res.threatType,
        signaturesMatched: (res.signaturesMatched || []) as string[],
      };
    } catch (err) {
      return { success: false, threatScore: 0, confidence: 0, riskLevel: 'unknown', threatType: '', signaturesMatched: [], error: (err as Error).message };
    }
  }
}
