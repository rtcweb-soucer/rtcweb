import { GoogleGenAI, Type } from "@google/genai";

const apiKey = import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;

// Fix: Robust access to Gemini API, non-blocking if key is missing
// The previous code crashed the entire app if the key was missing at startup.
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

export const getProductionInsights = async (items: any[]) => {
  try {
    if (!ai) {
      console.warn("Gemini API Key not found. AI features disabled.");
      return null;
    }
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Analise as seguintes medições de toldos e cortinas e sugira recomendações técnicas para a produção: ${JSON.stringify(items)}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            suggestions: { type: Type.ARRAY, items: { type: Type.STRING } },
            estimatedDifficulty: { type: Type.STRING },
            materialWasteEstimate: { type: Type.STRING }
          },
          required: ["suggestions", "estimatedDifficulty"]
        }
      }
    });
    // Fix: Using response.text property directly as it returns the string output
    const text = response.text || "{}";
    return JSON.parse(text);
  } catch (error) {
    console.error("Gemini Error:", error);
    return null;
  }
};

export const suggestQuoteValue = async (items: any[]) => {
  try {
    if (!ai) {
      console.warn("Gemini API Key not found. AI features disabled.");
      return null;
    }
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Baseado nestas medições, sugira um valor estimado de mercado (em BRL) para o orçamento total: ${JSON.stringify(items)}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            estimatedPrice: { type: Type.NUMBER },
            reasoning: { type: Type.STRING }
          },
          required: ["estimatedPrice", "reasoning"]
        }
      }
    });
    // Fix: Using response.text property directly as it returns the string output
    const text = response.text || "{}";
    return JSON.parse(text);
  } catch (error) {
    console.error("Gemini Error:", error);
    return null;
  }
}