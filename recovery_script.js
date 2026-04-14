import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://xjryvzmejpzwzuroquur.supabase.co';
const supabaseAnonKey = 'sb_publishable_rePhtWah5rIxTqmC2DIFLQ_Bcm_4pN_';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkOrder176() {
    try {
        console.log('--- Buscando Dados do Contrato 2026-176 ---');
        const { data: order, error: oError } = await supabase
            .from('orders')
            .select(`
                id, 
                customer_id, 
                technical_sheet_id, 
                contract_number, 
                items_snapshot,
                customer:customer_id(id, name)
            `)
            .eq('contract_number', 'Contrato 2026-176')
            .single();

        if (oError) {
            console.error('Erro ao buscar pedido:', oError);
            return;
        }

        console.log('Pedido Encontrado:', JSON.stringify(order, null, 2));

        if (order.technical_sheet_id) {
            console.log('\n--- Buscando Dados da Ficha Técnica vinculada ---');
            const { data: sheet } = await supabase
                .from('technical_sheets')
                .select('id, customer_id, customer:customer_id(name)')
                .eq('id', order.technical_sheet_id)
                .single();
            console.log('Ficha Técnica:', JSON.stringify(sheet, null, 2));
        }

    } catch (err) {
        console.error(err);
    }
}

checkOrder176();
