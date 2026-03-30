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
    const { handle, apiKey, env } = settings;
    const isSandbox = env === 'sandbox';
    // Base URL na doc fornecida não separa sandbox, mas usaremos a padrão
    const baseUrl = 'https://api.infinitepay.io';

    // LÓGICA DE CONSULTA (GET) - payment_check POST
    if (req.method === 'GET') {
      const { orderNsu, paymentId } = req.query; // paymentId aqui seria o "slug" na v1
      if (!orderNsu) return res.status(400).json({ error: 'Missing order_nsu' });

      const payload = {
        handle: handle,
        order_nsu: orderNsu,
        slug: paymentId // Na V1 o ID retornado é o slug
      };

      const response = await fetch(`${baseUrl}/invoices/public/checkout/payment_check`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(apiKey ? { 'X-Api-Key': apiKey } : {})
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) return res.status(200).json({ status: 'PENDING' });

      const text = await response.text();
      if (!text) return res.status(200).json({ status: 'PENDING' });

      const result = JSON.parse(text);
      return res.status(200).json({ 
        status: result.paid ? 'PAID' : 'PENDING',
        raw: result 
      });
    }

    // LÓGICA DE CRIAÇÃO (POST) - /invoices/public/checkout/links
    if (req.method === 'POST') {
      const { amount, description, paymentMethod, orderNsu, customer, redirectUrl } = req.body;

      if (!handle) throw new Error('InfiniteTag (Handle) não configurada');

      const payload = {
        handle: handle,
        items: [
          {
            quantity: 1,
            price: Math.round(amount * 100), // InfinitePay V1 espera centavos? Preciso checar.
            description: description || 'Pagamento RTC'
          }
        ],
        order_nsu: orderNsu,
        redirect_url: redirectUrl || 'https://rtcweb.vercel.app/finance',
        webhook_url: 'https://rtcweb.vercel.app/api/infinitepay-webhook'
      };

      if (customer) {
        let cleanPhone = (customer.phone || '').replace(/\D/g, '');
        if (cleanPhone && !cleanPhone.startsWith('55')) {
          cleanPhone = '55' + cleanPhone;
        }
        if (cleanPhone) {
          cleanPhone = '+' + cleanPhone;
        }

        payload.customer = {
          name: customer.name,
          email: customer.email,
          phone_number: cleanPhone
        };
      }

      const response = await fetch(`${baseUrl}/invoices/public/checkout/links`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { 'X-Api-Key': apiKey } : {})
        },
        body: JSON.stringify(payload)
      });

      const text = await response.text();
      let result = {};
      try {
        result = text ? JSON.parse(text) : {};
      } catch (e) {
        throw new Error('Resposta inválida da InfinitePay: ' + (text || 'Vazio'));
      }

      if (!response.ok) throw new Error(result.message || result.error || 'Erro ao gerar checkout InfinitePay');

      // result.url contém o link
      return res.status(200).json({
        type: paymentMethod === 'PIX' ? 'PIX' : 'LINK',
        url: result.url,
        id: result.slug || result.id, // slug é usado para checagem na V1
        pixCode: result.br_code || null,
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('InfinitePay Proxy Error:', error);
    return res.status(500).json({ error: error.message });
  }
};
