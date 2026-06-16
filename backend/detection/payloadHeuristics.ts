export interface AnalyzerResult {
  riskScore: number;
  threatLevel: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  threatType: string[];
}

const REGEX_PATTERNS = {
  sqli: /(\bunion\b.*\bselect\b|\bor\s+1=1\b|--|\/\*|\bdrop\b|\binsert\b|\bdelete\b)/i,
  xss: /(<script|javascript:|onerror=|onload=|<img|<svg)/i,
  cmdi: /(\b(cat|ls|whoami|wget|curl|powershell|cmd\.exe)\b|[;&|`]\s*\w+)/i,
  pathTraversal: /(\.\.\/|\.\.\\|%2e%2e%2f|%2e%2e\\)/i,
};

export class PayloadHeuristicsAnalyzer {
  public async analyze(requestData: any): Promise<AnalyzerResult> {
    const body = JSON.stringify(requestData.body || {});
    const headers = JSON.stringify(requestData.headers || {});
    const url = `${requestData.requestPath || ''}?${JSON.stringify(requestData.query || {})}`;
    const sample = `${body}\n${headers}\n${url}`;

    const threatType: string[] = [];
    let score = 0;

    if (REGEX_PATTERNS.sqli.test(sample)) {
      threatType.push('sql_injection');
      score += 0.35;
    }
    if (REGEX_PATTERNS.xss.test(sample)) {
      threatType.push('xss');
      score += 0.25;
    }
    if (REGEX_PATTERNS.cmdi.test(sample)) {
      threatType.push('command_injection');
      score += 0.3;
    }
    if (REGEX_PATTERNS.pathTraversal.test(sample)) {
      threatType.push('path_traversal');
      score += 0.25;
    }

    // Lightweight ML-like adjustment based on density of suspicious chars.
    const suspiciousChars = (sample.match(/[<>'"`;$|&]/g) || []).length;
    score += Math.min(0.2, suspiciousChars / 500);

    const riskScore = Math.min(1, score);
    const confidence = Math.min(1, 0.5 + riskScore / 2);

    const threatLevel =
      riskScore >= 0.85 ? 'critical' : riskScore >= 0.65 ? 'high' : riskScore >= 0.4 ? 'medium' : 'low';

    return {
      riskScore,
      threatLevel,
      confidence,
      threatType: threatType.length ? threatType : ['none'],
    };
  }
}

