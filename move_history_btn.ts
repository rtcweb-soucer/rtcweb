import * as fs from 'fs';

const file = 'C:/Users/SAMSUNG/Downloads/rtc---toldos-&-cortinas/rtcweb/pages/IAManager.tsx';
let code = fs.readFileSync(file, 'utf8');

// The goal is to move the History button from inside sellerMode to just before sellerMode.
const historyBtnStr = `\n                                 <button onClick={() => handleOpenHistory(quote, customer?.phone)} className="p-2 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-xl transition-all inline-flex" title="Histórico de Conversas">\n                                   <History size={16} />\n                                 </button>`;

if (code.includes(historyBtnStr)) {
   code = code.split(historyBtnStr).join(''); // Remove from inside
}

// Now we add it back, right after the Visualizar Contrato button
// "Visualizar Contrato">\n                               <FileText size={16} />\n                             </button>
const insertTarget = `Visualizar Contrato">\n                               <FileText size={16} />\n                             </button>`;
const newHistoryBtn = `\n                             <button onClick={() => handleOpenHistory(quote, customer?.phone)} className="p-2 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-xl transition-all inline-flex" title="Histórico de Conversas">\n                               <History size={16} />\n                             </button>`;

if (code.includes(insertTarget)) {
    code = code.split(insertTarget).join(insertTarget + newHistoryBtn);
    fs.writeFileSync(file, code, 'utf8');
    console.log("Moved History button successfully.");
} else {
    console.log("Could not find the insertion target.");
}
