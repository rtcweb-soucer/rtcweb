import { GoogleGenerativeAI } from "@google/generative-ai";

async function test() {
    try {
        console.log("Iniciando teste da API Gemini...");
        const aiInstance = new GoogleGenerativeAI("AIzaSyCdip8yN1Nh0rQh0aTW2Zkl3yOTwdzGncg");
        const model = aiInstance.getGenerativeModel({ model: "gemini-1.0-pro" });
        
        console.log("Enviando prompt de teste...");
        const result = await model.generateContent("Responda apenas com: 'Conexão bem sucedida!'");
        const response = await result.response;
        console.log("\n✅ Resposta recebida com sucesso:");
        console.log(response.text());
    } catch (error: any) {
        console.error("❌ Erro ao testar a API do Gemini:");
        console.error(error.message || error);
    }
}

test();
