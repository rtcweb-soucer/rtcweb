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

    console.log(`Found ${allData.length} messages with ERROR status.`);
    
    const errorTypes = {};
    for (const msg of allData) {
        let errLog = msg.error_log || 'Unknown';
        
        // Normalize the error log to ignore requestId and timestamp differences
        if (errLog.includes('requestId')) {
            errLog = errLog.replace(/"requestId":"req_[^"]+"/, '"requestId":"<HIDDEN>"');
        }
        
        if (!errorTypes[errLog]) {
            errorTypes[errLog] = { count: 0, sampleIds: [] };
        }
        errorTypes[errLog].count++;
        if (errorTypes[errLog].sampleIds.length < 2) {
             errorTypes[errLog].sampleIds.push(msg.id);
        }
    }

    console.log("\nError Summary:");
    for (const [err, info] of Object.entries(errorTypes)) {
        console.log(`\n- ${info.count}x : ${err}`);
        console.log(`  Sample IDs: ${info.sampleIds.join(', ')}`);
    }
}

main();
