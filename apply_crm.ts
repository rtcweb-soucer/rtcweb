import * as fs from 'fs';

const file = 'C:/Users/SAMSUNG/Downloads/rtc---toldos-&-cortinas/rtcweb/pages/CRM.tsx';
let code = fs.readFileSync(file, 'utf8');

// 1. Add searchTerm state
if (!code.includes('const [searchTerm, setSearchTerm]')) {
   code = code.replace(
      'const [chatInput, setChatInput] = useState(\'\');',
      'const [chatInput, setChatInput] = useState(\'\');\n  const [searchTerm, setSearchTerm] = useState(\'\');'
   );
}

// 2. Change Realtime channel behavior to append instead of loadMessages
const oldRealtime = `(payload) => {
            loadMessages(activeChat.phone!);
            // Não rolamos mais automaticamente aqui para evitar teimosia
          }`;
const newRealtime = `(payload) => {
            // Ao invés de baixar 50 msgs, apenas adiciona a nova no final do array local
            if (payload.new) {
               setMessages(prev => {
                 // Verifica duplicidade (evolution pode disparar webhook + db insert)
                 if (prev.find(m => m.id === payload.new.id)) return prev;
                 return [...prev, payload.new];
               });
               // Scroll suave para a nova mensagem se o usuário não estiver rolando pra cima
               setTimeout(() => scrollToBottom(), 100);
            }
          }`;
if (code.includes('loadMessages(activeChat.phone!);')) {
   code = code.replace(oldRealtime, newRealtime);
}

// 3. Search Bar Input
const oldInput = `<input 
                type="text" 
                placeholder="Pesquisar ou começar uma nova conversa" 
                className="w-full pl-10 pr-4 py-1.5 bg-[#f0f2f5] border-none rounded-lg text-sm focus:ring-0 outline-none placeholder:text-slate-500"
              />`;
const newInput = `<input 
                type="text" 
                placeholder="Pesquisar contato ou número..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-1.5 bg-[#f0f2f5] border-none rounded-lg text-sm focus:ring-0 outline-none placeholder:text-slate-500"
              />`;
code = code.replace(oldInput, newInput);

// 4. Tabs & Filters mapping
const oldTabs = `[
                { id: 'all', label: 'Tudo' },
                { id: 'unread', label: 'Não lidas' },
                { id: 'favorites', label: 'Favoritos' },
                { id: 'groups', label: 'Transferências' }
              ]`;
const newTabs = `[
                { id: currentUser?.id || 'me', label: 'Minhas' },
                { id: 'transferred', label: 'Transferidas' },
                { id: 'all', label: 'Todas' }
              ]`;
if (code.includes("id: 'all', label: 'Tudo'")) {
   code = code.replace(oldTabs, newTabs);
}

// Fix the activeUserTab mapping on button
const oldTabClick = `onClick={() => filter.id === 'all' ? setActiveUserTab('all') : null}`;
const newTabClick = `onClick={() => setActiveUserTab(filter.id)}`;
code = code.replace(oldTabClick, newTabClick);

// 5. Filter Logic in crmLeads
const oldFilterLogic = `const filtered = crmLeads.filter(l => {
                if (activeUserTab === 'all') return true;
                return l.assigned_to === activeUserTab;
              });`;
const newFilterLogic = `const filtered = crmLeads.filter(l => {
                const cName = (l.customer?.name || '').toLowerCase();
                const cPhone = (l.customer?.phone || '').toLowerCase();
                const matchSearch = !searchTerm || cName.includes(searchTerm.toLowerCase()) || cPhone.includes(searchTerm);
                if (!matchSearch) return false;

                if (activeUserTab === 'all') return true;
                if (activeUserTab === 'transferred') return l.assigned_to !== currentUser?.id && l.assigned_to !== null;
                
                return l.assigned_to === activeUserTab;
              });`;
if (code.includes("if (activeUserTab === 'all') return true;")) {
   code = code.replace(oldFilterLogic, newFilterLogic);
}

// 6. Image parsing
// Wait, the image rendering in CRM.tsx might look different.
// I will just read it inside node to see exact string or use a regex to replace the image block.
fs.writeFileSync('C:/Users/SAMSUNG/Downloads/rtc---toldos-&-cortinas/rtcweb/inject_crm_fixes.ts', code, 'utf8');
