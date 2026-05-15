import { GoogleGenAI } from "@google/genai";
import { supabase } from "./supabase";

let aiInstance: GoogleGenAI | null = null;
let currentKey: string | null = null;

const getApiKey = async () => {
    // 1. Tentar variável de ambiente
    const envKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (envKey) return envKey;

    // 2. Tentar banco de dados
    try {
        const { data, error } = await supabase
            .from('api_settings')
            .select('settings')
            .eq('service', 'gemini')
            .single();
        
        if (data?.settings?.apiKey) {
            return data.settings.apiKey;
        }
    } catch (err) {
        console.error("Erro ao buscar Gemini Key no banco:", err);
    }

    return null;
};

const getAI = async () => {
    const key = await getApiKey();
    if (!key) return null;

    if (key !== currentKey || !aiInstance) {
        currentKey = key;
        aiInstance = new GoogleGenAI(key);
    }
    return aiInstance;
};

export const suggestChatMessage = async (messages: any[], customerContext: any) => {
    try {
        const genAI = await getAI();
        if (!genAI) return "Configure a chave do Gemini nas configurações para usar o assistente de IA.";

        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const prompt = `
            Você é um assistente de vendas da empresa RTC - Toldos e Cortinas.
            Sua tarefa é sugerir uma resposta curta, profissional e amigável para o cliente no WhatsApp.

            Contexto do Cliente:
            Nome: ${customerContext.name}
            Interesse: ${customerContext.productInterest?.join(', ') || 'Não especificado'}
            Histórico Recente: ${JSON.stringify(messages.slice(-5))}

            Instruções:
            - Seja direto e resolutivo.
            - Use um tom de voz que transmite confiança e excelência.
            - Se o cliente perguntar algo que você não sabe, sugira agendar uma medição técnica.
            - Retorne APENAS a sugestão de texto, sem comentários extras.
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text();
    } catch (error) {
        console.error("Gemini Error:", error);
        return "Desculpe, tive um erro ao processar sua sugestão. Tente novamente.";
    }
};

// Funções legadas mantidas para compatibilidade (atualizadas para 1.5 flash)
export const getProductionInsights = async (items: any[]) => {
    try {
        const genAI = await getAI();
        if (!genAI) return null;
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        
        const result = await model.generateContent(`Analise estas medições e sugira recomendações técnicas: ${JSON.stringify(items)}`);
        const response = await result.response;
        return { suggestions: [response.text()] };
    } catch (error) {
        return null;
    }
};

export const suggestQuoteValue = async (items: any[]) => {
    try {
        const genAI = await getAI();
        if (!genAI) return null;
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        
        const result = await model.generateContent(`Sugira um valor estimado para: ${JSON.stringify(items)}`);
        const response = await result.response;
        return { estimatedPrice: 0, reasoning: response.text() };
    } catch (error) {
        return null;
    }
};