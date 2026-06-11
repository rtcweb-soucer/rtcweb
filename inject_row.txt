import * as fs from 'fs';

const file = 'C:/Users/SAMSUNG/Downloads/rtc---toldos-&-cortinas/rtcweb/pages/IAManager.tsx';
let code = fs.readFileSync(file, 'utf8');

const fragmentLogic = `
                      const aiInteraction = interestedCustomers.find(i => i.phone && customer?.phone && (i.phone.replace(/\\D/g, '').includes(customer.phone.replace(/\\D/g, '')) || customer.phone.replace(/\\D/g, '').includes(i.phone.replace(/\\D/g, ''))));
                      
                      return (
                        <React.Fragment key={quote.id}>
                        <tr className="hover:bg-slate-50 transition-colors">`;

const fragmentEndLogic = `
                        </tr>
                        {aiInteraction && (
                           <tr className="bg-purple-50/60 border-b border-purple-100 animate-pulse">
                             <td colSpan={5} className="px-6 py-3">
                               <div className="flex items-start gap-3">
                                 <Zap size={16} className="text-purple-600 mt-1 shrink-0" />
                                 <div>
                                   <p className="text-[10px] font-black text-purple-800 uppercase tracking-widest mb-1 flex items-center gap-1">Ação Requerida (Nova Mensagem)</p>
                                   <p className="text-sm text-slate-800 font-medium italic mb-1">"{aiInteraction.message}"</p>
                                   <p className="text-xs text-purple-700">{generateAIAnalysis([{ direction: 'inbound', message: aiInteraction.message }])}</p>
                                 </div>
                               </div>
                             </td>
                           </tr>
                        )}
                        </React.Fragment>
                      );
`;

const searchBlock = `                           </td>\n                        </tr>\n                      );`;

// Replace first block
if (code.includes('return (\n                        <tr key={quote.id} className="hover:bg-slate-50 transition-colors">')) {
   code = code.replace(
      'return (\n                        <tr key={quote.id} className="hover:bg-slate-50 transition-colors">', 
      fragmentLogic
   );
   code = code.replace(searchBlock, `                           </td>\n${fragmentEndLogic}`);
}

// Replace second block if it exists
if (code.includes('return (\n                        <tr key={quote.id} className="hover:bg-rose-50/30 transition-colors">')) {
   const fragmentLogic2 = `
                      const aiInteraction = interestedCustomers.find(i => i.phone && customer?.phone && (i.phone.replace(/\\D/g, '').includes(customer.phone.replace(/\\D/g, '')) || customer.phone.replace(/\\D/g, '').includes(i.phone.replace(/\\D/g, ''))));
                      
                      return (
                        <React.Fragment key={quote.id}>
                        <tr className="hover:bg-rose-50/30 transition-colors">`;
                        
   code = code.replace(
      'return (\n                        <tr key={quote.id} className="hover:bg-rose-50/30 transition-colors">', 
      fragmentLogic2
   );
   code = code.replace(searchBlock, `                           </td>\n${fragmentEndLogic}`);
}

fs.writeFileSync(file, code, 'utf8');
console.log("Footer row injected!");
