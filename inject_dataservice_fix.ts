import * as fs from 'fs';

const file = 'C:/Users/SAMSUNG/Downloads/rtc---toldos-&-cortinas/rtcweb/services/dataService.ts';
let code = fs.readFileSync(file, 'utf8');

const oldSave = `const payload: any = {
            customer_id: lead.customerId || null,
            phone: lead.phone ? lead.phone.replace(/\\D/g, '') : null,
            stage: lead.stage,
            product_interest: lead.productInterest,
            temperature: lead.temperature,
            notes: lead.notes,
            assigned_to: lead.assignedTo,
            last_contact: new Date().toISOString()
        };`;

const newSave = `const payload: any = {
            customer_id: lead.customerId || null,
            stage: lead.stage,
            product_interest: lead.productInterest,
            temperature: lead.temperature,
            notes: lead.notes,
            assigned_to: lead.assignedTo,
            last_contact: new Date().toISOString()
        };
        if (lead.phone !== undefined) {
            payload.phone = lead.phone ? lead.phone.replace(/\\D/g, '') : null;
        }`;

if (code.includes('phone: lead.phone ? lead.phone.replace(/\\D/g, \'\') : null,')) {
    code = code.replace(oldSave, newSave);
    fs.writeFileSync(file, code, 'utf8');
    console.log("dataService saveCRMLead fixed!");
} else {
    console.log("dataService logic not found");
}
