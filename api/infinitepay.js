const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  // Configuração Supabase para buscar credenciais
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const getCredentials = async () => {
    const { data: apiData, error: apiError } = await supabase
      .from('api_settings')
      .select('settings')
      .eq('service', 'infinitepay')
      .single();

    if (apiError || !apiData) {
      throw new Error('InfinitePay credentials not found in database');
    }
    return apiData.settings;
  };

  try {
    const settings = await getCredentials();
    const { clientId, clientSecret, env } = settings;
    const isSandbox = env === 'sandbox';
    const baseUrl = isSandbox ? 'https://cloud-sandbox.infinitepay.io' : 'https://cloud.infinitepay.io';

    // 2. Get Access Token (OAuth2 Client Credentials)
    const getAccessToken = async () => {
       const tokenResponse = await fetch(`${baseUrl}/v2/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grant_type: 'client_credentials',
          client_id: clientId,
          client_secret: clientSecret,
          scope: 'payment_link pix'
        })
      });

      const tokenData = await tokenResponse.json();
      if (!tokenResponse.ok) throw new Error(tokenData.message || 'Failed to get access token');
      return tokenData.access_token;
    };

    const accessToken = await getAccessToken();

    // LÓGICA DE CONSULTA (GET)
    if (req.method === 'GET') {
      const { paymentId, type } = req.query;
      if (!paymentId) return res.status(400).json({ error: 'Missing paymentId' });

      // Consultar status (Endpoint fictício baseado no padrão V2 da InfinitePay)
      const endpoint = type === 'PIX' ? `${baseUrl}/v2/pix/charges/${paymentId}` : `${baseUrl}/v2/payment_links/${paymentId}`;
      const statusResponse = await fetch(endpoint, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });

      const statusData = await statusResponse.json();
      if (!statusResponse.ok) throw new Error(statusData.message || 'Failed to check status');

      // Mapear status para o padrão do sistema (PENDING/PAID)
      let status = 'PENDING';
      if (type === 'PIX') {
        if (statusData.status === 'COMPLETED' || statusData.status === 'PAID') status = 'PAID';
      } else {
        // Para links, geralmente checamos se houve alguma transação confirmada vinculada ao link
        if (statusData.status === 'PAID' || (statusData.transactions && statusData.transactions.some(t => t.status === 'APPROVED'))) {
          status = 'PAID';
        }
      }

      return res.status(200).json({ status, raw: statusData });
    }

    // LÓGICA DE CRIAÇÃO (POST)
    if (req.method === 'POST') {
      const { amount, description, paymentMethod, maxInstallments } = req.body;

      if (paymentMethod === 'PIX') {
        const pixResponse = await fetch(`${baseUrl}/v2/pix/charges`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            amount: amount,
            description: description || 'Pagamento RTC',
          })
        });

        const pixResult = await pixResponse.json();
        if (!pixResponse.ok) throw new Error(pixResult.message || 'Failed to create PIX');

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
            max_installments: maxInstallments || 12, // Parâmetro de limite de parcelas
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
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('InfinitePay Proxy Error:', error);
    return res.status(500).json({ error: error.message });
  }
};
