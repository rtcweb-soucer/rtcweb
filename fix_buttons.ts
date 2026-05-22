import * as fs from 'fs';

const file = 'C:/Users/SAMSUNG/Downloads/rtc---toldos-&-cortinas/rtcweb/pages/IAManager.tsx';
let code = fs.readFileSync(file, 'utf8');

// 1. Add missing lucide-react icons
const lucideSearch = /import \{([^}]+)\} from 'lucide-react';/s;
if (lucideSearch.test(code)) {
    code = code.replace(lucideSearch, (match, p1) => {
        let imports = p1;
        if (!imports.includes('MessageSquareDashed')) imports += ', MessageSquareDashed';
        if (!imports.includes('Phone')) imports += ', Phone';
        return `import {${imports}} from 'lucide-react';`;
    });
}

// 2. Add state
const stateSearch = "const [isHtmlModalOpen, setIsHtmlModalOpen] = useState(false);";
if (!code.includes("const [whatsappMessageModal, setWhatsappMessageModal]")) {
    const stateStr = `
  const [whatsappMessageModal, setWhatsappMessageModal] = useState<{
    isOpen: boolean;
    type: 'promo' | 'tranquil';
    phone: string;
    name: string;
    quoteId: string;
    discount: number;
    paymentMethod: string;
    scarcityDate: string;
    message: string;
  } | null>(null);

  const isHtmlModalOpen`;
    code = code.replace(stateSearch, stateStr.trim());
}

// 3. Replace handleSendWhatsAppPromo and handleSendWhatsAppTranquil
const handlersSearchRegex = /const handleSendWhatsAppPromo = async.*?(?=const handleSendReminder = async)/s;
const newHandlers = `
  const handleOpenMessageModal = (type: 'promo' | 'tranquil', phone?: string, name?: string, quoteId?: string) => {
    if (!phone) {
      alert('Cliente sem telefone cadastrado.');
      return;
    }
    
    const discount = type === 'promo' ? 10 : 0;
    const paymentMethod = 'PIX';
    
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const scarcityDate = tomorrow.toISOString().split('T')[0];
    const dateStr = tomorrow.toLocaleDateString('pt-BR');
    
    const msg = type === 'promo' 
      ? \`Olá *\${name || 'Cliente'}*, tudo bem? Vi que seu orçamento está em aberto. Conseguimos uma condição especial de \${discount}% de desconto pagando via \${paymentMethod} para fechar o projeto, mas é válida somente até \${dateStr}! Vamos aproveitar?\`
      : \`Olá *\${name || 'Cliente'}*, tudo bem? Passando apenas para saber se você conseguiu analisar o nosso orçamento e se ficou com alguma dúvida. Lembrando que se fecharmos até \${dateStr} via \${paymentMethod}, posso tentar \${discount}% de desconto. Estou à disposição para ajudar!\`;
      
    setWhatsappMessageModal({
      isOpen: true,
      type,
      phone,
      name: name || 'Cliente',
      quoteId: quoteId || '',
      discount,
      paymentMethod,
      scarcityDate,
      message: msg
    });
  };

  const handleSendCustomWhatsApp = async () => {
    if (!whatsappMessageModal) return;
    try {
      await evolutionService.sendMessageAuto(whatsappMessageModal.phone, whatsappMessageModal.message);
      alert('Mensagem enviada com sucesso!');
      setWhatsappMessageModal(null);
    } catch (err: any) {
      alert(\`Erro ao enviar mensagem: \${err.message}\`);
    }
  };

  `;
code = code.replace(handlersSearchRegex, newHandlers);


// 4. Update the renderOpenQuotesGrid
const renderGridRegex = /const renderOpenQuotesGrid = \(sellerMode: boolean = false\) => \{.*?(?=const renderModals = \(\) => \()/s;
const newRenderGrid = `const renderOpenQuotesGrid = (sellerMode: boolean = false) => {
    const targetSellerFilter = sellerMode ? (currentUser?.sellerId || "") : selectedSellerFilter;
    return (

      <div className="space-y-8 bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm mt-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-6">
          <div>
            <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <Briefcase size={20} className="text-purple-600" /> Detalhamento de Orçamentos em Aberto
            </h3>
            <p className="text-sm font-medium text-slate-500">Monitoramento agressivo de pipeline de vendas.</p>
          </div>
          {!sellerMode && (<div>
            <select 
              value={selectedSellerFilter}
              onChange={(e) => setSelectedSellerFilter(e.target.value)}
              className="px-4 py-3 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-700 focus:ring-2 ring-purple-500"
            >
              <option value="ALL">Todos os Vendedores</option>
              {sellers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          )}
        </div>

        {/* Current Month Grid */}
        <div>
          <h4 className="text-xs font-black text-emerald-500 uppercase tracking-widest mb-4 flex items-center gap-2">
            <TrendingUp size={14} /> Mês Vigente
          </h4>
          <div className="overflow-x-auto max-h-80 overflow-y-auto border border-slate-100 rounded-2xl">
            <table className="w-full text-left">
               <thead>
                  <tr className="bg-slate-50 sticky top-0">
                     <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase">Data</th>
                     <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase">Cliente</th>
                     <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase">Vendedor</th>
                     <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase text-right">Valor</th>
                     <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase text-center">Ação</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-100">
                  {orders
                    .filter(o => o.status === OrderStatus.QUOTE_SENT)
                    .filter(o => targetSellerFilter === 'ALL' || o.sellerId === targetSellerFilter)
                    .filter(o => {
                        const d = new Date(o.createdAt);
                        const now = new Date();
                        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
                    })
                    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                    .map(quote => {
                      const customer = customers.find(c => c.id === quote.customerId);
                      const seller = sellers.find(s => s.id === quote.sellerId);
                      return (
                        <tr key={quote.id} className="hover:bg-slate-50 transition-colors">
                           <td className="px-6 py-4 text-xs font-medium text-slate-500">{new Date(quote.createdAt).toLocaleDateString('pt-BR')}</td>
                           <td className="px-6 py-4 text-sm font-bold text-slate-900">{customer?.name || 'Desconhecido'}</td>
                           <td className="px-6 py-4 text-xs font-medium text-slate-500">{seller?.name || 'Não Informado'}</td>
                           <td className="px-6 py-4 text-sm font-black text-purple-600 text-right">R$ {quote.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                           <td className="px-6 py-4 text-center space-x-2 whitespace-nowrap">
                             <button onClick={() => { setActiveHtmlQuote(quote); setIsHtmlModalOpen(true); }} className="p-2 text-purple-600 hover:text-purple-800 hover:bg-purple-50 rounded-xl transition-all inline-flex" title="Visualizar Contrato">
                               <FileText size={16} />
                             </button>
                             {sellerMode && (
                               <>
                                 <button onClick={() => handleOpenMessageModal('promo', customer?.phone, customer?.name, quote.id)} className="p-2 text-amber-500 hover:text-amber-700 hover:bg-amber-50 rounded-xl transition-all inline-flex" title="Ação Agressiva (Promoção e Escassez)">
                                   <Flame size={16} />
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
                             )}
                           </td>
                        </tr>
                      );
                    })}
               </tbody>
            </table>
          </div>
        </div>

        {/* Retroactive Grid */}
        <div>
          <h4 className="text-xs font-black text-rose-500 uppercase tracking-widest mb-4 flex items-center gap-2">
            <Clock size={14} /> Pendentes Retroativos (Meses Anteriores)
          </h4>
          <div className="overflow-x-auto max-h-80 overflow-y-auto border border-slate-100 rounded-2xl">
            <table className="w-full text-left">
               <thead>
                  <tr className="bg-rose-50/50 sticky top-0">
                     <th className="px-6 py-3 text-[10px] font-black text-rose-400 uppercase">Data</th>
                     <th className="px-6 py-3 text-[10px] font-black text-rose-400 uppercase">Cliente</th>
                     <th className="px-6 py-3 text-[10px] font-black text-rose-400 uppercase">Vendedor</th>
                     <th className="px-6 py-3 text-[10px] font-black text-rose-400 uppercase text-right">Valor</th>
                     <th className="px-6 py-3 text-[10px] font-black text-rose-400 uppercase text-center">Ação</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-100">
                  {orders
                    .filter(o => o.status === OrderStatus.QUOTE_SENT)
                    .filter(o => targetSellerFilter === 'ALL' || o.sellerId === targetSellerFilter)
                    .filter(o => {
                        const d = new Date(o.createdAt);
                        const now = new Date();
                        return !(d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear());
                    })
                    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                    .map(quote => {
                      const customer = customers.find(c => c.id === quote.customerId);
                      const seller = sellers.find(s => s.id === quote.sellerId);
                      return (
                        <tr key={quote.id} className="hover:bg-rose-50/30 transition-colors">
                           <td className="px-6 py-4 text-xs font-medium text-slate-500">{new Date(quote.createdAt).toLocaleDateString('pt-BR')}</td>
                           <td className="px-6 py-4 text-sm font-bold text-slate-900">{customer?.name || 'Desconhecido'}</td>
                           <td className="px-6 py-4 text-xs font-medium text-slate-500">{seller?.name || 'Não Informado'}</td>
                           <td className="px-6 py-4 text-sm font-black text-rose-600 text-right">R$ {quote.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                           <td className="px-6 py-4 text-center space-x-2 whitespace-nowrap">
                             <button onClick={() => { setActiveHtmlQuote(quote); setIsHtmlModalOpen(true); }} className="p-2 text-purple-600 hover:text-purple-800 hover:bg-purple-50 rounded-xl transition-all inline-flex" title="Visualizar Contrato">
                               <FileText size={16} />
                             </button>
                             {sellerMode && (
                               <>
                                 <button onClick={() => handleOpenMessageModal('tranquil', customer?.phone, customer?.name, quote.id)} className="p-2 text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl transition-all inline-flex" title="Ação Tranquila (Acompanhamento)">
                                   <MessageCircle size={16} />
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
                             )}
                           </td>
                        </tr>
                      );
                    })}
               </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  `;
code = code.replace(renderGridRegex, newRenderGrid);


// 5. Add whatsappMessageModal to renderModals()
const renderModalsRegex = /const renderModals = \(\) => \(\n    <>\n/s;
const newRenderModals = `const renderModals = () => (
    <>
      {/* WhatsApp Message Modal */}
      {whatsappMessageModal && whatsappMessageModal.isOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-[40px] w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in duration-300">
            <div className={\`p-6 border-b border-slate-100 flex items-center justify-between \${whatsappMessageModal.type === 'promo' ? 'bg-amber-50' : 'bg-emerald-50'}\`}>
              <div className="flex items-center gap-3">
                <div className={\`p-3 rounded-2xl text-white \${whatsappMessageModal.type === 'promo' ? 'bg-amber-500' : 'bg-emerald-500'}\`}>
                  {whatsappMessageModal.type === 'promo' ? <Flame size={24} /> : <MessageCircle size={24} />}
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900">
                    {whatsappMessageModal.type === 'promo' ? 'Ação Agressiva (Promoção)' : 'Ação Tranquila (Acompanhamento)'}
                  </h3>
                  <p className="text-sm font-medium text-slate-500">Supervisão e edição de mensagem para {whatsappMessageModal.name}</p>
                </div>
              </div>
              <button onClick={() => setWhatsappMessageModal(null)} className="w-10 h-10 rounded-2xl bg-white/50 flex items-center justify-center"><X size={20} /></button>
            </div>
            <div className="p-6 overflow-y-auto space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                   <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Desconto (%)</label>
                   <input 
                      type="number" 
                      value={whatsappMessageModal.discount}
                      onChange={(e) => {
                         const v = Number(e.target.value);
                         setWhatsappMessageModal({...whatsappMessageModal, discount: v});
                      }}
                      className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-700 focus:ring-2 ring-purple-500"
                   />
                </div>
                <div>
                   <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Data Limite (Escassez)</label>
                   <input 
                      type="date" 
                      value={whatsappMessageModal.scarcityDate}
                      onChange={(e) => {
                         const v = e.target.value;
                         setWhatsappMessageModal({...whatsappMessageModal, scarcityDate: v});
                      }}
                      className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-700 focus:ring-2 ring-purple-500"
                   />
                </div>
                <div className="col-span-2">
                   <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Forma de Pagamento</label>
                   <input 
                      type="text" 
                      value={whatsappMessageModal.paymentMethod}
                      onChange={(e) => {
                         const v = e.target.value;
                         setWhatsappMessageModal({...whatsappMessageModal, paymentMethod: v});
                      }}
                      className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-700 focus:ring-2 ring-purple-500"
                   />
                </div>
              </div>
              <div>
                <div className="flex justify-between items-center mb-2">
                   <label className="block text-xs font-black text-slate-400 uppercase tracking-widest">Texto da Mensagem (Sugerido pela IA)</label>
                   <button 
                     onClick={() => {
                        const dateObj = new Date(whatsappMessageModal.scarcityDate);
                        dateObj.setDate(dateObj.getDate() + 1); // fix offset timezone
                        const dateStr = dateObj.toLocaleDateString('pt-BR');
                        const newMsg = whatsappMessageModal.type === 'promo'
                          ? \`Olá *\${whatsappMessageModal.name}*, tudo bem? Vi que seu orçamento está em aberto. Conseguimos uma condição especial de \${whatsappMessageModal.discount}% de desconto pagando via \${whatsappMessageModal.paymentMethod} para fechar o projeto, mas é válida somente até \${dateStr}! Vamos aproveitar?\`
                          : \`Olá *\${whatsappMessageModal.name}*, tudo bem? Passando apenas para saber se você conseguiu analisar o nosso orçamento e se ficou com alguma dúvida. Lembrando que se fecharmos até \${dateStr} via \${whatsappMessageModal.paymentMethod}, posso tentar \${whatsappMessageModal.discount}% de desconto. Estou à disposição para ajudar!\`;
                        setWhatsappMessageModal({...whatsappMessageModal, message: newMsg});
                     }}
                     className="text-[10px] font-bold text-purple-600 bg-purple-50 px-2 py-1 rounded hover:bg-purple-100"
                   >
                     Atualizar Texto
                   </button>
                </div>
                <textarea 
                   rows={5}
                   value={whatsappMessageModal.message}
                   onChange={(e) => setWhatsappMessageModal({...whatsappMessageModal, message: e.target.value})}
                   className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-medium text-slate-700 focus:ring-2 ring-purple-500 resize-none"
                />
              </div>
            </div>
            <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
              <button 
                 onClick={() => setWhatsappMessageModal(null)}
                 className="flex-1 py-4 bg-white text-slate-600 rounded-2xl font-black text-sm hover:bg-slate-100 transition-all border border-slate-200"
              >
                 Cancelar
              </button>
              <button 
                 onClick={handleSendCustomWhatsApp}
                 className={\`flex-1 py-4 text-white rounded-2xl font-black text-sm transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 \${whatsappMessageModal.type === 'promo' ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/20' : 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20'}\`}
              >
                 <Send size={18} /> Enviar Mensagem
              </button>
            </div>
          </div>
        </div>
      )}
`;
code = code.replace(renderModalsRegex, newRenderModals);

fs.writeFileSync(file, code, 'utf8');
console.log("Done");
