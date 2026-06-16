import { spawn } from 'child_process';

export interface YaraScanResult {
  matched: boolean;
  rules: string[];
  engine: 'python-yara' | 'heuristic-fallback';
}

export class YaraScanner {
  public async scanPayload(payload: string): Promise<YaraScanResult> {
    const pythonScript = `
import json
try:
    import yara
    rules = yara.compile(source='rule Suspicious { strings: $a = "powershell" nocase condition: $a }')
    m = rules.match(data=${JSON.stringify(payload)})
    print(json.dumps({"matched": len(m) > 0, "rules": [str(x) for x in m]}))
except Exception:
    print(json.dumps({"matched": False, "rules": []}))
`;

    try {
      const result = await this.executePython(pythonScript);
      return {
        matched: Boolean(result.matched),
        rules: Array.isArray(result.rules) ? result.rules : [],
        engine: 'python-yara',
      };
    } catch {
      const matched = /powershell|cmd\.exe|mimikatz|base64/i.test(payload);
      return {
        matched,
        rules: matched ? ['heuristic.suspicious_payload'] : [],
        engine: 'heuristic-fallback',
      };
    }
  }

  private executePython(script: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const child = spawn('python', ['-c', script], { windowsHide: true });
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (d) => {
        stdout += String(d);
      });
      child.stderr.on('data', (d) => {
        stderr += String(d);
      });
      child.on('close', (code) => {
        if (code !== 0 && !stdout) {
          reject(new Error(stderr || 'python execution failed'));
          return;
        }
        try {
          resolve(JSON.parse(stdout.trim() || '{}'));
        } catch (err) {
          reject(err);
        }
      });
    });
  }
}

