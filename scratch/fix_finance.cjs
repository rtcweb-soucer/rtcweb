const fs = require('fs');
const path = 'c:\\Users\\SAMSUNG\\Downloads\\rtc---toldos-&-cortinas\\rtcweb\\pages\\Finance.tsx';
let content = fs.readFileSync(path, 'utf8');

// Header - Using a simpler target for better matching
const headerTarget = 'text-right">Valor</th>';
if (content.includes(headerTarget) && !content.includes('Valor Pago</th>')) {
    const headerReplace = headerTarget + '\n                               <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Valor Pago</th>';
    content = content.replace(headerTarget, headerReplace);
}

// Colspan
content = content.replace('colSpan={12}', 'colSpan={13}');

fs.writeFileSync(path, content);
console.log('Finance.tsx header and colspan updated');
