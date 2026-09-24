const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://xjryvzmejpzwzuroquur.supabase.co';
const supabaseKey = 'sb_publishable_rePhtWah5rIxTqmC2DIFLQ_Bcm_5pN_';
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    let allData = [];
    let from = 0;
    const step = 1000;
    
    while(true) {
        const { data, error } = await supabase
            .from('mass_messages')
            .select('id, error_log')
            .eq('status', 'ERROR')
            .range(from, from + step - 1);

        if (error) {
            console.error("Error fetching:", error);
            return;
        }
        
        allData = allData.concat(data);
        if (data.length < step) break;
        from += step;
    }
    
    const idsToUpdate = [];
    
    for (const msg of allData) {
        const errLog = msg.error_log || '';
        // If it's a balance insufficient error, or a general network error, we retry.
        // If it says something like "not registered" or "invalid number", we skip.
        if (errLog.includes('BALANCE_INSUFFICIENT') || errLog.includes('timeout') || errLog.includes('fetch')) {
            idsToUpdate.push(msg.id);
        } else {
             console.log("Skipping retry for error:", errLog);
        }
    }

    console.log(`Found ${idsToUpdate.length} messages eligible to retry out of ${allData.length} errors.`);
    
    if (idsToUpdate.length > 0) {
        // Update in chunks
        let updatedCount = 0;
        const chunkSize = 500;
        for (let i = 0; i < idsToUpdate.length; i += chunkSize) {
            const chunk = idsToUpdate.slice(i, i + chunkSize);
            const { error } = await supabase
                .from('mass_messages')
                .update({ status: 'PENDING', error_log: null })
                .in('id', chunk);
                
            if (error) {
                console.error("Error updating:", error);
                return;
            }
            updatedCount += chunk.length;
            console.log(`Updated ${updatedCount}/${idsToUpdate.length}...`);
        }
        console.log("Done updating!");
    }
}

main();
