import * as fs from 'fs';

const file = 'C:/Users/SAMSUNG/Downloads/rtc---toldos-&-cortinas/rtcweb/pages/CRM.tsx';
let code = fs.readFileSync(file, 'utf8');

// 1. Fix search logic (it appears in two places: filtered.slice and another filtered maybe)
const oldFilter = `const filtered = crmLeads.filter(l => {
                const cName = (l.customer?.name || '').toLowerCase();
                const cPhone = (l.customer?.phone || '').toLowerCase();
                const matchSearch = !searchTerm || cName.includes(searchTerm.toLowerCase()) || cPhone.includes(searchTerm);`;
const newFilter = `const filtered = crmLeads.filter(l => {
                const cName = (l.customer?.name || l.pushName || '').toLowerCase();
                const cPhone = (l.phone || '').toLowerCase();
                const matchSearch = !searchTerm || cName.includes(searchTerm.toLowerCase()) || cPhone.includes(searchTerm);`;

// 2. Fix display name and phone in Sidebar
const oldSidebarName = `{lead.customer?.name || 'Lead WhatsApp'}`;
const newSidebarName = `{lead.customer?.name || lead.pushName || 'Lead WhatsApp'}`;

const oldSidebarPhone = `<span className={\`text-[11px] \${lead.unreadCount > 0 ? 'text-[#25d366] font-bold' : 'text-slate-400 font-medium'}\`}>
                              {lead.unreadCount > 0 && (
                                <span className="inline-flex items-center justify-center w-4 h-4 bg-[#25d366] text-white rounded-full text-[9px] mr-1">
                                  {lead.unreadCount}
                                </span>
                              )}`;
const newSidebarPhone = `<span className="text-[10px] text-slate-400 mr-2 flex items-center gap-1"><Phone size={10} /> {lead.phone || ''}</span>
                              <span className={\`text-[11px] \${lead.unreadCount > 0 ? 'text-[#25d366] font-bold' : 'text-slate-400 font-medium'}\`}>
                              {lead.unreadCount > 0 && (
                                <span className="inline-flex items-center justify-center w-4 h-4 bg-[#25d366] text-white rounded-full text-[9px] mr-1">
                                  {lead.unreadCount}
                                </span>
                              )}`;

// 3. Mark as read on click / load
const oldLoadMessages = `loadMessages(activeChat.phone);

      // Setup Realtime para novas mensagens deste cliente`;
const newLoadMessages = `loadMessages(activeChat.phone);
      
      // Marca como lido
      dataService.markChatAsRead(activeChat.phone).then(() => {
        setCrmLeads(prev => prev.map(l => (l.phone === activeChat.phone || l.customer?.phone === activeChat.phone) ? { ...l, unreadCount: 0 } : l));
      });

      // Setup Realtime para novas mensagens deste cliente`;

// Apply fixes
if (code.includes(oldFilter)) code = code.replace(oldFilter, newFilter);
if (code.includes(oldSidebarName)) code = code.replace(oldSidebarName, newSidebarName);
if (code.includes(oldSidebarPhone)) code = code.replace(oldSidebarPhone, newSidebarPhone);
if (code.includes(oldLoadMessages)) code = code.replace(oldLoadMessages, newLoadMessages);

fs.writeFileSync(file, code, 'utf8');
console.log("CRM fixes applied!");
