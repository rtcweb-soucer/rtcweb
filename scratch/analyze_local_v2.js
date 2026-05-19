import fs from 'fs';

async function run() {
  const fileContent = fs.readFileSync('C:/Users/SAMSUNG/.gemini/antigravity/brain/a46362fe-986a-445d-a5a7-bf783c756ec6/.system_generated/steps/905/output.txt', 'utf8');
  const parsedFile = JSON.parse(fileContent);
  const data = parsedFile.result;
  
  const startIndex = data.indexOf('[');
  const endIndex = data.lastIndexOf(']');
  const jsonStr = data.substring(startIndex, endIndex + 1);
  const quotes = JSON.parse(jsonStr);

  let totalValue = 0;
  let count = 0;
  
  let validPendingQuotes = [];
  let ignoredCount = 0;

  const now = new Date('2026-05-18T12:00:00Z'); // Current date
  
  quotes.forEach(q => {
    if (q.has_closed_deal === 'Yes') {
      ignoredCount++;
    } else {
      const daysOpen = Math.floor((now - new Date(q.created_at)) / (1000 * 60 * 60 * 24));
      const val = parseFloat(q.total_value) || 0;
      totalValue += val;
      count++;
      validPendingQuotes.push({ ...q, daysOpen, val });
    }
  });
  
  validPendingQuotes.sort((a, b) => b.daysOpen - a.daysOpen);
  
  const oldest = validPendingQuotes.slice(0, 10);
  
  const formatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  
  let markdown = `## Análise Gerencial de Orçamentos Abertos (Corrigida)\n\n`;
  markdown += `### 1. Resumo Quantitativo (Desconsiderando Fechados)\n`;
  markdown += `- **Orçamentos Totalmente Pendentes:** ${count} (Excluímos ${ignoredCount} opções de clientes que fecharam outros orçamentos)\n`;
  markdown += `- **Volume Financeiro Real Retido:** ${formatter.format(totalValue)}\n\n`;
  
  markdown += `### 2. Orçamentos Críticos Reais (Mais Antigos)\n`;
  markdown += `Estes são os clientes que **não fecharam negócio em nenhum dos orçamentos** e estão aguardando retorno há mais tempo:\n\n`;
  
  oldest.forEach(q => {
    markdown += `- **${q.daysOpen} dias** | Cliente: ${q.customer_name || 'N/A'} | Valor: ${formatter.format(q.val)} | Emissão: ${new Date(q.created_at).toLocaleDateString('pt-BR')}\n`;
  });
  
  markdown += `\n### 3. Padrões Identificados e Recomendações\n`;
  markdown += `- **Sua percepção foi perfeita:** Ao remover os orçamentos "alternativos" que não foram os escolhidos, limpamos a sujeira e descobrimos o número real. \n`;
  markdown += `- **Ainda há dinheiro na mesa:** Mesmo filtrando, ainda temos um montante muito alto parado aguardando o cliente "pensar". A IA pode focar cirurgicamente apenas nesses clientes que ainda não bateram o martelo.\n`;

  console.log(markdown);
}

run();
