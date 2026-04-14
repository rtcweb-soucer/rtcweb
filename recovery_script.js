import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://xjryvzmejpzwzuroquur.supabase.co';
const supabaseAnonKey = 'sb_publishable_rePhtWah5rIxTqmC2DIFLQ_Bcm_5pN_';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function executeFix() {
    try {
        const orderId = 'PROP-9580';
        const newSheetId = '7270d21b-b7ea-4aaa-b8b0-b846c6cfcbc3';
        const newItemIds = [
            '96898f44-d1b4-49de-b926-208a48543d8d',
            '46898f44-d1b4-49de-b926-208a48543d8e',
            '56898f44-d1b4-49de-b926-208a48543d8f',
            '66898f44-d1b4-49de-b926-208a48543d90'
        ];

        console.log(`--- Iniciando Vínculo do Pedido ${orderId} ---`);
        
        const { data, error } = await supabase
            .from('orders')
            .update({
                technical_sheet_id: newSheetId,
                item_ids: newItemIds,
                items_snapshot: null
            })
            .eq('id', orderId)
            .select();

        if (error) {
            console.error('Erro ao atualizar pedido:', error);
        } else {
            console.log('✅ Pedido PROP-9580 atualizado com sucesso com os IDs corretos do banco!');
            console.log('Resultado:', JSON.stringify(data, null, 2));
        }

    } catch (err) {
        console.error('Erro inesperado:', err);
    }
}

executeFix();
