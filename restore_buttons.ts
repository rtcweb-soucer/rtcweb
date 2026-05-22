import * as fs from 'fs';

const file = 'C:/Users/SAMSUNG/Downloads/rtc---toldos-&-cortinas/rtcweb/pages/IAManager.tsx';
let code = fs.readFileSync(file, 'utf8');

// The block to replace
const startMarker = '{sellerMode && (';
const endMarker = '</>\n                             )}';
const startIdx = code.indexOf(startMarker);
const endIdx = code.indexOf(endMarker, startIdx) + endMarker.length;

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

if (startIdx !== -1 && endIdx !== -1) {
    const pre = code.substring(0, startIdx);
    const post = code.substring(endIdx);
    fs.writeFileSync(file, pre + newBlock + post, 'utf8');
    console.log("Restored Aggressive Button and added History button correctly.");
} else {
    console.log("Could not find the block to replace.");
}
