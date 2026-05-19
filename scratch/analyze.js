import fs from 'fs';
import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = "AIzaSyCdip8yN1Nh0rQh0aTW2Zkl3yOTwdzGncg";
const genAI = new GoogleGenerativeAI(apiKey);

async function run() {
  const fileContent = fs.readFileSync('C:/Users/SAMSUNG/.gemini/antigravity/brain/a46362fe-986a-445d-a5a7-bf783c756ec6/.system_generated/steps/840/output.txt', 'utf8');
  const parsedFile = JSON.parse(fileContent);
  const data = parsedFile.result;
  
  const startIndex = data.indexOf('[');
  const endIndex = data.lastIndexOf(']');
  if (startIndex === -1 || endIndex === -1) return console.error('No JSON found');
  const jsonStr = data.substring(startIndex, endIndex + 1);
  const quotes = JSON.parse(jsonStr);

  const promptData = quotes.map(q => {
    const date = new Date(q.created_at).toLocaleDateString('pt-BR');
    const daysOpen = Math.floor((new Date() - new Date(q.created_at)) / (1000 * 60 * 60 * 24));
    return `- ${date} (${daysOpen} dias aberto) | Cliente: ${q.customer_name} | Valor: R$ ${q.total_value}`;
  }).join('\n');

  const prompt = `Você é um analista comercial. O usuário solicitou que você analise a lista abaixo de orçamentos não fechados (status QUOTE_SENT). 
Esses são orçamentos que foram enviados, mas não convertidos em vendas ainda. A data atual é 18 de Maio de 2026.

Lista de orçamentos:
${promptData}

Por favor, faça uma análise gerencial focando em:
1. Resumo quantitativo (quantidade de orçamentos, e volume financeiro total retido somando os valores).
2. Orçamentos mais antigos que precisam de atenção urgente (prazos estourados).
3. Padrões que você identificar.
Escreva de forma clara e profissional. Não precisa criar código, apenas a resposta. Formate a resposta em Markdown usando títulos (##).`;

  try {
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      fs.writeFileSync('C:/Users/SAMSUNG/.gemini/antigravity/brain/a46362fe-986a-445d-a5a7-bf783c756ec6/artifacts/analysis_results.md', text);
      console.log("Análise salva com gemini-1.5-pro!");
  } catch (err) {
      console.error("1.5-pro failed, trying another...", err.message);
      try {
          const model2 = genAI.getGenerativeModel({ model: "gemini-pro" });
          const result2 = await model2.generateContent(prompt);
          fs.writeFileSync('C:/Users/SAMSUNG/.gemini/antigravity/brain/a46362fe-986a-445d-a5a7-bf783c756ec6/artifacts/analysis_results.md', result2.response.text());
          console.log("Análise salva com gemini-pro!");
      } catch (err2) {
          console.error("gemini-pro failed:", err2.message);
      }
  }
}

run();
