const GRAPH_API_VERSION = process.env.GRAPH_API_VERSION || 'v21.0';
const GRAPH_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}/${process.env.META_PHONE_NUMBER_ID}/messages`;

async function sendWhatsAppTemplate(to, templateName, params) {
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
    console.error('[whatsapp] failed to send template:', JSON.stringify(data));
    throw new Error(`WhatsApp API error (${res.status}): ${JSON.stringify(data)}`);
  }
  return data;
}

module.exports = { sendWhatsAppTemplate, GRAPH_API_VERSION };
