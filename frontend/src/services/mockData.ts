export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface MockThreat {
  id: string;
  ipAddress: string;
  riskLevel: RiskLevel;
  threatScore: number;
  userAgent: string;
  timestamp: string | Date;
  threatType: string[];
  status: 'active' | 'resolved' | 'investigating';
  country?: string;
}

export interface MockDashboardMetrics {
  totalRequests: number;
  threatsDetected: number;
  falsePositives: number;
  averageResponseTime: number;
  accuracy: number;
  activeThreats: number;
  blockedAttacks: number;
  systemHealth: number;
}

export interface MockTrap {
  id: string;
  name: string;
  endpoint: string;
  type: string;
  status: string;
  accessCount: number;
}

export interface MockDeceptionEvent {
  id: string;
  type: string;
  ipAddress: string;
  timestamp: string;
  riskLevel: RiskLevel;
  threatLevel: RiskLevel;
}

const randomChoice = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

const randomIp = () =>
  `${Math.floor(Math.random() * 223) + 1}.${Math.floor(Math.random() * 255)}.${Math.floor(
    Math.random() * 255
  )}.${Math.floor(Math.random() * 255)}`;

const userAgents = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
  'curl/7.68.0',
  'python-requests/2.31.0',
];

const countries = ['United States', 'Germany', 'India', 'Brazil', 'Singapore', 'Japan', 'UK', 'France'];

const threatTypes = ['brute_force', 'sql_injection', 'xss', 'ddos', 'scan', 'credential_stuffing'];

const riskLevels: RiskLevel[] = ['low', 'medium', 'high', 'critical'];

export const generateMockDashboardMetrics = (): MockDashboardMetrics => {
  const totalRequests = 50000 + Math.floor(Math.random() * 50000);
  const threatsDetected = 500 + Math.floor(Math.random() * 2000);
  const falsePositives = Math.floor(threatsDetected * 0.05);
  const blockedAttacks = Math.floor(threatsDetected * 0.8);
  const activeThreats = Math.max(threatsDetected - blockedAttacks - falsePositives, 0);

  return {
    totalRequests,
    threatsDetected,
    falsePositives,
    averageResponseTime: 40 + Math.floor(Math.random() * 80),
    accuracy: 92 + Math.random() * 6,
    activeThreats,
    blockedAttacks,
    systemHealth: 80 + Math.floor(Math.random() * 20),
  };
};

export const generateMockThreats = (count = 200): MockThreat[] => {
  const threats: MockThreat[] = [];
  const now = Date.now();

  for (let i = 0; i < count; i++) {
    const riskLevel = randomChoice(riskLevels);
    const scoreBase = riskLevel === 'critical' ? 0.9 : riskLevel === 'high' ? 0.8 : riskLevel === 'medium' ? 0.6 : 0.3;
    const threatScore = Math.min(0.99, Math.max(0.1, scoreBase + (Math.random() - 0.5) * 0.2));
    const timestamp = new Date(now - Math.floor(Math.random() * 24 * 60 * 60 * 1000)).toISOString();

    threats.push({
      id: `mock-threat-${i + 1}`,
      ipAddress: randomIp(),
      riskLevel,
      threatScore,
      userAgent: randomChoice(userAgents),
      timestamp,
      threatType: [randomChoice(threatTypes)],
      status: randomChoice(['active', 'resolved', 'investigating']),
      country: randomChoice(countries),
    });
  }

  return threats.sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
};

export const generateMockTraps = (): MockTrap[] => {
  const baseTraps: Omit<MockTrap, 'accessCount'>[] = [
    { id: 'trap-1', name: 'Admin Panel Honeypot', endpoint: '/admin', type: 'honeypot', status: 'active' },
    { id: 'trap-2', name: 'Credential Trap', endpoint: '/login', type: 'credential_trap', status: 'active' },
    { id: 'trap-3', name: 'API Honey Endpoint', endpoint: '/api/v1/secret', type: 'honeypot', status: 'active' },
    { id: 'trap-4', name: 'SSH Honeypot', endpoint: 'ssh://core-node', type: 'ssh_trap', status: 'active' },
  ];

  return baseTraps.map((trap, idx) => ({
    ...trap,
    accessCount: 50 + idx * 30 + Math.floor(Math.random() * 200),
  }));
};

export const generateMockDeceptionEvents = (count = 100): MockDeceptionEvent[] => {
  const events: MockDeceptionEvent[] = [];
  const eventTypes = ['honeypot_access', 'credential_trap', 'ssh_probe', 'port_scan', 'decoy_file_access'];
  const now = Date.now();

  for (let i = 0; i < count; i++) {
    const riskLevel = randomChoice(riskLevels);
    const timestamp = new Date(now - Math.floor(Math.random() * 6 * 60 * 60 * 1000)).toISOString();
    events.push({
      id: `mock-event-${i + 1}`,
      type: randomChoice(eventTypes),
      ipAddress: randomIp(),
      timestamp,
      riskLevel,
      threatLevel: riskLevel,
    });
  }

  return events.sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
};

export const generateMockThreatTrendData = (points = 24) => {
  const data: { time: string; threats: number; blocked: number }[] = [];
  const now = new Date();

  for (let i = points - 1; i >= 0; i--) {
    const time = new Date(now.getTime() - i * 60 * 60 * 1000);
    const threats = 50 + Math.floor(Math.random() * 150);
    const blocked = Math.floor(threats * (0.6 + Math.random() * 0.3));

    data.push({
      time: time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      threats,
      blocked,
    });
  }

  return data;
};

export const generateMockThreatTypeData = () => {
  const base = threatTypes.map((name) => ({
    name,
    value: 20 + Math.floor(Math.random() * 80),
  }));

  return base;
};

export const generateMockRiskDistributionData = () => {
  return [
    { level: 'Critical', count: 20 + Math.floor(Math.random() * 40) },
    { level: 'High', count: 80 + Math.floor(Math.random() * 60) },
    { level: 'Medium', count: 150 + Math.floor(Math.random() * 80) },
    { level: 'Low', count: 250 + Math.floor(Math.random() * 100) },
  ];
};

export const STATIC_DASHBOARD_METRICS: MockDashboardMetrics = generateMockDashboardMetrics();

export const STATIC_THREATS: MockThreat[] = generateMockThreats(300);

export const STATIC_DECEPTION_TRAPS: MockTrap[] = generateMockTraps();

export const STATIC_DECEPTION_EVENTS: MockDeceptionEvent[] = generateMockDeceptionEvents(150);

export const STATIC_THREAT_TREND_DATA = generateMockThreatTrendData(24);

export const STATIC_THREAT_TYPE_DATA = generateMockThreatTypeData();

export const STATIC_RISK_DISTRIBUTION_DATA = generateMockRiskDistributionData();
