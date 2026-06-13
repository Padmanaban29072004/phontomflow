export enum NodeLabel {
  User = 'User',
  Session = 'Session',
  IP = 'IP',
  Device = 'Device',
  Resource = 'Resource',
  Threat = 'Threat',
}

export enum RelationshipType {
  USED = 'USED',
  CONNECTED_TO = 'CONNECTED_TO',
  ATTACKED = 'ATTACKED',
  ACCESSED = 'ACCESSED',
  IMPERSONATED = 'IMPERSONATED',
  ORIGINATED_FROM = 'ORIGINATED_FROM',
}

export interface UserNode {
  id: string;
  username: string;
  fingerprint?: string;
  riskScore?: number;
  firstSeen: string;
  lastSeen: string;
}

export interface SessionNode {
  id: string;
  userAgent?: string;
  startTime: string;
  endTime?: string;
  duration?: number;
  actionCount?: number;
  failedLogins?: number;
}

export interface IPNode {
  address: string;
  country?: string;
  city?: string;
  isp?: string;
  asn?: string;
  proxy?: boolean;
  vpn?: boolean;
  tor?: boolean;
  firstSeen: string;
  lastSeen: string;
}

export interface DeviceNode {
  id: string;
  fingerprint?: string;
  os?: string;
  browser?: string;
  screenResolution?: string;
  language?: string;
  firstSeen: string;
  lastSeen: string;
}

export interface ResourceNode {
  id: string;
  path: string;
  method: string;
  type: 'endpoint' | 'file' | 'admin' | 'api';
}

export interface ThreatNode {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  score: number;
  timestamp: string;
  description?: string;
}

export interface RelationshipProperties {
  timestamp?: string;
  duration?: number;
  confidence?: number;
  bytesTransferred?: number;
  statusCode?: number;
  method?: string;
  vector?: string;
  order?: number;
}

export interface GraphNode {
  id: string;
  labels: NodeLabel[];
  properties: Record<string, unknown>;
}

export interface GraphRelationship {
  id: string;
  type: RelationshipType;
  from: string;
  to: string;
  properties: Record<string, unknown>;
}

export interface GraphQueryResult {
  nodes: GraphNode[];
  relationships: GraphRelationship[];
}

export interface CredentialStuffingResult {
  userId: string;
  username: string;
  sessionCount: number;
  ipCount: number;
  suspiciousSessions: number;
  ipRatio: number;
  threatScore: number;
}

export interface BotnetResult {
  deviceId: string;
  relatedDeviceId: string;
  ipCount: number;
  ips: string[];
  threatScore: number;
}

export interface LateralMovementResult {
  userId: string;
  username: string;
  resources: string[];
  hopCount: number;
  threatScore: number;
}

export interface GraphStats {
  nodeCounts: Record<string, number>;
  relationshipCounts: Record<string, number>;
  totalNodes: number;
  totalRelationships: number;
}

export interface GNNExportData {
  nodeFeatures: number[][];
  edgeIndex: number[][];
  nodeLabels: number[];
  nodeTypes: string[];
  trainMask: boolean[];
  valMask: boolean[];
  testMask: boolean[];
}
