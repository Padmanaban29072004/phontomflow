import axios from 'axios';

export async function notifyAction(params: { message: string; severity?: string }): Promise<{ ok: boolean; detail: string }> {
  const slackWebhook = process.env.SLACK_WEBHOOK_URL;
  const pagerdutyWebhook = process.env.PAGERDUTY_WEBHOOK_URL;

  if (slackWebhook) {
    await axios.post(slackWebhook, { text: `[${params.severity || 'info'}] ${params.message}` }, { timeout: 10000 });
  }

  if (pagerdutyWebhook) {
    await axios.post(
      pagerdutyWebhook,
      {
        routing_key: process.env.PAGERDUTY_ROUTING_KEY,
        event_action: 'trigger',
        payload: {
          summary: params.message,
          severity: (params.severity || 'warning').toLowerCase(),
          source: 'phontomflow',
        },
      },
      { timeout: 10000 }
    );
  }

  return { ok: true, detail: 'Notifications dispatched (or simulated).' };
}

