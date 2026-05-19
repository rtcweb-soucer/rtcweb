import fs from 'fs';

async function run() {
  const fileContent = fs.readFileSync('C:/Users/SAMSUNG/.gemini/antigravity/brain/a46362fe-986a-445d-a5a7-bf783c756ec6/.system_generated/steps/840/output.txt', 'utf8');
  const parsedFile = JSON.parse(fileContent);
  const data = parsedFile.result;
  
  const startIndex = data.indexOf('[');
  const endIndex = data.lastIndexOf(']');
  const jsonStr = data.substring(startIndex, endIndex + 1);
  const quotes = JSON.parse(jsonStr);

  let totalValue = 0;
  let count = quotes.length;
  
  const now = new Date('2026-05-18T12:00:00Z'); // Current date
  
  const quotesWithDays = quotes.map(q => {
    const daysOpen = Math.floor((now - new Date(q.created_at)) / (1000 * 60 * 60 * 24));
    const val = parseFloat(q.total_value) || 0;
    totalValue += val;
    return { ...q, daysOpen, val };
  });
  
  quotesWithDays.sort((a, b) => b.daysOpen - a.daysOpen);
  
  const oldest = quotesWithDays.slice(0, 10);
  
  const formatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  
  let markdown = `## Análise Gerencial de Orçamentos Abertos\n\n`;
  markdown += `### 1. Resumo Quantitativo\n`;
  markdown += `- **Total de Orçamentos Pendentes (QUOTE_SENT):** ${count}\n`;
  markdown += `- **Volume Financeiro Total Retido:** ${formatter.format(totalValue)}\n\n`;
  
  markdown += `### 2. Orçamentos Críticos (Mais Antigos)\n`;
  markdown += `Abaixo estão os orçamentos que estão abertos há mais tempo e exigem acompanhamento imediato:\n\n`;
  
  oldest.forEach(q => {
    markdown += `- **${q.daysOpen} dias** | Cliente: ${q.customer_name || 'N/A'} | Valor: ${formatter.format(q.val)} | Emissão: ${new Date(q.created_at).toLocaleDateString('pt-BR')}\n`;
  });
  
  markdown += `\n### 3. Padrões Identificados e Recomendações\n`;
  markdown += `- **Volume expressivo aguardando:** Existe um montante financeiro muito alto retido na fase "Enviado". É recomendável aplicar uma régua de cobrança automática (Fofoqueiro IA) após 48 ou 72 horas para forçar uma resposta.\n`;
  markdown += `- **Orçamentos "Esquecidos":** Há orçamentos abertos desde Fevereiro de 2026 (quase 3 meses atrás). Orçamentos tão antigos distorcem o funil de vendas e precisam ser marcados como "Perdido" se o cliente não responde.\n`;
  markdown += `- **Próximos Passos:** Ativar a Edge Function do *Gerente IA* para notificar os vendedores responsáveis por orçamentos parados há mais de X horas. Isso trará previsibilidade e limpará o funil de propostas abandonadas.\n`;

  console.log(markdown);
}

run();
