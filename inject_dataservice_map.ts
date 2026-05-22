import * as fs from 'fs';

const file = 'C:/Users/SAMSUNG/Downloads/rtc---toldos-&-cortinas/rtcweb/services/dataService.ts';
let code = fs.readFileSync(file, 'utf8');

const oldMap = `phone: l.phone || l.customer?.phone || null,
        })).sort((a, b) => {`;
const newMap = `phone: l.phone || l.customer?.phone || null,
            pushName: l.push_name,
            unreadCount: l.unread_count || 0,
        })).sort((a, b) => {`;

if (code.includes('phone: l.phone || l.customer?.phone || null,')) {
    code = code.replace(oldMap, newMap);
    fs.writeFileSync(file, code, 'utf8');
    console.log("dataService map fixed!");
} else {
    console.log("dataService logic not found");
}
