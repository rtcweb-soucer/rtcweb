import * as fs from 'fs';

const file = 'C:/Users/SAMSUNG/Downloads/rtc---toldos-&-cortinas/rtcweb/pages/CRM.tsx';
let code = fs.readFileSync(file, 'utf8');

const oldOnClick = `if (customer && customer.phone) {
                        setActiveChat(customer);
                        // No loadMessages call because useEffect [activeChat] already calls loadMessages
                        // and we removed the loadMessages from onClick to prevent double loading
                      } else {
                        // Se não tem telefone, a gente avisa
                        console.error("Lead sem telefone!");
                      }`;
const newOnClick = `if (customer) {
                        setActiveChat(customer);
                      }`;

if (code.includes('if (customer && customer.phone) {')) {
    code = code.replace(oldOnClick, newOnClick);
    fs.writeFileSync(file, code, 'utf8');
    console.log("OnClick phone check removed!");
} else {
    console.log("OnClick logic not found");
}
