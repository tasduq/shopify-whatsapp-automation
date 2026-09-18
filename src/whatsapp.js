const GRAPH_API_VERSION = process.env.GRAPH_API_VERSION || 'v21.0';
const GRAPH_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}/${process.env.META_PHONE_NUMBER_ID}/messages`;

function log(scope, msg) {
  console.log(`[${new Date().toISOString()}] [${scope}] ${msg}`);
}

async function sendWhatsAppTemplate(to, templateName, params) {
  log('whatsapp', `Sending template "${templateName}" to ${to} with params=${JSON.stringify(params)}`);

  const res = await fetch(GRAPH_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.META_ACCESS_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: templateName,
        language: { code: 'en' },
        components: [
          {
            type: 'body',
            parameters: params.map((text) => ({ type: 'text', text: String(text) }))
          }
        ]
      }
    })
  });

  const data = await res.json();
  if (!res.ok) {
    console.error(`[${new Date().toISOString()}] [whatsapp] FAILED to send "${templateName}" to ${to}:`, JSON.stringify(data));
    throw new Error(`WhatsApp API error (${res.status}): ${JSON.stringify(data)}`);
  }
  log('whatsapp', `Template "${templateName}" ACCEPTED by Meta for ${to} (message_id=${data.messages?.[0]?.id || 'n/a'})`);
  return data;
}

module.exports = { sendWhatsAppTemplate, GRAPH_API_VERSION };
