import * as fs from 'fs';

const file = 'C:/Users/SAMSUNG/Downloads/rtc---toldos-&-cortinas/rtcweb/pages/CRM.tsx';
let code = fs.readFileSync(file, 'utf8');

const oldIsActive = `const isActive = activeChat?.id === (lead.customer?.id || lead.customer_id);`;
const newIsActive = `const isActive = activeChat?.id === (lead.customer?.id || lead.customer_id || lead.id);`;

if (code.includes(oldIsActive)) {
    code = code.replace(oldIsActive, newIsActive);
    fs.writeFileSync(file, code, 'utf8');
    console.log("isActive logic fixed!");
} else {
    console.log("isActive logic not found");
}
