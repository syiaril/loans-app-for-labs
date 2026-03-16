const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const { data, count, error } = await supabase
        .from('loans')
        .select('*, user:profiles!loans_user_id_fkey(name, department), loan_items(id)', { count: 'exact' })
        .limit(1);
    console.log('Error:', error);
    console.log('Count:', count);
    if(data) console.log('Data:', data[0].user);
}
check();
