import * as fs from 'fs';

const file = 'C:/Users/SAMSUNG/Downloads/rtc---toldos-&-cortinas/rtcweb/pages/IAManager.tsx';
let code = fs.readFileSync(file, 'utf8');

const singleLineBlock = `                               <div className="flex items-center gap-2 overflow-hidden whitespace-nowrap text-ellipsis">
                                 <Zap size={14} className="text-purple-600 shrink-0 animate-pulse" />
                                 <span className="text-[10px] font-black text-purple-800 uppercase tracking-widest shrink-0 hidden md:inline">Nova Mensagem:</span>
                                 <span className="text-xs text-slate-800 font-medium italic truncate max-w-[200px]">"{aiInteraction.message}"</span>
                                 <span className="text-slate-400 shrink-0">•</span>
                                 <span className="text-xs text-purple-700 truncate">{generateAIAnalysis([{ direction: 'inbound', message: aiInteraction.message }])}</span>
                               </div>`;

const smallFontBlock = `                               <div className="flex items-start gap-2">
                                 <Zap size={14} className="text-purple-600 mt-0.5 shrink-0 animate-pulse" />
                                 <div>
                                   <p className="text-[9px] font-black text-purple-800 uppercase tracking-widest mb-0.5">Nova Mensagem do Cliente</p>
                                   <p className="text-[11px] text-slate-800 font-medium italic mb-0.5 leading-tight">"{aiInteraction.message}"</p>
                                   <p className="text-[10px] text-purple-700 leading-tight">{generateAIAnalysis([{ direction: 'inbound', message: aiInteraction.message }])}</p>
                                 </div>
                               </div>`;

code = code.split(singleLineBlock).join(smallFontBlock);

fs.writeFileSync(file, code, 'utf8');
console.log("Reverted to multi-line with smaller fonts!");
