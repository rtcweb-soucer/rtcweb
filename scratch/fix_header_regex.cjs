const fs = require('fs');
const path = 'c:\\Users\\SAMSUNG\\Downloads\\rtc---toldos-&-cortinas\\rtcweb\\pages\\Finance.tsx';
let content = fs.readFileSync(path, 'utf8');

// Header Fix - Regex to be immune to whitespace/line-ending variations
const headerRegex = /(<th[^>]*text-right[^>]*>Valor<\/th>)/;
if (headerRegex.test(content) && !content.includes('Valor Pago</th>')) {
    content = content.replace(headerRegex, '$1\n                               <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Valor Pago</th>');
}

fs.writeFileSync(path, content);
console.log('Finance.tsx header fixed with regex');
