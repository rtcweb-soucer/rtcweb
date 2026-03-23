// Vercel Serverless Function for InfinitePay Integration
export default async function handler(req, res) {
  const { method, body } = req;

  // Ensure only POST/GET are allowed
  if (method !== 'POST' && method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const API_KEY = process.env.INFINITEPAY_API_KEY;
  const CLIENT_ID = process.env.INFINITEPAY_CLIENT_ID;

  if (!API_KEY || !CLIENT_ID) {
    return res.status(500).json({ error: 'InfinitePay credentials not configured on server' });
  }

  try {
    if (method === 'POST') {
      // Create Payment Link
      // Placeholder for InfinitePay Cloud API V2 implementation
      // Documentation suggests POST to /v2/payment_links or similar
      const response = await fetch('https://api.infinitepay.io/v2/payment_links', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'X-Client-Id': CLIENT_ID,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      const data = await response.json();
      return res.status(response.status).json(data);
    }

    if (method === 'GET') {
      // Check Payment Status
      const { linkId } = req.query;
      if (!linkId) return res.status(400).json({ error: 'Missing linkId' });

      const response = await fetch(`https://api.infinitepay.io/v2/payment_links/${linkId}`, {
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'X-Client-Id': CLIENT_ID
        }
      });

      const data = await response.json();
      return res.status(response.status).json(data);
    }

  } catch (error) {
    console.error('InfinitePay API Error:', error);
    return res.status(500).json({ error: 'Failed to communicate with InfinitePay' });
  }
}
