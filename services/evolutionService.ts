import { supabase } from './supabase';

const WEBHOOK_URL = 'https://xjryvzmejpzwzuroquur.supabase.co/functions/v1/whatsapp-webhook';

export const evolutionService = {
  privateCleanUrl(url: string) {
    return url.replace(/\/$/, '');
  },

  async ensureInstanceExists(baseUrl: string, apiKey: string, instanceName: string, displayName?: string) {
    const cleanUrl = this.privateCleanUrl(baseUrl);
    const headers = {
      'apikey': apiKey,
      'api_key': apiKey,
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    };

    console.log('Verificando instância:', instanceName, 'em', cleanUrl);
    
    try {
      const checkRes = await fetch(`${cleanUrl}/instance/connectionState/${instanceName}`, { headers });
      
      if (checkRes.status === 404 || checkRes.status === 401) {
        console.log(`Instância ${instanceName} não existe. Criando...`);
        await fetch(`${cleanUrl}/instance/create`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            instanceName: instanceName,
            token: apiKey,
            qrcode: true,
            integration: "WHATSAPP-BAILEYS"
          })
        });
      }

      // SEMPRE garantir Webhook e Persistência Local
      await this.setWebhook(baseUrl, apiKey, instanceName);

      if (displayName) {
        await supabase.from('whatsapp_instances').upsert({
          name: displayName,
          instance_name: instanceName,
          apikey: apiKey,
          is_active: true,
          user_id: (await supabase.auth.getUser()).data.user?.id // Tenta pegar o ID do usuário se logado
        }, { onConflict: 'instance_name' });
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (err) {
      console.error('Erro crítico ao verificar/criar instância:', err);
    }
  },

  async setWebhook(baseUrl: string, apiKey: string, instanceName: string) {
    const cleanUrl = this.privateCleanUrl(baseUrl);
    try {
      console.log('Configurando Webhook para:', instanceName);
      await fetch(`${cleanUrl}/webhook/set/${instanceName}`, {
        method: 'POST',
        headers: {
          'apikey': apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          enabled: true,
          url: WEBHOOK_URL,
          webhook_by_events: false,
          events: [
            "MESSAGES_UPSERT",
            "MESSAGES_UPDATE",
            "MESSAGES_DELETE",
            "SEND_MESSAGE",
            "CONNECTION_UPDATE",
            "TYPEBOT_START",
            "TYPEBOT_CHANGE_STATUS"
          ]
        })
      });
    } catch (err) {
      console.error('Erro ao configurar webhook:', err);
    }
  },

  async getConnectionStatus(baseUrl: string, apiKey: string, instanceName: string) {
    const cleanUrl = this.privateCleanUrl(baseUrl);
    try {
      const response = await fetch(`${cleanUrl}/instance/connectionState/${instanceName}`, {
        headers: { 'apikey': apiKey }
      });
      if (response.status === 404) {
        return { instance: { state: 'DISCONNECTED' } };
      }
      return await response.json();
    } catch (err) {
      console.error('Error getting connection status:', err);
      return { instance: { state: 'DISCONNECTED' } };
    }
  },

  async getQRCode(baseUrl: string, apiKey: string, instanceName: string, displayName?: string) {
    const cleanUrl = this.privateCleanUrl(baseUrl);
    
    // Antes de pedir o QR Code, garante que a instância existe e o webhook está ok
    await this.ensureInstanceExists(baseUrl, apiKey, instanceName, displayName);

    try {
      const response = await fetch(`${cleanUrl}/instance/connect/${instanceName}`, {
        headers: { 'apikey': apiKey }
      });
      return await response.json();
    } catch (err) {
      console.error('Error getting QR Code:', err);
      throw err;
    }
  },

  async logout(baseUrl: string, apiKey: string, instanceName: string) {
    const cleanUrl = this.privateCleanUrl(baseUrl);
    try {
      const response = await fetch(`${cleanUrl}/instance/logout/${instanceName}`, {
        method: 'DELETE',
        headers: { 'apikey': apiKey }
      });
      return await response.json();
    } catch (err) {
      console.error('Error during logout:', err);
      throw err;
    }
  },

  async sendMessage(baseUrl: string, apiKey: string, instanceName: string, number: string, text: string) {
    const cleanUrl = this.privateCleanUrl(baseUrl);
    try {
      const response = await fetch(`${cleanUrl}/message/sendText/${instanceName}`, {
        method: 'POST',
        headers: {
          'apikey': apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          number: number,
          text: text
        })
      });
      
      const result = await response.json();
      if (!response.ok) {
        console.error('Evolution API Error (Text):', result);
        throw new Error(result.message || 'Erro ao enviar mensagem de texto via Evolution API');
      }
      return result;
    } catch (err) {
      console.error('Error sending message:', err);
      throw err;
    }
  },

  async sendMedia(baseUrl: string, apiKey: string, instanceName: string, number: string, base64: string, mediaType: 'image' | 'video' | 'audio' | 'document', fileName: string, caption?: string) {
    const cleanUrl = this.privateCleanUrl(baseUrl);
    try {
      // Remover o prefixo data:image/png;base64, se existir
      const base64Data = base64.includes('base64,') ? base64.split('base64,')[1] : base64;
      
      const response = await fetch(`${cleanUrl}/message/sendMedia/${instanceName}`, {
        method: 'POST',
        headers: {
          'apikey': apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          number: number,
          mediatype: mediaType,
          fileName: fileName,
          media: base64Data,
          caption: caption
        })
      });
      
      const result = await response.json();
      if (!response.ok) {
        console.error('Evolution API Error:', result);
        const errorMsg = result.message || result.error || JSON.stringify(result);
        throw new Error(`Erro API Evolution: ${errorMsg}`);
      }
      return result;
    } catch (err) {
      console.error('Error sending media:', err);
      throw err;
    }
  }
} as any;
