import * as fs from 'fs';

const file = 'C:/Users/SAMSUNG/Downloads/rtc---toldos-&-cortinas/rtcweb/pages/IAManager.tsx';
let code = fs.readFileSync(file, 'utf8');

const oldLogic = `        const { data: recentMsgs } = await supabase
          .from('whatsapp_messages')
          .select('*')
          .eq('direction', 'inbound')
          .gte('created_at', yesterday.toISOString())
          .order('created_at', { ascending: false });

        if (recentMsgs && recentMsgs.length > 0) {
          const interested: any[] = [];
          
          for (const msg of recentMsgs) {
            const text = (msg.message || '').toLowerCase();
            const phone = msg.phone;
            
            // Check opt out
            if (text.includes('não mande') || text.includes('parar') || text.includes('sair') || text.includes('não quero')) {
               if (!customerPrefs[phone] || !customerPrefs[phone].opt_out) {
                 await supabase.from('customer_whatsapp_preferences').upsert({
                   customer_phone: phone,
                   opt_out: true,
                   last_intent: 'opt_out'
                 }, { onConflict: 'customer_phone' });
               }
               continue;
            }

            // Check interest
            if (text.includes('quero') || text.includes('sim') || text.includes('interesse') || text.includes('como') || text.includes('pagar')) {
               // Acha o cliente na lista do CRM
               const cust = customers.find(c => {
                  const p1 = (c.phone || '').replace(/\\D/g, '');
                  const p2 = (c.phone2 || '').replace(/\\D/g, '');
                  return phone.includes(p1) || phone.includes(p2);
               });
               
               if (cust && !interested.find(i => i.phone === phone)) {
                  interested.push({
                    name: cust.name,
                    phone: phone,
                    message: msg.message,
                    time: new Date(msg.created_at).toLocaleTimeString()
                  });
               }
            }
          }`;

const newLogic = `        const { data: recentMsgs } = await supabase
          .from('whatsapp_messages')
          .select('*')
          .gte('created_at', yesterday.toISOString())
          .order('created_at', { ascending: false });

        if (recentMsgs && recentMsgs.length > 0) {
          const interested: any[] = [];
          
          const byPhone: Record<string, any[]> = {};
          recentMsgs.forEach(m => {
             if (!byPhone[m.phone]) byPhone[m.phone] = [];
             byPhone[m.phone].push(m);
          });
          
          for (const phone in byPhone) {
            const msgs = byPhone[phone];
            const lastMsg = msgs[0];
            const lastInbound = msgs.find(m => m.direction === 'inbound');
            
            if (!lastInbound) continue;
            
            const text = (lastInbound.message || '').toLowerCase();
            
            // Check opt out
            if (text.includes('não mande') || text.includes('parar') || text.includes('sair') || text.includes('não quero')) {
               if (!customerPrefs[phone] || !customerPrefs[phone].opt_out) {
                 await supabase.from('customer_whatsapp_preferences').upsert({
                   customer_phone: phone,
                   opt_out: true,
                   last_intent: 'opt_out'
                 }, { onConflict: 'customer_phone' });
               }
               continue;
            }

            // Check interest
            if (text.includes('quero') || text.includes('sim') || text.includes('interesse') || text.includes('como') || text.includes('pagar')) {
               const cust = customers.find(c => {
                  const p1 = (c.phone || '').replace(/\\D/g, '');
                  const p2 = (c.phone2 || '').replace(/\\D/g, '');
                  return phone.includes(p1) || phone.includes(p2);
               });
               
               if (cust && !interested.find(i => i.phone === phone)) {
                  const hoursSinceInbound = (new Date().getTime() - new Date(lastInbound.created_at).getTime()) / (1000 * 60 * 60);
                  const isPendingClose = orders.some(o => o.customerId === cust.id && o.status === OrderStatus.QUOTE_SENT);
                  
                  if (lastMsg.direction === 'outbound') {
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
                  }
               }
            }
          }`;

if (code.includes('eq(\'direction\', \'inbound\')')) {
    code = code.replace(oldLogic, newLogic);
}

// Now update the UI to handle the escalated state
const oldUI = `                                 <Zap size={14} className="text-purple-600 mt-0.5 shrink-0 animate-pulse" />
                                 <div>
                                   <p className="text-[9px] font-black text-purple-800 uppercase tracking-widest mb-0.5">Nova Mensagem do Cliente</p>
                                   <p className="text-[11px] text-slate-800 font-medium italic mb-0.5 leading-tight">"{aiInteraction.message}"</p>
                                   <p className="text-[10px] text-purple-700 leading-tight">{generateAIAnalysis([{ direction: 'inbound', message: aiInteraction.message }])}</p>
                                 </div>`;

const newUI = `                                 <Zap size={14} className={aiInteraction.escalated ? "text-rose-600 mt-0.5 shrink-0 animate-pulse" : "text-purple-600 mt-0.5 shrink-0 animate-pulse"} />
                                 <div>
                                   <p className={\`text-[9px] font-black uppercase tracking-widest mb-0.5 \${aiInteraction.escalated ? 'text-rose-800' : 'text-purple-800'}\`}>
                                     {aiInteraction.escalated ? '⚠️ ATENÇÃO DIRETOR: Venda Parada há 2+ Horas' : 'Nova Mensagem do Cliente'}
                                   </p>
                                   <p className="text-[11px] text-slate-800 font-medium italic mb-0.5 leading-tight">"{aiInteraction.message}"</p>
                                   <p className={\`text-[10px] leading-tight \${aiInteraction.escalated ? 'text-rose-700 font-bold' : 'text-purple-700'}\`}>
                                     {aiInteraction.escalated ? 'O vendedor interagiu, mas a venda não foi convertida após o interesse do cliente.' : generateAIAnalysis([{ direction: 'inbound', message: aiInteraction.message }])}
                                   </p>
                                 </div>`;

const oldRowClass = `bg-purple-50/60 border-b border-purple-100 animate-pulse`;
const newRowClass = `\${aiInteraction.escalated ? 'bg-rose-50/80 border-rose-200' : 'bg-purple-50/60 border-purple-100'} border-b animate-pulse`;

code = code.split(oldUI).join(newUI);
code = code.split('className="bg-purple-50/60 border-b border-purple-100 animate-pulse"').join(`className={\`\${aiInteraction.escalated ? 'bg-rose-50/80 border-rose-200' : 'bg-purple-50/60 border-purple-100'} border-b animate-pulse\`}`);

fs.writeFileSync(file, code, 'utf8');
console.log("Business logic injected!");
