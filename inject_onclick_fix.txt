import * as fs from 'fs';

const file = 'C:/Users/SAMSUNG/Downloads/rtc---toldos-&-cortinas/rtcweb/pages/CRM.tsx';
let code = fs.readFileSync(file, 'utf8');

const oldOnClick = `const customer = lead.customer || customers.find(c => c.id === lead.customer_id);
                      if (customer) {
                        setActiveChat(customer);
                        loadMessages(customer.phone);
                      }`;
const newOnClick = `const customer = lead.customer || customers.find(c => c.id === lead.customer_id) || {
                          id: lead.customer_id || lead.id,
                          name: lead.name || 'Lead WhatsApp',
                          phone: lead.phone || '',
                          document: '',
                          address: '',
                          created_at: new Date().toISOString()
                        };
                      if (customer && customer.phone) {
                        setActiveChat(customer);
                        // No loadMessages call because useEffect [activeChat] already calls loadMessages
                        // and we removed the loadMessages from onClick to prevent double loading
                      } else {
                        // Se não tem telefone, a gente avisa
                        console.error("Lead sem telefone!");
                      }`;

if (code.includes('const customer = lead.customer || customers.find(c => c.id === lead.customer_id);')) {
    code = code.replace(oldOnClick, newOnClick);
    fs.writeFileSync(file, code, 'utf8');
    console.log("OnClick fix applied!");
} else {
    console.log("OnClick logic not found");
}
