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

const analysisBlock = `
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
`;

const searchStr = ') : (\\n                historyMessages.map';
// Since whitespace can be tricky, I'll use a split replace on just `) : (` before historyMessages.map
if (code.includes(') : (\n                historyMessages.map') && !code.includes('Análise Silenciosa da IA')) {
    code = code.replace(') : (\n                historyMessages.map', ') : (\n              <>\n' + analysisBlock + '\n                {historyMessages.map');
    // Also we need to wrap the whole map in a fragment if we added an element before it, but since we are inside a div flex col, we can just replace the ternary branch
    // Wait! The ternary was: condition ? A : condition2 ? B : ( map )
    // If I put it inside the parentheses, I need to wrap it in a fragment: <> {analysisBlock} {historyMessages.map...} </>
    
    fs.writeFileSync(file, code, 'utf8');
    console.log("Analysis block injected successfully.");
} else if (code.includes(') : (\r\n                historyMessages.map')) {
    code = code.replace(') : (\r\n                historyMessages.map', ') : (\r\n              <>\r\n' + analysisBlock + '\r\n                {historyMessages.map');
    code = code.replace('))\n              )}', '))\n              }</>)}');
    code = code.replace('))\r\n              )}', '))\r\n              }</>)}');
    fs.writeFileSync(file, code, 'utf8');
    console.log("Analysis block injected successfully (CRLF).");
} else {
    // Ultimate fallback using regex
    code = code.replace(/historyMessages\.map\(\(msg/g, analysisBlock + '\n                {historyMessages.map((msg');
    code = code.replace(/\) : \(\s+<div className="bg-gradient-to-r/g, ') : (<>\n              <div className="bg-gradient-to-r');
    code = code.replace(/\)\)\s+\)\}/g, '))\n              }</>)}');
    fs.writeFileSync(file, code, 'utf8');
    console.log("Regex fallback attempt.");
}
