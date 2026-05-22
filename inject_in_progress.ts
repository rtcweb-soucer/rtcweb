import * as fs from 'fs';

const file = 'C:/Users/SAMSUNG/Downloads/rtc---toldos-&-cortinas/rtcweb/pages/IAManager.tsx';
let code = fs.readFileSync(file, 'utf8');

// 1. Update the logic to push in_progress state
const oldLogicStr = `                  if (lastMsg.direction === 'outbound') {
                     // Vendedor já respondeu. Só alerta se passou 2 horas e não fechou.
                     // (Para fins de teste e ver na hora, vou considerar 2 horas reais)
                     if (hoursSinceInbound >= 2 && isPendingClose) {
                        interested.push({
                           id: cust.id,
                           name: cust.name,
                           phone: phone,
                           message: lastInbound.message,
                           escalated: true,
                           time: new Date(lastInbound.created_at).toLocaleTimeString()
                        });
                     }
                  } else {
                     // Vendedor AINDA NÃO RESPONDEU. Alerta normal.
                     interested.push({
                        id: cust.id,
                        name: cust.name,
                        phone: phone,
                        message: lastInbound.message,
                        escalated: false,
                        time: new Date(lastInbound.created_at).toLocaleTimeString()
                     });
                  }`;

const newLogicStr = `                  if (lastMsg.direction === 'outbound') {
                     if (hoursSinceInbound >= 2 && isPendingClose) {
                        interested.push({
                           id: cust.id,
                           name: cust.name,
                           phone: phone,
                           message: lastInbound.message,
                           escalated: true,
                           in_progress: false,
                           time: new Date(lastInbound.created_at).toLocaleTimeString()
                        });
                     } else if (isPendingClose) {
                        interested.push({
                           id: cust.id,
                           name: cust.name,
                           phone: phone,
                           message: lastInbound.message,
                           escalated: false,
                           in_progress: true,
                           time: new Date(lastInbound.created_at).toLocaleTimeString()
                        });
                     }
                  } else {
                     interested.push({
                        id: cust.id,
                        name: cust.name,
                        phone: phone,
                        message: lastInbound.message,
                        escalated: false,
                        in_progress: false,
                        time: new Date(lastInbound.created_at).toLocaleTimeString()
                     });
                  }`;

if (code.includes('if (hoursSinceInbound >= 2 && isPendingClose) {')) {
    code = code.replace(oldLogicStr, newLogicStr);
}

// 2. Update the UI string mapping to handle in_progress
const oldUIStr = `{aiInteraction && (
                           <tr className={\`\${aiInteraction.escalated ? 'bg-rose-50/80 border-rose-200' : 'bg-purple-50/60 border-purple-100'} border-b animate-pulse\`}>
                             <td colSpan={5} className="px-6 py-3">
                               <div className="flex items-start gap-2">
                                 <Zap size={14} className={aiInteraction.escalated ? "text-rose-600 mt-0.5 shrink-0 animate-pulse" : "text-purple-600 mt-0.5 shrink-0 animate-pulse"} />
                                 <div>
                                   <p className={\`text-[9px] font-black uppercase tracking-widest mb-0.5 \${aiInteraction.escalated ? 'text-rose-800' : 'text-purple-800'}\`}>
                                     {aiInteraction.escalated ? '⚠️ ATENÇÃO DIRETOR: Venda Parada há 2+ Horas' : 'Nova Mensagem do Cliente'}
                                   </p>
                                   <p className="text-[11px] text-slate-800 font-medium italic mb-0.5 leading-tight">"{aiInteraction.message}"</p>
                                   <p className={\`text-[10px] leading-tight \${aiInteraction.escalated ? 'text-rose-700 font-bold' : 'text-purple-700'}\`}>
                                     {aiInteraction.escalated ? 'O vendedor interagiu, mas a venda não foi convertida após o interesse do cliente.' : generateAIAnalysis([{ direction: 'inbound', message: aiInteraction.message }])}
                                   </p>
                                 </div>
                               </div>
                             </td>
                           </tr>
                        )}`;

const newUIStr = `{aiInteraction && (
                           <tr className={\`\${aiInteraction.escalated ? 'bg-rose-50/80 border-rose-200 animate-pulse' : aiInteraction.in_progress ? 'bg-amber-50/20 border-amber-100' : 'bg-purple-50/60 border-purple-100 animate-pulse'} border-b\`}>
                             <td colSpan={5} className="px-6 py-2">
                               {aiInteraction.in_progress ? (
                                  <div className="flex items-center justify-end gap-2 opacity-80">
                                     <Timer size={12} className="text-amber-500 animate-pulse shrink-0" />
                                     <span className="text-[9px] font-black text-amber-700 uppercase tracking-widest">Em Fechamento (Atendido)</span>
                                  </div>
                               ) : (
                                  <div className="flex items-start gap-2">
                                    <Zap size={14} className={aiInteraction.escalated ? "text-rose-600 mt-0.5 shrink-0 animate-pulse" : "text-purple-600 mt-0.5 shrink-0 animate-pulse"} />
                                    <div>
                                      <p className={\`text-[9px] font-black uppercase tracking-widest mb-0.5 \${aiInteraction.escalated ? 'text-rose-800' : 'text-purple-800'}\`}>
                                        {aiInteraction.escalated ? '⚠️ ATENÇÃO DIRETOR: Venda Parada há 2+ Horas' : 'Nova Mensagem do Cliente'}
                                      </p>
                                      <p className="text-[11px] text-slate-800 font-medium italic mb-0.5 leading-tight">"{aiInteraction.message}"</p>
                                      <p className={\`text-[10px] leading-tight \${aiInteraction.escalated ? 'text-rose-700 font-bold' : 'text-purple-700'}\`}>
                                        {aiInteraction.escalated ? 'O vendedor interagiu, mas a venda não foi convertida após o interesse do cliente.' : generateAIAnalysis([{ direction: 'inbound', message: aiInteraction.message }])}
                                      </p>
                                    </div>
                                  </div>
                               )}
                             </td>
                           </tr>
                        )}`;

code = code.split(oldUIStr).join(newUIStr);

fs.writeFileSync(file, code, 'utf8');
console.log("In_progress logic injected!");
