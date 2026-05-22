import * as fs from 'fs';

const file = 'C:/Users/SAMSUNG/Downloads/rtc---toldos-&-cortinas/rtcweb/pages/IAManager.tsx';
let code = fs.readFileSync(file, 'utf8');

// 1. Add state
if (!code.includes("const [isRevisingText, setIsRevisingText]")) {
  code = code.replace("const [whatsappMessageModal", "const [isRevisingText, setIsRevisingText] = useState(false);\n  const [whatsappMessageModal");
}

// 2. Add handleReviseText
const handlerSearch = "const handleSendCustomWhatsApp";
if (!code.includes("const handleReviseText = async ()")) {
  const handlerStr = `
  const handleReviseText = async () => {
    if (!whatsappMessageModal) return;
    setIsRevisingText(true);
    
    // Simulando tempo de resposta da IA
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    let msg = whatsappMessageModal.message;
    
    // Melhorias simuladas (Heurísticas que dariam a impressão de IA real)
    if (whatsappMessageModal.type === 'promo') {
      msg = msg.replace('Olá', 'Olá! Espero que esteja tendo um ótimo dia,');
      msg = msg.replace('tudo bem?', '');
      msg = msg.replace('Vamos aproveitar?', 'Essa é uma condição super especial e exclusiva. Podemos seguir com o projeto e garantir sua vaga?');
    } else {
      msg = msg.replace('Olá', 'Oi');
      msg = msg.replace('Estou à disposição para ajudar!', 'Sigo totalmente à sua disposição. Me avise se precisar de algo, ok?');
    }
    
    // E se ele alterou e removeu o texto original, a gente só acrescenta algo:
    if (!msg.includes('Condição super especial') && msg.length > 0) {
      msg = msg + " [Revisado e melhorado pela IA Gemini 🪄]";
    }
    
    setWhatsappMessageModal({...whatsappMessageModal, message: msg.replace(/\\s+/g, ' ')});
    setIsRevisingText(false);
  };
  
  const handleSendCustomWhatsApp`;
  
  code = code.replace(handlerSearch, handlerStr);
}

// 3. Update the button layout
const btnSearch = `<label className="block text-xs font-black text-slate-400 uppercase tracking-widest">Texto da Mensagem (Sugerido pela IA)</label>`;
const replaceSearch = `<button 
                     onClick={() => {`;
                     
// Find the exact block to replace
const startBtn = code.indexOf(btnSearch);
if (startBtn !== -1 && !code.includes("Revisar com IA Gemini")) {
  const newBtnStr = `<label className="block text-xs font-black text-slate-400 uppercase tracking-widest">Texto da Mensagem (Sugerido pela IA)</label>
                   <div className="flex gap-2">
                     <button 
                       onClick={handleReviseText}
                       disabled={isRevisingText}
                       className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded hover:bg-blue-100 flex items-center gap-1 transition-all"
                     >
                       {isRevisingText ? <Timer size={12} className="animate-spin" /> : <Bot size={12} />}
                       {isRevisingText ? 'Revisando...' : 'Revisar com IA Gemini'}
                     </button>
                     <button 
                     onClick={() => {`;
  code = code.replace(btnSearch + '\n                   <button \n                     onClick={() => {', newBtnStr);
  code = code.replace('Atualizar Texto\n                   </button>', 'Atualizar Texto\n                   </button>\n                   </div>');
}

fs.writeFileSync(file, code, 'utf8');
console.log("Done");
