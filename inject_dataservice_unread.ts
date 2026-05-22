import * as fs from 'fs';

const file = 'C:/Users/SAMSUNG/Downloads/rtc---toldos-&-cortinas/rtcweb/services/dataService.ts';
let code = fs.readFileSync(file, 'utf8');

const oldLeads = `async getCRMLeads() {
        const { data, error } = await supabase
            .from('crm_leads')
            .select('*, customer:customers(*)');
        if (error) throw error;
        return (data || []).map(l => ({
            ...l,
            customerId: l.customer_id,
            assignedTo: l.assigned_to,
            productInterest: l.product_interest,
            lastContact: l.last_contact,
            createdAt: l.created_at,
            // Para leads sem cliente cadastrado, usar o phone direto do lead
            phone: l.phone || l.customer?.phone || null,
            pushName: l.push_name,
            unreadCount: l.unread_count || 0,
        })).sort((a, b) => {`;

const newLeads = `async getCRMLeads() {
        const { data, error } = await supabase
            .from('crm_leads')
            .select('*, customer:customers(*)');
        if (error) throw error;
        
        // Buscar nomes (pushName) e unread counts na hora
        const phones = data?.map(l => l.phone || l.customer?.phone).filter(Boolean) || [];
        const { data: msgsData } = await supabase
            .from('whatsapp_messages')
            .select('phone, pushName, status, direction')
            .in('phone', phones.map(p => p.replace(/\\D/g, '')));
            
        const pushNamesMap: any = {};
        const unreadCountsMap: any = {};
        if (msgsData) {
            msgsData.forEach(m => {
                const p = '55' + m.phone.replace(/^55/, ''); // normaliza para bater com crm
                if (m.pushName) pushNamesMap[p] = m.pushName;
                if (m.direction === 'inbound' && m.status !== 'read') {
                    unreadCountsMap[p] = (unreadCountsMap[p] || 0) + 1;
                }
            });
        }

        return (data || []).map(l => {
            const p = l.phone || l.customer?.phone || '';
            const normalizedP = p ? '55' + p.replace(/\\D/g, '').replace(/^55/, '') : '';
            return {
                ...l,
                customerId: l.customer_id,
                assignedTo: l.assigned_to,
                productInterest: l.product_interest,
                lastContact: l.last_contact,
                createdAt: l.created_at,
                phone: p || null,
                pushName: l.push_name || pushNamesMap[normalizedP] || null,
                unreadCount: unreadCountsMap[normalizedP] || l.unread_count || 0,
            };
        }).sort((a, b) => {`;

if (code.includes('async getCRMLeads() {')) {
    code = code.replace(oldLeads, newLeads);
    fs.writeFileSync(file, code, 'utf8');
    console.log("getCRMLeads dynamic fetch added!");
} else {
    console.log("Logic not found");
}
