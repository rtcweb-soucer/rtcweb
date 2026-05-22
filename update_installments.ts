import * as fs from 'fs';

const file = 'C:/Users/SAMSUNG/Downloads/rtc---toldos-&-cortinas/rtcweb/pages/IAManager.tsx';
let code = fs.readFileSync(file, 'utf8');

// 1. Add quoteValue and installments to state
const stateSearch = /const \[whatsappMessageModal, setWhatsappMessageModal\] = useState<\s*\{\s*isOpen: boolean;\s*type: 'promo' \| 'tranquil';\s*phone: string;\s*name: string;\s*quoteId: string;\s*discount: number;\s*paymentMethod: string;\s*scarcityDate: string;\s*message: string;\s*\}\s*\| null>\(null\);/s;

const newStateStr = `const [whatsappMessageModal, setWhatsappMessageModal] = useState<{
    isOpen: boolean;
    type: 'promo' | 'tranquil';
    phone: string;
    name: string;
    quoteId: string;
    quoteValue: number;
    discount: number;
    paymentMethod: string;
    installments: number;
    scarcityDate: string;
    message: string;
  } | null>(null);`;
code = code.replace(stateSearch, newStateStr);

// 2. Replace handleOpenMessageModal
const handlerSearch = /const handleOpenMessageModal =.*?setWhatsappMessageModal\(\{.*?\}\);\n  \};\n/s;
const newHandler = `const handleOpenMessageModal = (type: 'promo' | 'tranquil', phone?: string, name?: string, quoteId?: string, quoteValue?: number) => {
    if (!phone) {
      alert('Cliente sem telefone cadastrado.');
      return;
    }
    
    const discount = type === 'promo' ? 10 : 0;
    const paymentMethod = 'Cartão de Crédito';
    const installments = 4;
    
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const scarcityDate = tomorrow.toISOString().split('T')[0];
    const dateStr = tomorrow.toLocaleDateString('pt-BR');
    
    const value = quoteValue || 0;
    const discountedValue = value - (value * (discount / 100));
    const installmentValue = installments > 0 ? (discountedValue / installments) : discountedValue;
    
    const msg = type === 'promo' 
      ? \`Olá *\${name || 'Cliente'}*, tudo bem? Vi que seu orçamento está em aberto. Fechando até \${dateStr} consigo fazer por R$ \${discountedValue.toLocaleString('pt-BR', {minimumFractionDigits: 2})} em \${installments}x de R$ \${installmentValue.toLocaleString('pt-BR', {minimumFractionDigits: 2})} no \${paymentMethod}! Vamos aproveitar?\`
      : \`Olá *\${name || 'Cliente'}*, tudo bem? Passando apenas para saber se você conseguiu analisar o nosso orçamento e se ficou com alguma dúvida. Lembrando que fechando até \${dateStr} consigo fazer por R$ \${discountedValue.toLocaleString('pt-BR', {minimumFractionDigits: 2})} em \${installments}x de R$ \${installmentValue.toLocaleString('pt-BR', {minimumFractionDigits: 2})} no \${paymentMethod}. Estou à disposição para ajudar!\`;
      
    setWhatsappMessageModal({
      isOpen: true,
      type,
      phone,
      name: name || 'Cliente',
      quoteId: quoteId || '',
      quoteValue: value,
      discount,
      paymentMethod,
      installments,
      scarcityDate,
      message: msg
    });
  };
`;
code = code.replace(handlerSearch, newHandler);


// 3. Update the inputs in the modal to include installments
const inputSearch = /<div className="col-span-2">\s*<label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Forma de Pagamento<\/label>\s*<input\s*type="text"\s*value=\{whatsappMessageModal.paymentMethod\}\s*onChange=\{\(e\) => \{\s*const v = e.target.value;\s*setWhatsappMessageModal\(\{\.\.\.whatsappMessageModal, paymentMethod: v\}\);\s*\}\}\s*className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-700 focus:ring-2 ring-purple-500"\s*\/>\s*<\/div>/s;
const newInputStr = `<div>
                   <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Parcelas (Qtd)</label>
                   <input 
                      type="number" 
                      value={whatsappMessageModal.installments}
                      onChange={(e) => {
                         const v = Number(e.target.value);
                         setWhatsappMessageModal({...whatsappMessageModal, installments: v});
                      }}
                      className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-700 focus:ring-2 ring-purple-500"
                   />
                </div>
                <div>
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
                </div>`;
code = code.replace(inputSearch, newInputStr);

// 4. Update the 'Atualizar Texto' button logic
const buttonSearch = /<button\s*onClick=\{\(\) => \{\s*const dateObj = new Date\(whatsappMessageModal.scarcityDate\);\s*dateObj.setDate\(dateObj.getDate\(\) \+ 1\);\s*\/\/\s*fix\s*offset\s*timezone\s*const dateStr = dateObj.toLocaleDateString\('pt-BR'\);\s*const newMsg = whatsappMessageModal.type === 'promo'.*?setWhatsappMessageModal\(\{\.\.\.whatsappMessageModal, message: newMsg\}\);\s*\}\}\s*className="text-\[10px\] font-bold text-purple-600 bg-purple-50 px-2 py-1 rounded hover:bg-purple-100"\s*>\s*Atualizar Texto\s*<\/button>/s;
const newButtonStr = `<button 
                     onClick={() => {
                        const dateObj = new Date(whatsappMessageModal.scarcityDate);
                        dateObj.setDate(dateObj.getDate() + 1); // fix offset timezone
                        const dateStr = dateObj.toLocaleDateString('pt-BR');
                        const value = whatsappMessageModal.quoteValue;
                        const discountedValue = value - (value * (whatsappMessageModal.discount / 100));
                        const installmentValue = whatsappMessageModal.installments > 0 ? (discountedValue / whatsappMessageModal.installments) : discountedValue;
                        
                        const newMsg = whatsappMessageModal.type === 'promo'
                          ? \`Olá *\${whatsappMessageModal.name}*, tudo bem? Vi que seu orçamento está em aberto. Fechando até \${dateStr} consigo fazer por R$ \${discountedValue.toLocaleString('pt-BR', {minimumFractionDigits: 2})} em \${whatsappMessageModal.installments}x de R$ \${installmentValue.toLocaleString('pt-BR', {minimumFractionDigits: 2})} no \${whatsappMessageModal.paymentMethod}! Vamos aproveitar?\`
                          : \`Olá *\${whatsappMessageModal.name}*, tudo bem? Passando apenas para saber se você conseguiu analisar o nosso orçamento e se ficou com alguma dúvida. Lembrando que fechando até \${dateStr} consigo fazer por R$ \${discountedValue.toLocaleString('pt-BR', {minimumFractionDigits: 2})} em \${whatsappMessageModal.installments}x de R$ \${installmentValue.toLocaleString('pt-BR', {minimumFractionDigits: 2})} no \${whatsappMessageModal.paymentMethod}. Estou à disposição para ajudar!\`;
                        setWhatsappMessageModal({...whatsappMessageModal, message: newMsg});
                     }}
                     className="text-[10px] font-bold text-purple-600 bg-purple-50 px-2 py-1 rounded hover:bg-purple-100"
                   >
                     Atualizar Texto
                   </button>`;
code = code.replace(buttonSearch, newButtonStr);


// 5. Update the calls in the grids to pass quote.totalValue
// For 'promo'
const promoCallSearch = /<button onClick=\{\(\) => handleOpenMessageModal\('promo', customer\?\.phone, customer\?\.name, quote\.id\)\} className="p-2 text-amber-500 hover:text-amber-700 hover:bg-amber-50 rounded-xl transition-all inline-flex" title="Ação Agressiva \(Promoção e Escassez\)">/g;
code = code.replace(promoCallSearch, `<button onClick={() => handleOpenMessageModal('promo', customer?.phone, customer?.name, quote.id, quote.totalValue)} className="p-2 text-amber-500 hover:text-amber-700 hover:bg-amber-50 rounded-xl transition-all inline-flex" title="Ação Agressiva (Promoção e Escassez)">`);

// For 'tranquil'
const tranquilCallSearch = /<button onClick=\{\(\) => handleOpenMessageModal\('tranquil', customer\?\.phone, customer\?\.name, quote\.id\)\} className="p-2 text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl transition-all inline-flex" title="Ação Tranquila \(Acompanhamento\)">/g;
code = code.replace(tranquilCallSearch, `<button onClick={() => handleOpenMessageModal('tranquil', customer?.phone, customer?.name, quote.id, quote.totalValue)} className="p-2 text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl transition-all transition-all inline-flex" title="Ação Tranquila (Acompanhamento)">`);


fs.writeFileSync(file, code, 'utf8');
console.log("Done");
