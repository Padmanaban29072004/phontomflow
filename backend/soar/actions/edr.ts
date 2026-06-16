import axios from 'axios';

export async function edrQuarantineAction(params: { hostId: string }): Promise<{ ok: boolean; detail: string }> {
  const edrUrl = process.env.EDR_API_URL;
  const token = process.env.EDR_API_TOKEN;

  if (!edrUrl || !token) {
    return { ok: true, detail: `Simulated EDR quarantine for ${params.hostId}` };
  }

  await axios.post(
    `${edrUrl}/endpoints/${encodeURIComponent(params.hostId)}/quarantine`,
    {},
    { headers: { Authorization: `Bearer ${token}` }, timeout: 10000 }
  );
  return { ok: true, detail: `Quarantined endpoint ${params.hostId}` };
}

