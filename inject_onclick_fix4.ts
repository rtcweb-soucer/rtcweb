import * as fs from 'fs';

const file = 'C:/Users/SAMSUNG/Downloads/rtc---toldos-&-cortinas/rtcweb/pages/CRM.tsx';
let code = fs.readFileSync(file, 'utf8');

const oldClick = `let cust = lead.customer;
                      if (!cust && lead.customer_id) {
                         cust = customers.find(c => c.id === lead.customer_id);
                      }
                      if (!cust) {
                         cust = {
                           id: lead.customer_id || lead.id,
                           name: 'Lead WhatsApp',
                           phone: lead.phone || '',
                           document: '',
                           address: '',
                           created_at: new Date().toISOString()
                         };
                      }
                      setActiveChat(cust);`;

const newClick = `let cust = lead.customer;
                      if (!cust && lead.customer_id) {
                         cust = customers.find(c => c.id === lead.customer_id);
                      }
                      if (!cust) {
                         cust = {
                           id: lead.customer_id || lead.id,
                           name: 'Lead WhatsApp',
                           phone: lead.phone || '',
                           document: '',
                           address: '',
                           created_at: new Date().toISOString()
                         };
                      } else {
                         // PRESERVE LEAD PHONE! Se o telefone original do WhatsApp for diferente do cadastro
                         // (ou se o cadastro não tem), priorizamos o do WhatsApp para carregar o histórico correto!
                         cust = { ...cust, phone: lead.phone || cust.phone };
                      }
                      setActiveChat(cust);`;

if (code.includes('let cust = lead.customer;')) {
    code = code.replace(oldClick, newClick);
    fs.writeFileSync(file, code, 'utf8');
    console.log("OnClick lead phone preserved!");
} else {
    console.log("OnClick logic not found");
}
