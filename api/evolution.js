const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { number, text } = req.body;

  if (!number || !text) {
    return res.status(400).json({ error: 'Number and text are required' });
  }

  try {
    // 1. Fetch credentials from Supabase
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: apiData, error: apiError } = await supabase
      .from('api_settings')
      .select('settings')
      .eq('service', 'evolution')
      .single();

    if (apiError || !apiData) {
      throw new Error('Evolution API credentials not found in database');
    }

    const { baseUrl, apiKey, instanceName } = apiData.settings;

    if (!baseUrl || !apiKey || !instanceName) {
      throw new Error('Incomplete Evolution API configuration');
    }

    // 2. Format number (ensure it has country code and no special characters)
    let formattedNumber = number.replace(/\D/g, '');
    if (!formattedNumber.startsWith('55')) {
      formattedNumber = '55' + formattedNumber;
    }

    // 3. Send message via Evolution API
    const response = await fetch(`${baseUrl}/message/sendText/${instanceName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey
      },
      body: JSON.stringify({
        number: formattedNumber,
        options: {
          delay: 1200,
          presence: "composing",
          linkPreview: true
        },
        textMessage: {
          text: text
        }
      })
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || 'Failed to send WhatsApp message');
    }

    return res.status(200).json(result);

  } catch (error) {
    console.error('Evolution API Proxy Error:', error);
    return res.status(500).json({ error: error.message });
  }
};
