import * as fs from 'fs';

const file = 'C:/Users/SAMSUNG/Downloads/rtc---toldos-&-cortinas/rtcweb/pages/IAManager.tsx';
let code = fs.readFileSync(file, 'utf8');

// The block to replace
const startMarker = '{sellerMode && (';
const endMarker = '</>\n                             )}';

const newBlock = `{sellerMode && (
                               <>
                                 <button onClick={() => handleOpenMessageModal('promo', customer?.phone, customer?.name, quote.id, quote.totalValue)} disabled={customerPrefs[customer?.phone?.replace(/\\D/g, '')]?.opt_out || customerPrefs['55'+customer?.phone?.replace(/\\D/g, '')]?.opt_out} className={\`p-2 rounded-xl transition-all inline-flex \${(customerPrefs[customer?.phone?.replace(/\\D/g, '')]?.opt_out || customerPrefs['55'+customer?.phone?.replace(/\\D/g, '')]?.opt_out) ? 'text-slate-300 cursor-not-allowed bg-slate-50' : 'text-amber-500 hover:text-amber-700 hover:bg-amber-50'}\`} title={(customerPrefs[customer?.phone?.replace(/\\D/g, '')]?.opt_out || customerPrefs['55'+customer?.phone?.replace(/\\D/g, '')]?.opt_out) ? 'Bloqueado: Cliente pediu para não receber mensagens' : 'Ação Agressiva (Promoção e Escassez)'}>
                                   <Flame size={16} />
                                 </button>
                                 <button onClick={() => handleOpenMessageModal('tranquil', customer?.phone, customer?.name, quote.id, quote.totalValue)} disabled={customerPrefs[customer?.phone?.replace(/\\D/g, '')]?.opt_out || customerPrefs['55'+customer?.phone?.replace(/\\D/g, '')]?.opt_out} className={\`p-2 rounded-xl transition-all inline-flex \${(customerPrefs[customer?.phone?.replace(/\\D/g, '')]?.opt_out || customerPrefs['55'+customer?.phone?.replace(/\\D/g, '')]?.opt_out) ? 'text-slate-300 cursor-not-allowed bg-slate-50' : 'text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50'}\`} title={(customerPrefs[customer?.phone?.replace(/\\D/g, '')]?.opt_out || customerPrefs['55'+customer?.phone?.replace(/\\D/g, '')]?.opt_out) ? 'Bloqueado: Cliente pediu para não receber mensagens' : 'Ação Tranquila (Acompanhamento)'}>
                                   <MessageCircle size={16} />
                                 </button>
                                 <button onClick={() => handleOpenHistory(quote, customer?.phone)} className="p-2 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-xl transition-all inline-flex" title="Histórico de Conversas">
                                   <History size={16} />
                                 </button>
                                 {customer?.phone && (
                                   <a href={\`https://wa.me/\${customer.phone}\`} target="_blank" rel="noopener noreferrer" className="p-2 text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl transition-all inline-flex" title="Abrir WhatsApp">
                                     <MessageSquareDashed size={16} />
                                   </a>
                                 )}
                                 {customer?.phone && (
                                   <a href={\`tel:\${customer.phone}\`} className="p-2 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-xl transition-all inline-flex" title="Ligar para Cliente">
                                     <Phone size={16} />
                                   </a>
                                 )}
                               </>
                             )}`;

let currentIndex = 0;
while (true) {
  const startIdx = code.indexOf(startMarker, currentIndex);
  if (startIdx === -1) break;
  
  const endIdx = code.indexOf(endMarker, startIdx);
  if (endIdx !== -1) {
    const fullEndIdx = endIdx + endMarker.length;
    const pre = code.substring(0, startIdx);
    const post = code.substring(fullEndIdx);
    code = pre + newBlock + post;
    currentIndex = pre.length + newBlock.length;
  } else {
    break;
  }
}

fs.writeFileSync(file, code, 'utf8');
console.log("Restored all occurrences of sellerMode blocks.");
