import * as fs from 'fs';

const file = 'C:/Users/SAMSUNG/Downloads/rtc---toldos-&-cortinas/rtcweb/pages/IAManager.tsx';
let code = fs.readFileSync(file, 'utf8');

// 1. Add missing lucide-react icons
const lucideSearch = /import \{([^}]+)\} from 'lucide-react';/s;
if (lucideSearch.test(code)) {
    code = code.replace(lucideSearch, (match, p1) => {
        let imports = p1;
        if (!imports.includes('Flame')) imports += ', Flame';
        if (!imports.includes('MessageCircle')) imports += ', MessageCircle';
        return `import {${imports}} from 'lucide-react';`;
    });
}

// 2. Add evolutionService import if missing
if (!code.includes("import { evolutionService }")) {
    code = code.replace(
        "import { aiManagerService, SellerPerformance } from '../services/aiManagerService';",
        "import { aiManagerService, SellerPerformance } from '../services/aiManagerService';\nimport { evolutionService } from '../services/evolutionService';"
    );
}

// 3. Add handleSendWhatsAppPromo and handleSendWhatsAppTranquil
if (!code.includes("handleSendWhatsAppPromo")) {
    const handleSendReminderSearch = "const handleSendReminder = async (seller: Seller, quotes: Order[]) => {";
    
    const handlerCode = `
  const handleSendWhatsAppPromo = async (phone?: string, name?: string) => {
    if (!phone) {
      alert('Cliente sem telefone cadastrado.');
      return;
    }
    const msg = \`Olá *\${name || 'Cliente'}*, tudo bem? Vi que seu orçamento está em aberto. Conseguimos uma condição especial com um desconto exclusivo para fechar o projeto, mas é válida somente até amanhã! Vamos aproveitar?\`;
    try {
      await evolutionService.sendMessageAuto(phone, msg);
      alert('Mensagem agressiva enviada com sucesso!');
    } catch (err: any) {
      alert(\`Erro ao enviar mensagem: \${err.message}\`);
    }
  };

  const handleSendWhatsAppTranquil = async (phone?: string, name?: string) => {
    if (!phone) {
      alert('Cliente sem telefone cadastrado.');
      return;
    }
    const msg = \`Olá *\${name || 'Cliente'}*, tudo bem? Passando apenas para saber se você conseguiu analisar o nosso orçamento e se ficou com alguma dúvida. Estou à disposição para ajudar no que precisar!\`;
    try {
      await evolutionService.sendMessageAuto(phone, msg);
      alert('Mensagem tranquila enviada com sucesso!');
    } catch (err: any) {
      alert(\`Erro ao enviar mensagem: \${err.message}\`);
    }
  };

  const handleSendReminder = async (seller: Seller, quotes: Order[]) => {`;

    code = code.replace(handleSendReminderSearch, handlerCode);
}

// 4. Update the Ação cell
const oldCell = '<td className="px-6 py-4 text-center">\n                             <button onClick={() => { setActiveHtmlQuote(quote); setIsHtmlModalOpen(true); }} className="p-2 text-purple-600 hover:text-purple-800 hover:bg-purple-50 rounded-xl transition-all inline-flex" title="Visualizar Contrato">\n                               <FileText size={16} />\n                             </button>\n                           </td>';
const newCell = `<td className="px-6 py-4 text-center space-x-2 whitespace-nowrap">
                             <button onClick={() => { setActiveHtmlQuote(quote); setIsHtmlModalOpen(true); }} className="p-2 text-purple-600 hover:text-purple-800 hover:bg-purple-50 rounded-xl transition-all inline-flex" title="Visualizar Contrato">
                               <FileText size={16} />
                             </button>
                             <button onClick={() => handleSendWhatsAppPromo(customer?.phone, customer?.name)} className="p-2 text-amber-500 hover:text-amber-700 hover:bg-amber-50 rounded-xl transition-all inline-flex" title="Ação Agressiva (Promoção e Escassez)">
                               <Flame size={16} />
                             </button>
                             <button onClick={() => handleSendWhatsAppTranquil(customer?.phone, customer?.name)} className="p-2 text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl transition-all inline-flex" title="Ação Tranquila (Acompanhamento)">
                               <MessageCircle size={16} />
                             </button>
                           </td>`;

code = code.replace(oldCell, newCell);

fs.writeFileSync(file, code, 'utf8');
console.log("Done");
