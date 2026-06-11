import * as fs from 'fs';

const file = 'C:/Users/SAMSUNG/Downloads/rtc---toldos-&-cortinas/rtcweb/pages/IAManager.tsx';
let code = fs.readFileSync(file, 'utf8');

const analysisFunc = `
  const generateAIAnalysis = (msgs: any[]) => {
    if (!msgs || msgs.length === 0) return "Nenhuma conversa registrada ainda. O cliente está frio.";
    const inboundMsgs = msgs.filter(m => m.direction === 'inbound');
    
    if (inboundMsgs.length === 0) return "O vendedor enviou mensagens, mas o cliente ainda não respondeu. Pode ser necessário um follow-up mais incisivo.";
    
    const lastInbound = inboundMsgs[inboundMsgs.length - 1]?.message?.toLowerCase() || '';
    
    if (lastInbound.includes('não') || lastInbound.includes('parar') || lastInbound.includes('caro')) {
       return "O cliente demonstrou objeções recentemente (possível bloqueio por preço ou falta de interesse). Sugiro não insistir muito agora ou oferecer uma alternativa mais barata.";
    }
    
    if (lastInbound.includes('quero') || lastInbound.includes('sim') || lastInbound.includes('pagar') || lastInbound.includes('parcela')) {
       return "O cliente está muito quente! As respostas indicam alta intenção de fechamento. Recomendo ser direto e conduzir para a conclusão da venda.";
    }
    
    return "O cliente está engajado na conversa. Mantenha o relacionamento e tente conduzi-lo para o fechamento ressaltando os benefícios do produto.";
  };
`;

if (!code.includes('const generateAIAnalysis')) {
    code = code.replace('const handleOpenHistory = async', analysisFunc + '\n  const handleOpenHistory = async');
}

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
              {!isLoadingHistory && historyMessages.length > 0 && (
                <div className="bg-gradient-to-r from-purple-100 to-blue-50 border border-purple-200 rounded-xl p-4 mb-4 shadow-sm relative overflow-hidden flex-shrink-0">
                  <div className="absolute -right-4 -top-4 opacity-10">
                    <Bot size={64} />
                  </div>
                  <h4 className="text-xs font-black text-purple-800 uppercase tracking-widest mb-1 flex items-center gap-1">
                    <Zap size={14} className="text-purple-600" />
                    Análise Silenciosa da IA
                  </h4>
                  <p className="text-sm text-slate-700 font-medium leading-relaxed">
                    {generateAIAnalysis(historyMessages)}
                  </p>
                </div>
              )}
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

if (!code.includes('Histórico de Conversas (WhatsApp)')) {
    code = code.replace('const renderModals = () => (\n    <>', 'const renderModals = () => (\n    <>\n' + modalJSX);
    fs.writeFileSync(file, code, 'utf8');
    console.log("Injected History modal successfully!");
} else {
    console.log("History modal already seems to be injected.");
}
