import * as fs from 'fs';

const file = 'C:/Users/SAMSUNG/Downloads/rtc---toldos-&-cortinas/rtcweb/pages/CRM.tsx';
let code = fs.readFileSync(file, 'utf8');

const oldOnClick = `onClick={() => {
                      const customer = lead.customer || customers.find(c => c.id === lead.customer_id) || {
                          id: lead.customer_id || lead.id,
                          name: lead.name || 'Lead WhatsApp',
                          phone: lead.phone || '',
                          document: '',
                          address: '',
                          created_at: new Date().toISOString()
                        };
                      if (customer) {
                        setActiveChat(customer);
                      }
                    }}`;

const newOnClick = `onClick={(e) => {
                      e.preventDefault();
                      console.log("CLICKED LEAD:", lead);
                      let cust = lead.customer;
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
                      setActiveChat(cust);
                    }}`;

if (code.includes('onClick={() => {') && code.includes('const customer = lead.customer || customers.find')) {
    code = code.replace(oldOnClick, newOnClick);
    fs.writeFileSync(file, code, 'utf8');
    console.log("OnClick completely rewritten!");
} else {
    console.log("OnClick logic not found");
}
