import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import { createClient } from '@supabase/supabase-js';

const envPath = path.join(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const supabaseUrl = envContent.match(/VITE_SUPABASE_URL=(.*)/)?.[1] || '';
const supabaseKey = envContent.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1] || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: evo } = await supabase.from('api_settings').select('*').eq('service', 'evolution').single();
  const settings = evo.settings;
  const baseUrl = settings.baseUrl.replace(/\/$/, '');
  const apiKey = settings.apiKey;
  const instanceName = 'joao'; // instance of Joao

  const url = `${baseUrl}/message/sendText/${instanceName}`;
  const client = url.startsWith('https') ? https : http;
  
  const payload = JSON.stringify({
    number: '5521999999999', // dummy number
    options: {
      delay: 1200,
      presence: 'composing'
    },
    text: 'Teste de API'
  });

  const req = client.request(url, {
    method: 'POST',
    headers: {
      'apikey': apiKey,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    }
  }, res => {
    let d = '';
    res.on('data', c => d+=c);
    res.on('end', () => console.log('Status:', res.statusCode, 'Response:', d));
  });
  
  req.on('error', console.error);
  req.write(payload);
  req.end();
}

run();
