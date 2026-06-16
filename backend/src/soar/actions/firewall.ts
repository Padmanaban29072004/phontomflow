import axios from 'axios';

export async function firewallBlockAction(params: { sourceIp: string }): Promise<{ ok: boolean; detail: string }> {
  const pfsenseUrl = process.env.PFSENSE_API_URL;
  const token = process.env.PFSENSE_API_TOKEN;

  if (!pfsenseUrl || !token) {
    return { ok: true, detail: `Simulated firewall block for ${params.sourceIp}` };
  }

  await axios.post(
    `${pfsenseUrl}/api/v1/firewall/block`,
    { ip: params.sourceIp },
    { headers: { Authorization: `Bearer ${token}` }, timeout: 10000 }
  );
  return { ok: true, detail: `Blocked ${params.sourceIp} at firewall` };
}

