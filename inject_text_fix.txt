import * as fs from 'fs';

const file = 'C:/Users/SAMSUNG/Downloads/rtc---toldos-&-cortinas/rtcweb/pages/CRM.tsx';
let code = fs.readFileSync(file, 'utf8');

const oldTextRender = `<p className="text-[#111b21] leading-[1.4]" style={{ whiteSpace: 'pre-wrap' }}>{msg.text}</p>`;
const newTextRender = `<p className="text-[#111b21] leading-[1.4]" style={{ whiteSpace: 'pre-wrap' }}>
                                  {text.length > 200 && !text.includes(' ') ? <span className="italic text-slate-400 text-[10px] break-all max-w-[200px] overflow-hidden line-clamp-2">Mídia processada</span> : msg.text}
                                </p>`;

if (code.includes(oldTextRender)) {
    code = code.replace(oldTextRender, newTextRender);
    fs.writeFileSync(file, code, 'utf8');
    console.log("Text fallback fix applied!");
} else {
    console.log("Text fallback not found");
}
