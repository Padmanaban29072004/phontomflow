# Deception Layer & Honeypot System

## Philosophy

Instead of simply blocking attackers, PHANTOM-Flow's deception layer **leads them into fake environments** where the system silently records their methods. This turns attackers from a threat into a source of training data.

```
Traditional approach:
  Attack detected -> BLOCK (attacker learns nothing, we learn nothing)

PHANTOM-Flow approach:
  Attack detected -> REDIRECT -> OBSERVE -> LEARN
```

## Architecture

```
                     +-----------+
                     |  Threat   |
                     | Detection |
                     +-----+-----+
                           |
               Critical score (>0.85)?
                           |
                  +--------+--------+
                  |                 |
               No |              Yes|
                  v                 v
            Normal flow      +------+------+
                             |  Deception  |
                             |  Service    |
                             +------+------+
                                    |
                    +---------------+---------------+
                    |               |               |
                    v               v               v
            +-----------+   +-----------+   +-----------+
            | Honeypot  |   | Credential|   | Decoy     |
            | Endpoints |   | Traps     |   | Files     |
            +-----------+   +-----------+   +-----------+
                    |               |               |
                    +-------+-------+---------------+
                            |
                            v
                    +---------------+
                    |  Attack       |
                    |  Recording    |
                    +---------------+
                            |
                            v
                    +---------------+
                    |  Training     |
                    |  Data         |
                    +---------------+
```

## Deception Components

### 1. Honeypot Endpoints

Convincing fake endpoints designed to attract attackers:

| Endpoint | What Attackers Expect | What They Get |
|---|---|---|
| `/admin` | Admin panel | Fake dashboard with "real" data |
| `/api/admin` | Admin API | Fake API that accepts all requests |
| `/internal` | Internal tools | Fake monitoring system |
| `/debug` | Debug endpoints | Fake debug output |
| `/config` | Configuration files | Fake config with "credentials" |
| `/api/users` | User data | Fake user database |
| `/backup` | Backup files | Fake backup archives |

### 2. Credential Traps

Fake credentials placed where attackers will find them:

| Trap | Format | Purpose |
|---|---|---|
| Config files | `admin:admin123`, `root:password` | Credential reuse testing |
| Environment files | `DB_PASSWORD=secret123` | Database access bait |
| API keys | `sk-abc123...` | Service credential bait |
| SSH keys | Fake private keys | Infrastructure access bait |

### 3. Decoy Files

Fake sensitive files that trigger alerts when accessed:

| File | Content | Alert Trigger |
|---|---|---|
| `config.json` | API keys, database URLs | Access = threat |
| `database.sql` | Fake schema with "user data" | Access = threat |
| `secrets.txt` | "Passwords" for internal systems | Access = threat |
| `financial_report.xlsx` | Fake financial data | Download = threat |
| `employee_records.csv` | Fake PII | Access = critical |

### 4. Fake Admin Panels

Full fake web interfaces that:
- Look identical to real admin panels
- Accept any credentials
- Show realistic fake data
- Record every interaction
- Track mouse movements and keystrokes

## Attack Recording

When an attacker interacts with deception environments, PHANTOM-Flow records:

| Data Point | Intelligence Value |
|---|---|
| Attack vectors used | TTP identification |
| Commands executed | Malware/exploit signature |
| Files requested | Targeting pattern |
| Credentials tried | Dictionary/password lists |
| Tools used (user-agent, headers) | Tool fingerprinting |
| Timing between actions | Automated vs. human |
| Navigation path | Reconnaissance pattern |

## Configuration

Deception settings are environment-configurable:

```
HONEYPOT_ENABLED=true
DECEPTION_LEVEL=medium       # low, medium, high
ATTACK_RECORDING_ENABLED=true
TRAP_THRESHOLD=0.8           # Minimum threat score to divert
```

## Intelligence Gathering

Over time, the deception layer builds a **TTP (Tactics, Techniques, Procedures) database**:

- Recording attacker command sequences
- Building malware behavior profiles
- Mapping reconnaissance patterns
- Identifying exploit chains
- Correlating tools and techniques to known threat actors

This intelligence feeds back into:
- Signature updates (blocking known patterns)
- ML model retraining (better detection)
- Honeypot improvement (more convincing traps)
- Threat intelligence reports

## Benefits Over Blocking

| Approach | Block | Deception |
|---|---|---|
| Attacker knowledge | Knows they're detected | Thinks they succeeded |
| Intelligence gained | None | Full attack profile |
| Learning signal | None | Rich training data |
| Attacker time wasted | None | Significant |
| False positive impact | User blocked | User redirected (harmless) |
