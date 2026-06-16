# PHANTOM-Flow - SOC L1/L2 Automation Build Plan (Claude)

This is the complete task list for extending PHANTOM-Flow into a full SOC L1 and L2 automation platform. Work through phases in order. Each task includes the target file path, tech stack, and difficulty rating.

---

## How to use this file

- Check off tasks as you complete them (`[x]`)
- Work one phase at a time - each phase builds on the previous
- File paths are relative to the PHANTOM-Flow project root
- Difficulty: `easy` = < 2 hrs · `medium` = half day · `hard` = 1-2 days

---

## Phase 1 - Data ingestion & normalisation

> Goal: Every log source (SIEM, EDR, cloud, network) feeds into a single normalised event schema before any detection logic touches it.

- [x] **T1** · Set up Kafka topic schema for unified log events  
  `backend/ingestion/kafka.ts` · TypeScript · `medium`

- [x] **T2** · Write Logstash / Filebeat config to pull from Splunk and ELK  
  `config/logstash.conf` · DevOps · `medium`

- [x] **T3** · Build normalisation middleware - map all sources to common schema (`src_ip`, `dst_ip`, `timestamp`, `event_type`, `severity`, `raw_payload`)  
  `backend/ingestion/normaliser.ts` · TypeScript · `medium`

- [x] **T4** · Wire GeoIP enrichment (MaxMind) on every inbound event  
  `backend/ingestion/enrichment/geoip.ts` · TypeScript · `easy`

- [x] **T5** · Wire VirusTotal and AbuseIPDB enrichment on `src_ip` field  
  `backend/ingestion/enrichment/threatintel.ts` · TypeScript · API · `easy`

- [x] **T6** · Wire asset inventory lookup - tag each event with asset criticality score  
  `backend/ingestion/enrichment/asset.ts` · TypeScript · MongoDB · `easy`

- [x] **T7** · Write integration test - ingest 1000 synthetic events end-to-end and assert normalised schema output  
  `tests/ingestion.test.ts` · Testing · `medium`

---

## Phase 2 - L1 automation: alert triage

> Goal: Automate the L1 analyst workflow - filter noise, classify severity, and trigger obvious responses without human input. Extends the existing BehavioralAnalyzer, StatisticalAnalyzer, and RelationshipAnalyzer.

- [x] **T8** · Add Sigma rule parser to the detection engine - load `.yml` rule files and evaluate against normalised events  
  `backend/detection/sigma.ts` · TypeScript · `hard`

- [x] **T9** · Download MITRE ATT&CK STIX dataset and load into MongoDB as a reference collection  
  `scripts/load_mitre.ts` · TypeScript · MongoDB · `easy`

- [x] **T10** · Map existing BehavioralAnalyzer + StatisticalAnalyzer outputs to ATT&CK TTP IDs  
  `backend/detection/ttp_mapper.ts` · TypeScript · `medium`

- [x] **T11** · Build Payload Heuristics engine (5th missing detection engine) - inspect request body, headers, and URL for SQLi, XSS, CMDi, and path traversal using regex + ML scoring. Must implement the same interface as the existing four analyzers and return `riskScore`, `threatLevel`, `confidence`, `threatType`  
  `backend/detection/payloadHeuristics.ts` · TypeScript · ML · `hard`

- [x] **T12** · Add YARA rule integration for file and payload scanning  
  `backend/detection/yara.ts` · TypeScript · Python · `hard`

- [x] **T13** · Build auto-triage decision logic - map combined risk score + confidence to one of three outcomes: `close` (false positive), `auto-respond` (known threat), `escalate` (high severity -> L2)  
  `backend/triage/decisionEngine.ts` · TypeScript · `medium`

- [x] **T14** · Add false-positive suppression - whitelist engine with per-rule tuning stored in Redis  
  `backend/triage/whitelist.ts` · TypeScript · Redis · `medium`

- [x] **T15** · Write unit tests for all 5 detection engines using known attack fixture datasets (PCAP samples, OWASP payloads)  
  `tests/detection.test.ts` · Testing · `medium`

---

## Phase 3 - SOAR playbook executor

> Goal: Turn PHANTOM-Flow from a passive detector into an active responder. When L1 triage says `auto-respond`, a playbook fires and takes real action - no human needed.

- [x] **T16** · Design playbook JSON schema - trigger conditions, ordered action steps, rollback steps, and timeout config  
  `backend/soar/playbook.schema.ts` · TypeScript · `medium`

- [x] **T17** · Build playbook executor engine - parse a playbook JSON and run each action step sequentially with error handling, retries, and rollback on failure  
  `backend/soar/executor.ts` · TypeScript · `hard`

- [x] **T18** · Implement firewall block action - call iptables or pfSense API to block a source IP  
  `backend/soar/actions/firewall.ts` · TypeScript · API · `medium`

- [x] **T19** · Implement EDR quarantine action - call CrowdStrike or SentinelOne API to isolate an endpoint  
  `backend/soar/actions/edr.ts` · TypeScript · API · `medium`

- [x] **T20** · Implement credential reset action - call Active Directory or IAM API to force password reset  
  `backend/soar/actions/iam.ts` · TypeScript · API · `medium`

- [x] **T21** · Implement alert notification action - send Slack message and PagerDuty incident via webhook  
  `backend/soar/actions/notify.ts` · TypeScript · Webhook · `easy`

- [x] **T22** · Write 5 default L1 playbooks as JSON files:
  - `port_scan_response.json`
  - `brute_force_response.json`
  - `data_exfil_response.json`
  - `malware_hash_block.json`
  - `honeypot_trigger_response.json`  
  `backend/soar/playbooks/` · Config · `medium`

- [x] **T23** · Add playbook audit log - every action execution written to MongoDB with `playbook_id`, `action`, `timestamp`, `result`, `operator` (system or human)  
  `backend/soar/auditLog.ts` · TypeScript · MongoDB · `easy`

- [x] **T24** · Build playbook management REST API - CRUD endpoints and a manual trigger endpoint for testing  
  `backend/routes/playbooks.ts` · TypeScript · API · `medium`

---

## Phase 4 - L2 multi-agent investigation (LangGraph)

> Goal: Build the L2 brain as a Python microservice. When a high-severity alert escalates, five specialised agents automatically investigate, reconstruct the attack, and produce a complete incident report - so the human analyst reviews, not investigates from scratch.

- [x] **T25** · Set up LangGraph Python microservice with FastAPI - isolated service, Dockerised, exposes a single `/investigate` POST endpoint  
  `services/l2-agent/main.py` · Python · FastAPI · `medium`

- [x] **T26** · Build context aggregator agent - pull all events related to the flagged entity (same IP, user, host) from MongoDB and InfluxDB across a 72-hour window  
  `services/l2-agent/agents/context.py` · Python · LangGraph · `medium`

- [x] **T27** · Build TTP mapper agent - take the aggregated event sequence and map observed behaviours to MITRE ATT&CK techniques using the STIX dataset and an LLM call  
  `services/l2-agent/agents/ttp.py` · Python · LangGraph · LLM · `hard`

- [x] **T28** · Build forensic timeline agent - reconstruct the kill chain from first event to impact: initial access -> execution -> persistence -> lateral movement -> exfiltration  
  `services/l2-agent/agents/timeline.py` · Python · LangGraph · `hard`

- [x] **T29** · Build risk scorer agent - compute overall incident severity by weighing asset criticality, blast radius (number of affected hosts), and data classification of accessed resources  
  `services/l2-agent/agents/risk.py` · Python · LangGraph · `medium`

- [x] **T30** · Build report generator agent - call Claude API or OpenAI API to produce a structured incident report: executive summary, affected systems, TTP list, root cause, recommended remediation steps  
  `services/l2-agent/agents/report.py` · Python · LangGraph · Claude API · `medium`

- [x] **T31** · Wire LangGraph state machine - connect all 5 agents into an orchestrated pipeline with typed state, conditional edges, and error handling  
  `services/l2-agent/graph.py` · Python · LangGraph · `hard`

- [x] **T32** · Expose L2 agent via REST - the Node.js backend calls `/investigate` on high-severity escalation and stores the returned report in MongoDB  
  `services/l2-agent/routes.py` · Python · FastAPI · `easy`

- [x] **T33** · Connect TheHive - automatically push the generated incident report as a new TheHive case with severity, TTP tags, and IOCs attached  
  `services/l2-agent/connectors/thehive.py` · Python · API · `medium`

- [x] **T34** · Write integration test - feed a real APT scenario (e.g. simulated Cobalt Strike beacon sequence) and assert that the report correctly identifies the kill chain  
  `tests/l2_agent.test.py` · Testing · Python · `hard`

---

## Phase 5 - Neo4j graph integration

> Goal: Replace the in-memory RelationshipAnalyzer with a real graph database. This unlocks L2-scale kill chain queries - "show me every host this IP touched in the last 6 hours" becomes a single Cypher query.

- [x] **T35** · Spin up Neo4j in Docker and connect to the Node.js backend  
  `docker-compose.yml` + `backend/db/neo4j.ts` · DevOps · Neo4j · `easy`

- [x] **T36** · Define graph schema - nodes: `IP`, `User`, `Host`, `Domain`, `File`; edges: `CONNECTED_TO`, `AUTHENTICATED_AS`, `ACCESSED`, `EXECUTED`, `TRANSFERRED_TO`  
  `backend/db/neo4j.schema.ts` · TypeScript · Neo4j · `medium`

- [x] **T37** · Migrate RelationshipAnalyzer from in-memory arrays to Neo4j Cypher queries - same external interface, real graph backend  
  `backend/detection/relationshipAnalyzer.ts` · TypeScript · Neo4j · `hard`

- [x] **T38** · Build kill chain query - given a source IP and time window, return the full subgraph of all nodes touched  
  `backend/graph/killchain.ts` · TypeScript · Neo4j · `medium`

- [x] **T39** · Build lateral movement detection query - identify pivot paths between hosts using graph traversal  
  `backend/graph/lateralMovement.ts` · TypeScript · Neo4j · `hard`

- [x] **T40** · Feed graph data to the existing frontend Graph dashboard page - replace mock data with real Neo4j queries  
  `backend/routes/graph.ts` · TypeScript · API · `medium`

- [x] **T41** · Write Cypher query tests - seed a known attack scenario graph and assert query correctness  
  `tests/graph.test.ts` · Testing · `medium`

---

## Phase 6 - Bandit response learning

> Goal: Make PHANTOM-Flow learn which response action works best for each threat type over time. Uses Thompson Sampling (Bayesian bandit) so the system gets smarter with every incident it handles.

- [x] **T42** · Design reward function - `+1` block success with no user impact, `-1` false positive (blocked legitimate user), `-2` missed detection (attack succeeded)  
  `backend/bandit/reward.ts` · TypeScript · `medium`

- [x] **T43** · Implement Thompson Sampling bandit - Beta distribution per arm, Bayesian update on each reward signal  
  `backend/bandit/thompson.ts` · TypeScript · ML · `hard`

- [x] **T44** · Build Multi-Armed Bandit framework - action registry (arms), arm performance tracking, exploration vs exploitation policy, Redis-persisted state  
  `backend/bandit/mab.ts` · TypeScript · Redis · `hard`

- [x] **T45** · Wire bandit into SOAR executor - bandit selects the playbook, executor runs it, outcome is fed back as reward signal  
  `backend/soar/executor.ts` · TypeScript · `hard`

- [x] **T46** · Add bandit metrics to InfluxDB - arm selection counts, reward history, exploitation rate, regret over time  
  `backend/metrics/bandit.ts` · TypeScript · InfluxDB · `medium`

- [x] **T47** · Build bandit performance dashboard panel - arm win rates and reward trends as charts in the Analytics page  
  `frontend/pages/Analytics.tsx` · React · `medium`

- [x] **T48** · Write bandit simulation test - run 10,000 episodes on synthetic attack data and assert the bandit converges to the best arm within 500 episodes  
  `tests/bandit.test.ts` · Testing · ML · `hard`

---

## Summary

| Phase | Tasks | Focus |
|---|---|---|
| 1 - Ingestion | 7 | Normalise all log sources into one schema |
| 2 - L1 triage | 8 | Sigma rules, payload heuristics, auto-triage decision |
| 3 - SOAR | 9 | Playbook executor, firewall/EDR/IAM actions |
| 4 - L2 agents | 10 | LangGraph multi-agent investigation pipeline |
| 5 - Neo4j graph | 7 | Real graph DB for kill chain and lateral movement |
| 6 - Bandit learning | 7 | Thompson Sampling adaptive response selector |
| **Total** | **48** | |

### Difficulty breakdown

- `easy` - configuration, API wiring, simple helpers
- `medium` - feature implementation with clear spec
- `hard` - Sigma parser, Payload Heuristics engine, LangGraph orchestration, Neo4j migration, Thompson Sampling - budget 1-2 days each

### Suggested OpenCode workflow

1. Upload this file to OpenCode at the start of each session
2. Tell OpenCode which task you are working on by ID (e.g. "work on T11")
3. Paste the relevant existing file (e.g. `behavioralAnalyzer.ts`) so OpenCode can match the interface
4. After completing a task, check it off and move to the next

