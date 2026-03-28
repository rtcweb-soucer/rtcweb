const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { amount, description, paymentMethod } = req.body;

  try {
    // 1. Fetch credentials from Supabase
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: apiData, error: apiError } = await supabase
      .from('api_settings')
      .select('settings')
      .eq('service', 'infinitepay')
      .single();

    if (apiError || !apiData) {
      throw new Error('InfinitePay credentials not found in database');
    }

    const { clientId, clientSecret, env } = apiData.settings;
    const isSandbox = env === 'sandbox';
    const baseUrl = isSandbox ? 'https://cloud-sandbox.infinitepay.io' : 'https://cloud.infinitepay.io';

    // 2. Get Access Token (OAuth2 Client Credentials)
    const tokenResponse = await fetch(`${baseUrl}/v2/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
        scope: isSandbox ? 'payment_link pix' : 'payment_link pix'
      })
    });

    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok) throw new Error(tokenData.message || 'Failed to get access token');

    const accessToken = tokenData.access_token;

    // 3. Create Charge based on Method
    if (paymentMethod === 'PIX') {
      // Create PIX Charge (v2/pix/charges)
      const pixResponse = await fetch(`${baseUrl}/v2/pix/charges`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          amount: amount, // Em centavos? A V2 geralmente usa centavos.
          description: description || 'Pagamento RTC',
        })
      });

      const pixResult = await pixResponse.json();
      if (!pixResponse.ok) throw new Error(pixResult.message || 'Failed to create PIX');

      // Return PIX data (copy and paste code)
      return res.status(200).json({
        type: 'PIX',
        pixCode: pixResult.br_code,
        qrCodeUrl: pixResult.qr_code_url,
        id: pixResult.id
      });

    } else {
      // Create Payment Link (v2/payment_links)
      const linkResponse = await fetch(`${baseUrl}/v2/payment_links`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          amount: amount,
          message: description || 'Pagamento RTC',
          capture_method: 'delayed'
        })
      });

      const linkResult = await linkResponse.json();
      if (!linkResponse.ok) throw new Error(linkResult.message || 'Failed to create Payment Link');

      return res.status(200).json({
        type: 'LINK',
        url: linkResult.url,
        id: linkResult.id
      });
    }

  } catch (error) {
    console.error('InfinitePay Proxy Error:', error);
    return res.status(500).json({ error: error.message });
  }
};
