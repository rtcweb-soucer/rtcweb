import * as fs from 'fs';

const file = 'C:/Users/SAMSUNG/Downloads/rtc---toldos-&-cortinas/rtcweb/pages/IAManager.tsx';
let code = fs.readFileSync(file, 'utf8');

// 1. Add Bell icon to imports
if (!code.includes('BellRing')) {
  code = code.replace(/} from 'lucide-react';/g, ', BellRing, History } from \'lucide-react\';');
}

// 2. Add States
if (!code.includes('const [customerPrefs')) {
  const newStates = `
  const [customerPrefs, setCustomerPrefs] = useState<Record<string, any>>({});
  const [interestedCustomers, setInterestedCustomers] = useState<any[]>([]);
  const [showNotificationsMenu, setShowNotificationsMenu] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [historyMessages, setHistoryMessages] = useState<any[]>([]);
  const [activeHistoryQuote, setActiveHistoryQuote] = useState<Order | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  
  // Polling para ler mensagens do banco
  useEffect(() => {
    const fetchHistoryAndPrefs = async () => {
      try {
        // Busca preferências
        const { data: prefsData } = await supabase.from('customer_whatsapp_preferences').select('*');
        if (prefsData) {
          const prefsMap: Record<string, any> = {};
          prefsData.forEach(p => prefsMap[p.customer_phone] = p);
          setCustomerPrefs(prefsMap);
        }

        // Verifica mensagens recentes inbound (últimas 24h)
        const yesterday = new Date();
        yesterday.setHours(yesterday.getHours() - 24);
        
        const { data: recentMsgs } = await supabase
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
          }
          setInterestedCustomers(interested);
        }
      } catch (err) {
         console.error('Polling error', err);
      }
    };
    
    fetchHistoryAndPrefs();
    const interval = setInterval(fetchHistoryAndPrefs, 30000); // 30s
    return () => clearInterval(interval);
  }, [customers]);

  const handleOpenHistory = async (quote: Order, customerPhone?: string) => {
    if (!customerPhone) return alert('Cliente sem telefone');
    setActiveHistoryQuote(quote);
    setIsHistoryModalOpen(true);
    setIsLoadingHistory(true);
    try {
       const cleanNumber = customerPhone.replace(/\\D/g, '');
       const { data } = await supabase
         .from('whatsapp_messages')
         .select('*')
         .like('phone', \`%\${cleanNumber}%\`)
         .order('created_at', { ascending: true });
         
       if (data) {
         setHistoryMessages(data);
       } else {
         setHistoryMessages([]);
       }
    } catch (err) {
       console.error(err);
    } finally {
       setIsLoadingHistory(false);
    }
  };
  `;
  
  code = code.replace("const [qrCodeData, setQrCodeData] = useState<{ base64?: string, code?: string, message?: string } | null>(null);", "const [qrCodeData, setQrCodeData] = useState<{ base64?: string, code?: string, message?: string } | null>(null);\n" + newStates);
}

// 3. Add History Modal to the end of the file
if (!code.includes('isHistoryModalOpen')) {
  console.log("WAIT, states replace failed or we need to add the modal JSX");
} else {
  if (!code.includes('Histórico de Conversas (WhatsApp)')) {
    const modalJSX = `
      {isHistoryModalOpen && activeHistoryQuote && (
        <div className="fixed inset-0 z-[60] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col h-[80vh]">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <History size={18} className="text-purple-600" />
                  Histórico de Conversas (WhatsApp)
                </h3>
                <p className="text-xs text-slate-500 mt-1">Orçamento #{activeHistoryQuote.number}</p>
              </div>
              <button 
                onClick={() => setIsHistoryModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 bg-[#e5ddd5] flex flex-col gap-3">
              {isLoadingHistory ? (
                <div className="flex justify-center items-center h-full">
                  <Timer size={24} className="animate-spin text-purple-600" />
                </div>
              ) : historyMessages.length === 0 ? (
                <div className="flex justify-center items-center h-full text-slate-500 bg-white/50 py-2 px-4 rounded-xl self-center text-sm shadow-sm">
                  Nenhuma conversa encontrada no banco de dados para este telefone.
                </div>
              ) : (
                historyMessages.map((msg, idx) => (
                  <div key={idx} className={\`flex \${msg.direction === 'inbound' ? 'justify-start' : 'justify-end'}\`}>
                    <div className={\`max-w-[80%] rounded-2xl px-4 py-2 shadow-sm relative \${msg.direction === 'inbound' ? 'bg-white text-slate-800 rounded-tl-none' : 'bg-[#dcf8c6] text-slate-800 rounded-tr-none'}\`}>
                      <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                      <span className="text-[10px] text-slate-500 float-right mt-1 ml-3">
                        {new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    `;
    code = code.replace(/<\/div>\s*<\/div>\s*\)\s*;\s*}\s*export default/g, modalJSX + '\n    </div>\n  </div>\n  );\n}\nexport default');
  }
}

// 4. Render the Notification Bell in the header
if (!code.includes('showNotificationsMenu')) {
  const bellJSX = `
          <div className="flex items-center gap-4">
             <div className="relative">
                <button 
                  onClick={() => setShowNotificationsMenu(!showNotificationsMenu)}
                  className="p-3 bg-white border border-slate-200 rounded-xl hover:border-purple-500 hover:shadow-sm transition-all relative"
                >
                  <BellRing size={20} className={interestedCustomers.length > 0 ? "text-purple-600 animate-pulse" : "text-slate-400"} />
                  {interestedCustomers.length > 0 && (
                    <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-white">
                      {interestedCustomers.length}
                    </span>
                  )}
                </button>
                
                {showNotificationsMenu && (
                  <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden z-50">
                    <div className="p-3 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                      <h4 className="font-bold text-slate-800 text-sm">Respostas Recentes</h4>
                      <span className="bg-purple-100 text-purple-700 text-[10px] font-bold px-2 py-0.5 rounded-full">{interestedCustomers.length} novas</span>
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {interestedCustomers.length === 0 ? (
                        <div className="p-4 text-center text-sm text-slate-500">
                          Nenhuma nova resposta no momento.
                        </div>
                      ) : (
                        interestedCustomers.map((c, i) => (
                          <div key={i} className="p-3 border-b border-slate-50 hover:bg-slate-50 transition-colors cursor-pointer">
                            <p className="font-bold text-slate-800 text-sm">{c.name}</p>
                            <p className="text-xs text-slate-500 mt-1 line-clamp-2">"{c.message}"</p>
                            <p className="text-[10px] text-slate-400 mt-2 text-right">{c.time}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
             </div>
  `;
  // Inject before activeTab == 'settings' button or at the right side of the header
  code = code.replace(/<div className="flex gap-2 bg-white p-1.5 rounded-xl shadow-sm border border-slate-100">/g, bellJSX + '\n          <div className="flex gap-2 bg-white p-1.5 rounded-xl shadow-sm border border-slate-100">');
}

// 5. Add History Button to Table Actions and Apply Opt-Out Disabled logic
// We'll replace the existing action buttons and add logic
const findButtons = `title="Ação Agressiva (Promoção e Escassez)"`;
if (code.includes(findButtons)) {
  const replaceAggressive = `<button onClick={() => handleOpenMessageModal('promo', customer?.phone, customer?.name, quote.id, quote.totalValue)} disabled={customerPrefs[customer?.phone?.replace(/\\D/g, '')]?.opt_out || customerPrefs['55'+customer?.phone?.replace(/\\D/g, '')]?.opt_out} className={\`p-2 rounded-xl transition-all inline-flex \${(customerPrefs[customer?.phone?.replace(/\\D/g, '')]?.opt_out || customerPrefs['55'+customer?.phone?.replace(/\\D/g, '')]?.opt_out) ? 'text-slate-300 cursor-not-allowed bg-slate-50' : 'text-amber-500 hover:text-amber-700 hover:bg-amber-50'}\`} title={(customerPrefs[customer?.phone?.replace(/\\D/g, '')]?.opt_out || customerPrefs['55'+customer?.phone?.replace(/\\D/g, '')]?.opt_out) ? 'Bloqueado: Cliente pediu para não receber mensagens' : 'Ação Agressiva (Promoção e Escassez)'}>`;
  code = code.replace(/<button onClick=\{\(\) => handleOpenMessageModal\('promo'.*?title="Ação Agressiva \(Promoção e Escassez\)">/g, replaceAggressive);
  
  const replaceTranquil = `<button onClick={() => handleOpenMessageModal('tranquil', customer?.phone, customer?.name, quote.id, quote.totalValue)} disabled={customerPrefs[customer?.phone?.replace(/\\D/g, '')]?.opt_out || customerPrefs['55'+customer?.phone?.replace(/\\D/g, '')]?.opt_out} className={\`p-2 rounded-xl transition-all inline-flex \${(customerPrefs[customer?.phone?.replace(/\\D/g, '')]?.opt_out || customerPrefs['55'+customer?.phone?.replace(/\\D/g, '')]?.opt_out) ? 'text-slate-300 cursor-not-allowed bg-slate-50' : 'text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50'}\`} title={(customerPrefs[customer?.phone?.replace(/\\D/g, '')]?.opt_out || customerPrefs['55'+customer?.phone?.replace(/\\D/g, '')]?.opt_out) ? 'Bloqueado: Cliente pediu para não receber mensagens' : 'Ação Tranquila (Acompanhamento)'}>`;
  code = code.replace(/<button onClick=\{\(\) => handleOpenMessageModal\('tranquil'.*?title="Ação Tranquila \(Acompanhamento\)">/g, replaceTranquil);
  
  // Add History button next to Tranquil
  const replaceTranquilEnd = `title={(customerPrefs[customer?.phone?.replace(/\\D/g, '')]?.opt_out || customerPrefs['55'+customer?.phone?.replace(/\\D/g, '')]?.opt_out) ? 'Bloqueado: Cliente pediu para não receber mensagens' : 'Ação Tranquila (Acompanhamento)'}>\n                    <MessageCircle size={16} />\n                  </button>`;
  
  if (!code.includes('Histórico de Conversas">')) {
     const historyBtn = `\n                  <button onClick={() => handleOpenHistory(quote, customer?.phone)} className="p-2 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-xl transition-all inline-flex" title="Histórico de Conversas">\n                    <History size={16} />\n                  </button>`;
     code = code.replace(new RegExp(replaceTranquilEnd.replace(/[.*+?^$\\{\\}()|[\\]\\\\]/g, '\\$&'), 'g'), replaceTranquilEnd + historyBtn);
  }
}

fs.writeFileSync(file, code, 'utf8');
console.log("Done");
