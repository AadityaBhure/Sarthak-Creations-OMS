import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://kvhacwufjawwrqhhzphz.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2aGFjd3VmamF3d3JxaGh6cGh6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDU3MDU5MiwiZXhwIjoyMDk2MTQ2NTkyfQ.clvNF-mGPJRkT6xUP4NJDo4Ej2tuxvUGBecOcw2nKBU');

async function testSort() {
  const { data, error } = await supabase
    .from('orders')
    .select('id, clients!inner(name)')
    .order('clients(name)', { ascending: false })
    .limit(5);
  console.log("DESC results:", data ? data.map(d => d.clients?.name) : error);
}

testSort();
