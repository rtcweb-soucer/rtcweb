import { supabase } from './supabase';

const WEBHOOK_URL = 'https://xjryvzmejpzwzuroquur.supabase.co/functions/v1/whatsapp-webhook';

/**
 * Busca a configuração padrão (URL + apiKey + instanceName) direto do Supabase.
 * Usado por serviços que não têm acesso à config de contexto (aiManagerService, notificationService).
 */
async function getDefaultConfig(): Promise<{ baseUrl: string; apiKey: string; instanceName: string } | null> {
  try {
    const { data: evolutionApi } = await supabase
      .from('api_settings')
      .select('*')
      .eq('service', 'evolution')
      .maybeSingle();

    const settings = evolutionApi?.settings || {};
    if (!settings.baseUrl || !settings.apiKey) return null;

    // Buscar a primeira instância ativa do sistema
    const { data: instances } = await supabase
      .from('whatsapp_instances')
      .select('*')
      .eq('is_active', true)
      .limit(1);

    const instance = instances?.[0];
    if (!instance) return null;

    return {
      baseUrl: settings.baseUrl as string,
      apiKey: (instance.apikey || settings.apiKey) as string,
      instanceName: instance.instance_name as string,
    };
  } catch {
    return null;
  }
}

/**
 * Limpa o número e garante o prefixo 55 se necessário.
 */
function prepareNumber(number: string): string {
  if (!number) return '';
  let clean = number.replace(/\D/g, '');
  if (clean.length >= 10 && !clean.startsWith('55')) {
    clean = '55' + clean;
  }
  return clean;
}

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

      // SEMPRE garantir Webhook
      await this.setWebhook(baseUrl, apiKey, instanceName);

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
    const cleanNumber = prepareNumber(number);
    
    // Diagnóstico: log completo antes de enviar
    console.log('📤 [evolutionService.sendMessage]', {
      url: `${cleanUrl}/message/sendText/${instanceName}`,
      number: cleanNumber,
      original: number,
      textLength: text?.length
    });

    if (!cleanUrl || cleanUrl === 'undefined' || !instanceName) {
      const errMsg = `Configuração incompleta: URL="${cleanUrl}", instância="${instanceName}"`;
      console.error('❌ ' + errMsg);
      throw new Error(errMsg);
    }

    try {
      const response = await fetch(`${cleanUrl}/message/sendText/${instanceName}`, {
        method: 'POST',
        headers: {
          'apikey': apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          number: cleanNumber,
          text: text
        })
      });
      
      const result = await response.json();
      if (!response.ok) {
        console.error('❌ Evolution API Error (Text):', JSON.stringify(result, null, 2));
        const msg = Array.isArray(result?.message)
          ? result.message.join('; ')
          : (result?.message || result?.error || JSON.stringify(result));
        throw new Error(`Erro Evolution API [${response.status}]: ${msg}`);
      }
      console.log('✅ Mensagem enviada com sucesso:', result?.key?.id || 'ok');
      return result;
    } catch (err) {
      console.error('❌ Error sending message:', err);
      throw err;
    }
  },

  async sendMedia(baseUrl: string, apiKey: string, instanceName: string, number: string, base64: string, mediaType: 'image' | 'video' | 'audio' | 'document', fileName: string, caption?: string) {
    const cleanUrl = this.privateCleanUrl(baseUrl);
    const cleanNumber = prepareNumber(number);

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
          number: cleanNumber,
          mediatype: mediaType, 
          media: base64Data,
          mimetype: mediaType === 'audio' ? 'audio/mpeg' : (mediaType === 'image' ? 'image/jpeg' : 'application/pdf'),
          caption: caption || '',
          ptt: mediaType === 'audio',
          fileName: fileName || (mediaType === 'audio' ? 'audio.mp3' : 'file')
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
  },

  /**
   * Envia mensagem de texto buscando automaticamente a config padrão do Supabase.
   * Use este método em serviços que não têm acesso à baseUrl/apiKey/instanceName.
   */
  async sendMessageAuto(number: string, text: string): Promise<any> {
    const config = await getDefaultConfig();
    if (!config) {
      console.warn('⚠️ evolutionService.sendMessageAuto: Nenhuma configuração de Evolution API encontrada.');
      return null;
    }
    return this.sendMessage(config.baseUrl, config.apiKey, config.instanceName, number, text);
  }
} as any;
