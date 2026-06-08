import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://kvhacwufjawwrqhhzphz.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2aGFjd3VmamF3d3JxaGh6cGh6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDU3MDU5MiwiZXhwIjoyMDk2MTQ2NTkyfQ.clvNF-mGPJRkT6xUP4NJDo4Ej2tuxvUGBecOcw2nKBU');

async function testFilter() {
  const { data, error } = await supabase
    .from('clients')
    .select('name')
    .ilike('name', 'Stress Test Client 2')
    .limit(10);
  console.log("Results for Stress Test Client 2:", data);
}

testFilter();
