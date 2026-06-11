import * as fs from 'fs';

const file = 'C:/Users/SAMSUNG/Downloads/rtc---toldos-&-cortinas/rtcweb/services/dataService.ts';
let code = fs.readFileSync(file, 'utf8');

const oldMethod = `async getWhatsappMessages(phone: string) {`;
const newMethod = `async markChatAsRead(phone: string) {
        if (!phone) return;
        const cleanPhone = phone.replace(/\\D/g, '');
        const variants = [cleanPhone];
        if (cleanPhone.startsWith('55')) variants.push(cleanPhone.substring(2));
        else variants.push('55' + cleanPhone);

        // Atualiza as mensagens para read
        await supabase
            .from('whatsapp_messages')
            .update({ status: 'read' })
            .in('phone', variants)
            .eq('direction', 'inbound')
            .neq('status', 'read');
    },

    async getWhatsappMessages(phone: string) {`;

if (code.includes('async getWhatsappMessages(phone: string) {')) {
    code = code.replace(oldMethod, newMethod);
    fs.writeFileSync(file, code, 'utf8');
    console.log("markChatAsRead added!");
} else {
    console.log("Logic not found");
}
