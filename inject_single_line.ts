import * as fs from 'fs';

const file = 'C:/Users/SAMSUNG/Downloads/rtc---toldos-&-cortinas/rtcweb/pages/IAManager.tsx';
let code = fs.readFileSync(file, 'utf8');

const oldBlock = `                               <div className="flex items-start gap-3">
                                 <Zap size={16} className="text-purple-600 mt-1 shrink-0" />
                                 <div>
                                   <p className="text-[10px] font-black text-purple-800 uppercase tracking-widest mb-1 flex items-center gap-1">Ação Requerida (Nova Mensagem)</p>
                                   <p className="text-sm text-slate-800 font-medium italic mb-1">"{aiInteraction.message}"</p>
                                   <p className="text-xs text-purple-700">{generateAIAnalysis([{ direction: 'inbound', message: aiInteraction.message }])}</p>
                                 </div>
                               </div>`;

const newBlock = `                               <div className="flex items-center gap-2 overflow-hidden whitespace-nowrap text-ellipsis">
                                 <Zap size={14} className="text-purple-600 shrink-0 animate-pulse" />
                                 <span className="text-[10px] font-black text-purple-800 uppercase tracking-widest shrink-0 hidden md:inline">Nova Mensagem:</span>
                                 <span className="text-xs text-slate-800 font-medium italic truncate max-w-[200px]">"{aiInteraction.message}"</span>
                                 <span className="text-slate-400 shrink-0">•</span>
                                 <span className="text-xs text-purple-700 truncate">{generateAIAnalysis([{ direction: 'inbound', message: aiInteraction.message }])}</span>
                               </div>`;

code = code.split(oldBlock).join(newBlock);

fs.writeFileSync(file, code, 'utf8');
console.log("Replaced multi-line with single-line!");
