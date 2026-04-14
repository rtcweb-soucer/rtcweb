import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://xjryvzmejpzwzuroquur.supabase.co';
const supabaseAnonKey = 'sb_publishable_rePhtWah5rIxTqmC2DIFLQ_Bcm_5pN_';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function finalMigration() {
    try {
        console.log('--- Iniciando Migração Final de Dados ---');
        
        // 1. Mapeamento de Produção: Itens de Abril (onde os dados estão) para Itens de Março (onde devem aparecer)
        const mapping = [
            { from: '96898f44-d1b4-49de-b926-208a48543d8d', to: '9ce6364b-1e74-46be-8031-8f227ff94739' }, // Cobertura
            { from: '46898f44-d1b4-49de-b926-208a48543d8e', to: 'bd2b79fb-5586-429b-9e43-b7898a96d1f8' }, // Motorização
            { from: '56898f44-d1b4-49de-b926-208a48543d8f', to: 'a5d6277a-8730-4c3c-92f7-59ac77ca00bc' }  // Calha
        ];

        for (const m of mapping) {
            console.log(`Movendo dados de produção de ${m.from} para ${m.to}...`);
            const { error } = await supabase
                .from('production_installation_sheets')
                .update({ measurement_item_id: m.to })
                .eq('measurement_item_id', m.from);
            
            if (error) console.error(`Erro ao mover item ${m.from}:`, error);
        }

        // 2. Atualizar o Pedido PROP-9580 para usar a ficha de Março e os 4 itens de Março
        const orderId = 'PROP-9580';
        const sheetIdMarch = '7270d21b-b7ea-4aaa-b8b0-b846c6cfcbc3';
        const itemIdsMarch = [
            '9ce6364b-1e74-46be-8031-8f227ff94739',
            'bd2b79fb-5586-429b-9e43-b7898a96d1f8',
            'a5d6277a-8730-4c3c-92f7-59ac77ca00bc',
            '4dbf354e-8958-478d-9d8e-56431ec5f56d'
        ];

        console.log(`\nReligando Pedido ${orderId} à Ficha de Março...`);
        const { error: orderError } = await supabase
            .from('orders')
            .update({
                technical_sheet_id: sheetIdMarch,
                item_ids: itemIdsMarch,
                items_snapshot: null
            })
            .eq('id', orderId);

        if (orderError) console.error('Erro ao atualizar pedido:', orderError);
        else console.log('✅ Pedido e PCP restaurados com sucesso!');

    } catch (err) {
        console.error('Erro inesperado:', err);
    }
}

finalMigration();
