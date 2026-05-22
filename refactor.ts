import * as fs from 'fs';

const file = 'C:/Users/SAMSUNG/Downloads/rtc---toldos-&-cortinas/rtcweb/pages/IAManager.tsx';
let code = fs.readFileSync(file, 'utf8');

// 0. Add missing imports
const importSearch = /import \{ Settings, Plus, Trash2, Phone, ToggleLeft, ToggleRight, UserCheck \} from 'lucide-react';/;
code = code.replace(importSearch, "import { Settings, Plus, Trash2, Phone, ToggleLeft, ToggleRight, UserCheck, FileText, Link, X } from 'lucide-react';\nimport OrderContractPrint from '../components/OrderContractPrint';");

// 1. States
const stateSearch = /  const \[newNotifStage, setNewNotifStage\] = useState\('Novos Pedidos'\);/;
code = code.replace(
  stateSearch,
  `  const [newNotifStage, setNewNotifStage] = useState('Novos Pedidos');

  const [isHtmlModalOpen, setIsHtmlModalOpen] = useState(false);
  const [activeHtmlQuote, setActiveHtmlQuote] = useState<Order | null>(null);

  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [qrCodeData, setQrCodeData] = useState<{ base64?: string, code?: string, message?: string } | null>(null);
  const [isFetchingQr, setIsFetchingQr] = useState(false);
  const [evolutionApiSettings, setEvolutionApiSettings] = useState<any>(null);`
);

// 2. Fetch Goals
code = code.replace(
  '        setEvolutionApiSettingsId(evoSet.id);\r\n        if (evoSet.settings?.sellerInstances) {',
  '        setEvolutionApiSettingsId(evoSet.id);\n        setEvolutionApiSettings(evoSet);\n        if (evoSet.settings?.sellerInstances) {'
);
code = code.replace(
  '        setEvolutionApiSettingsId(evoSet.id);\n        if (evoSet.settings?.sellerInstances) {',
  '        setEvolutionApiSettingsId(evoSet.id);\n        setEvolutionApiSettings(evoSet);\n        if (evoSet.settings?.sellerInstances) {'
);

// 3. handleConnectInstance
code = code.replace(
  '    } catch (err: any) {\r\n      alert(`Erro ao salvar instância: ${err.message}`);\r\n    }\r\n  };',
  '    } catch (err: any) {\n      alert(`Erro ao salvar instância: ${err.message}`);\n    }\n  };\n\n  const handleConnectInstance = async (instanceName: string) => {\n    if (!evolutionApiSettings || !instanceName) return;\n    try {\n      setIsFetchingQr(true);\n      setIsQrModalOpen(true);\n      const data = await evolutionService.getQRCode(evolutionApiSettings.settings.baseUrl, evolutionApiSettings.settings.apiKey, instanceName, instanceName);\n      if (data && data.base64) setQrCodeData({ base64: data.base64 });\n      else if (data && data.code) setQrCodeData({ code: data.code });\n      else if (data && data.instance?.state === "open") setQrCodeData({ message: "Conectado" });\n      else setQrCodeData({ message: "Não foi possível obter o QR Code." });\n    } catch (err: any) {\n      setQrCodeData({ message: `Erro: ${err.message}` });\n    } finally {\n      setIsFetchingQr(false);\n    }\n  };'
);
code = code.replace(
  '    } catch (err: any) {\n      alert(`Erro ao salvar instância: ${err.message}`);\n    }\n  };',
  '    } catch (err: any) {\n      alert(`Erro ao salvar instância: ${err.message}`);\n    }\n  };\n\n  const handleConnectInstance = async (instanceName: string) => {\n    if (!evolutionApiSettings || !instanceName) return;\n    try {\n      setIsFetchingQr(true);\n      setIsQrModalOpen(true);\n      const data = await evolutionService.getQRCode(evolutionApiSettings.settings.baseUrl, evolutionApiSettings.settings.apiKey, instanceName, instanceName);\n      if (data && data.base64) setQrCodeData({ base64: data.base64 });\n      else if (data && data.code) setQrCodeData({ code: data.code });\n      else if (data && data.instance?.state === "open") setQrCodeData({ message: "Conectado" });\n      else setQrCodeData({ message: "Não foi possível obter o QR Code." });\n    } catch (err: any) {\n      setQrCodeData({ message: `Erro: ${err.message}` });\n    } finally {\n      setIsFetchingQr(false);\n    }\n  };'
);

// 4. button
const btnSearch = `                                <td className="px-8 py-5">\r
                                   <select\r
                                      className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-700 focus:ring-2 ring-purple-500"\r
                                      value={sellerInstancesMapping[seller.id] || ''}\r
                                      onChange={(e) => handleSaveSellerInstance(seller.id, e.target.value)}\r
                                   >\r
                                      <option value="">-- Sem Instância --</option>\r
                                      {whatsappInstances.map(inst => (\r
                                         <option key={inst.id} value={inst.instance_name}>{inst.name || inst.instance_name}</option>\r
                                      ))}\r
                                   </select>\r
                                </td>`;
const btnSearchUnix = btnSearch.replace(/\r/g, '');
const btnReplace = `                                <td className="px-8 py-5">
                                   <div className="flex items-center gap-2">
                                     <select
                                        className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-700 focus:ring-2 ring-purple-500"
                                        value={sellerInstancesMapping[seller.id] || ''}
                                        onChange={(e) => handleSaveSellerInstance(seller.id, e.target.value)}
                                     >
                                        <option value="">-- Sem Instância --</option>
                                        {whatsappInstances.map(inst => (
                                           <option key={inst.id} value={inst.instance_name}>{inst.name || inst.instance_name}</option>
                                        ))}
                                     </select>
                                     {sellerInstancesMapping[seller.id] && (
                                        <button onClick={() => handleConnectInstance(sellerInstancesMapping[seller.id])} className="p-3 bg-purple-100 text-purple-600 rounded-xl hover:bg-purple-200 transition-colors flex-shrink-0" title="Ler QR Code">
                                          <Link size={18} />
                                        </button>
                                     )}
                                   </div>
                                </td>`;
if (code.includes(btnSearch)) code = code.replace(btnSearch, btnReplace);
else code = code.replace(btnSearchUnix, btnReplace);

// 5. Grid block
const gridStart = '{/* List of Open Quotes */}';
const gridEndRegex = /      <\/div>\r?\n\r?\n\r?\n      \{\/\* Preview Modal \*\/\}/;
const gridEndMatch = code.match(gridEndRegex);

let gridBlock = code.substring(code.indexOf(gridStart), gridEndMatch.index + 12);

let gridBlockNew = gridBlock.replace('<div>\r\n            <select', '{!sellerMode && (<div>\r\n            <select');
gridBlockNew = gridBlockNew.replace('<div>\n            <select', '{!sellerMode && (<div>\n            <select');
gridBlockNew = gridBlockNew.replace('</select>\r\n          </div>', '</select>\r\n          </div>\r\n          )}');
gridBlockNew = gridBlockNew.replace('</select>\n          </div>', '</select>\n          </div>\n          )}');
gridBlockNew = gridBlockNew.replace(/selectedSellerFilter === 'ALL'/g, "targetSellerFilter === 'ALL'");
gridBlockNew = gridBlockNew.replace(/o\.sellerId === selectedSellerFilter/g, "o.sellerId === targetSellerFilter");
gridBlockNew = gridBlockNew.replace('{/* List of Open Quotes */}', ''); // Remove comment causing syntax error!

// Add Acao header and button for Month
gridBlockNew = gridBlockNew.replace('<th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase text-right">Valor</th>', '<th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase text-right">Valor</th>\n                     <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase text-center">Ação</th>');
gridBlockNew = gridBlockNew.replace('<td className="px-6 py-4 text-sm font-black text-purple-600 text-right">R$ {quote.totalValue.toLocaleString(\'pt-BR\', { minimumFractionDigits: 2 })}</td>', '<td className="px-6 py-4 text-sm font-black text-purple-600 text-right">R$ {quote.totalValue.toLocaleString(\'pt-BR\', { minimumFractionDigits: 2 })}</td>\n                           <td className="px-6 py-4 text-center">\n                             <button onClick={() => { setActiveHtmlQuote(quote); setIsHtmlModalOpen(true); }} className="p-2 text-purple-600 hover:text-purple-800 hover:bg-purple-50 rounded-xl transition-all inline-flex" title="Visualizar Contrato">\n                               <FileText size={16} />\n                             </button>\n                           </td>');

// Add Acao header and button for Retroative
gridBlockNew = gridBlockNew.replace('<th className="px-6 py-3 text-[10px] font-black text-rose-400 uppercase text-right">Valor</th>', '<th className="px-6 py-3 text-[10px] font-black text-rose-400 uppercase text-right">Valor</th>\n                     <th className="px-6 py-3 text-[10px] font-black text-rose-400 uppercase text-center">Ação</th>');
gridBlockNew = gridBlockNew.replace('<td className="px-6 py-4 text-sm font-black text-rose-600 text-right">R$ {quote.totalValue.toLocaleString(\'pt-BR\', { minimumFractionDigits: 2 })}</td>', '<td className="px-6 py-4 text-sm font-black text-rose-600 text-right">R$ {quote.totalValue.toLocaleString(\'pt-BR\', { minimumFractionDigits: 2 })}</td>\n                           <td className="px-6 py-4 text-center">\n                             <button onClick={() => { setActiveHtmlQuote(quote); setIsHtmlModalOpen(true); }} className="p-2 text-purple-600 hover:text-purple-800 hover:bg-purple-50 rounded-xl transition-all inline-flex" title="Visualizar Contrato">\n                               <FileText size={16} />\n                             </button>\n                           </td>');

const renderGridFn = '\n  const renderOpenQuotesGrid = (sellerMode: boolean = false) => {\n    const targetSellerFilter = sellerMode ? (currentUser?.sellerId || "") : selectedSellerFilter;\n    return (\n' + gridBlockNew + '\n    );\n  };\n';

code = code.replace(gridBlock, '{renderOpenQuotesGrid(false)}');

// Modals
const modalsStart = '      {/* Preview Modal */}';
const modalsEndRegex = /      <\/>\r?\n      \)\}/;
const modalsBlock = code.substring(code.indexOf(modalsStart), code.match(modalsEndRegex).index);

const newModals = `
      {/* HTML View Modal */}
      {isHtmlModalOpen && activeHtmlQuote && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-[40px] w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in duration-300">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-purple-100 text-purple-600 rounded-2xl"><FileText size={24} /></div>
                <div><h3 className="text-xl font-black text-slate-900">Visualização de Contrato</h3></div>
              </div>
              <button onClick={() => { setIsHtmlModalOpen(false); setActiveHtmlQuote(null); }} className="w-10 h-10 rounded-2xl bg-slate-200 flex items-center justify-center"><X size={20} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 bg-slate-200">
              <OrderContractPrint order={activeHtmlQuote} customer={customers.find(c => c.id === activeHtmlQuote.customerId) as Customer} seller={sellers.find(s => s.id === activeHtmlQuote.sellerId) as Seller} products={products} technicalSheets={technicalSheets} isPrintMode={false} />
            </div>
          </div>
        </div>
      )}
      {/* QR Code Modal */}
      {isQrModalOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-[40px] w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in duration-300">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-purple-100 text-purple-600 rounded-2xl"><Phone size={24} /></div>
                <div><h3 className="text-xl font-black text-slate-900">Conectar WhatsApp</h3></div>
              </div>
              <button onClick={() => { setIsQrModalOpen(false); setQrCodeData(null); }} className="p-2"><X size={20} /></button>
            </div>
            <div className="p-8 flex flex-col items-center justify-center min-h-[300px]">
              {isFetchingQr ? <p>Gerando QR Code...</p> : qrCodeData?.base64 ? <img src={qrCodeData.base64} className="w-64 h-64" /> : qrCodeData?.code ? <p className="text-3xl font-black">{qrCodeData.code}</p> : <p>{qrCodeData?.message}</p>}
            </div>
          </div>
        </div>
      )}
`;

const renderModalsFn = '\n  const renderModals = () => (\n    <>\n' + modalsBlock + newModals + '    </>\n  );\n';

code = code.replace('  // --- RENDER SELLER VIEW ---', renderGridFn + renderModalsFn + '\n  // --- RENDER SELLER VIEW ---');

const sellerEndSearch = /              \)}\r?\n          <\/div>\r?\n        <\/div>\r?\n      <\/div>/;
code = code.replace(sellerEndSearch, '              )}\n          </div>\n        </div>\n      </div>\n\n      {renderOpenQuotesGrid(true)}\n\n      {renderModals()}\n    </div>\n  );\n}');

code = code.replace(modalsBlock, '');
code = code.replace(/      <\/>\r?\n      \)\}\r?\n    <\/div>/, '      {renderModals()}\n      </>\n      )}\n    </div>');

fs.writeFileSync(file, code);
console.log('Done!');
