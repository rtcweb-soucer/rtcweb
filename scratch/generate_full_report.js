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
  
  let validPendingQuotes = [];

  const now = new Date('2026-05-18T12:00:00Z'); // Current date
  
  quotes.forEach(q => {
    if (q.has_closed_deal !== 'Yes') {
      const daysOpen = Math.floor((now - new Date(q.created_at)) / (1000 * 60 * 60 * 24));
      const val = parseFloat(q.total_value) || 0;
      totalValue += val;
      validPendingQuotes.push({ ...q, daysOpen, val });
    }
  });
  
  validPendingQuotes.sort((a, b) => b.daysOpen - a.daysOpen);
  
  const formatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  
  let markdown = `# Relatório Completo: Orçamentos Pendentes\n\n`;
  markdown += `*Este relatório lista todos os **${validPendingQuotes.length}** orçamentos atualmente com status "Enviado" (QUOTE_SENT) que pertencem a clientes que ainda **não fecharam negócio** (não possuem pedidos "Finalizados" ou em "Produção").*\n\n`;
  markdown += `**Volume Financeiro Total na Mesa:** ${formatter.format(totalValue)}\n\n`;
  
  markdown += `| Dias | Cliente | Data de Emissão | Valor (R$) |\n`;
  markdown += `| :--- | :--- | :--- | :--- |\n`;
  
  validPendingQuotes.forEach(q => {
    const dataEmissao = new Date(q.created_at).toLocaleDateString('pt-BR');
    markdown += `| **${q.daysOpen}** | ${q.customer_name || 'N/A'} | ${dataEmissao} | ${formatter.format(q.val)} |\n`;
  });
  
  console.log(markdown);
}

run();
