#!/usr/bin/env bash
set -euo pipefail

echo "Seeding PHANTOM-Flow database..."

# Seed Neo4j with test data
echo "Creating Neo4j graph data..."
docker compose exec -T neo4j cypher-shell -u neo4j -p "${NEO4J_PASSWORD:-dev-password-123}" <<-EOF
MERGE (u:User {id: "user-1", name: "test-user", riskScore: 0.3})
MERGE (s:Session {id: "session-1", ip: "192.168.1.100", userAgent: "Mozilla/5.0"})
MERGE (ip:IP {address: "192.168.1.100", reputation: 0.8})
MERGE (u)-[:USED]->(s)
MERGE (s)-[:ORIGINATED_FROM]->(ip)
RETURN "Seed data created" as result;
EOF

echo "Neo4j seeded."

# Seed InfluxDB with sample metrics
echo "Creating InfluxDB sample data..."
curl -s -X POST "http://localhost:8086/api/v2/write?org=phantom-flow&bucket=metrics&precision=s" \
    -H "Authorization: Token ${INFLUXDB_TOKEN:-dev-token-789}" \
    -H "Content-Type: text/plain" \
    -d "request_rate,service=backend,method=GET count=100i 1712345678" \
    -d "cpu_usage,service=backend,host=node-1 percent=45.2 1712345678" \
    -d "memory_usage,service=backend,host=node-1 mb=256 1712345678"

echo "InfluxDB seeded."

echo "Seed complete!"
