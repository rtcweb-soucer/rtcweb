import * as fs from 'fs';

const file = 'C:/Users/SAMSUNG/Downloads/rtc---toldos-&-cortinas/rtcweb/pages/IAManager.tsx';
let code = fs.readFileSync(file, 'utf8');

const btnStr = `<button onClick={() => handleOpenHistory(quote, customer?.phone)} className="p-2 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-xl transition-all inline-flex" title="Histórico de Conversas"><History size={16} /></button>`;

// Ação Tranquila tem o ícone MessageCircle
const searchStr = `<MessageCircle size={16} />\n                                 </button>`;
const replaceStr = `<MessageCircle size={16} />\n                                 </button>\n                                 ` + btnStr;

if (code.includes(searchStr)) {
    code = code.split(searchStr).join(replaceStr);
    fs.writeFileSync(file, code, 'utf8');
    console.log("Fixed!");
} else {
    console.log("Search string not found!");
}
