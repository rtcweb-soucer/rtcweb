import * as fs from 'fs';

const file = 'C:/Users/SAMSUNG/Downloads/rtc---toldos-&-cortinas/rtcweb/pages/CRM.tsx';
let code = fs.readFileSync(file, 'utf8');

const oldLink = `await dataService.saveCRMLead({
          id: lead.id,
          customerId: customer.id,
          stage: 'ATENDIMENTO', // Mudar para atendimento ao vincular
          productInterest: lead.productInterest,
          assignedTo: lead.assigned_to || lead.assignedTo,
          notes: lead.notes ? \`\${lead.notes}\\n---\\nVinculado ao cliente \${customer.name} (Fase movida p/ ATENDIMENTO)\` : \`Vinculado manualmente ao cliente \${customer.name}\`
        });`;

const newLink = `await dataService.saveCRMLead({
          id: lead.id,
          customerId: customer.id,
          phone: lead.phone || activeChat.phone,
          stage: 'ATENDIMENTO', // Mudar para atendimento ao vincular
          productInterest: lead.productInterest,
          assignedTo: lead.assigned_to || lead.assignedTo,
          notes: lead.notes ? \`\${lead.notes}\\n---\\nVinculado ao cliente \${customer.name} (Fase movida p/ ATENDIMENTO)\` : \`Vinculado manualmente ao cliente \${customer.name}\`
        });`;

if (code.includes('Vinculado manualmente ao cliente')) {
    code = code.replace(oldLink, newLink);
    fs.writeFileSync(file, code, 'utf8');
    console.log("CRM link logic fixed!");
} else {
    console.log("CRM link logic not found");
}
