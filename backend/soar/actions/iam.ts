import axios from 'axios';

export async function iamResetCredentialAction(params: { userId: string }): Promise<{ ok: boolean; detail: string }> {
  const iamUrl = process.env.IAM_API_URL;
  const token = process.env.IAM_API_TOKEN;

  if (!iamUrl || !token) {
    return { ok: true, detail: `Simulated credential reset for ${params.userId}` };
  }

  await axios.post(
    `${iamUrl}/users/${encodeURIComponent(params.userId)}/reset-password`,
    {},
    { headers: { Authorization: `Bearer ${token}` }, timeout: 10000 }
  );
  return { ok: true, detail: `Forced password reset for ${params.userId}` };
}

