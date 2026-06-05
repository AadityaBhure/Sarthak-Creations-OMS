import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import JSZip from 'jszip';
import Papa from 'papaparse';

export const dynamic = 'force-dynamic'; // Prevent static caching

export async function GET() {
  try {
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          get(name) { return cookieStore.get(name)?.value; },
        },
      }
    );

    // Fetch all records from the database
    const [ordersRes, completedRes, clientsRes, productsRes, typesRes] = await Promise.all([
      supabase.from('orders').select('*'),
      supabase.from('completed_orders').select('*'),
      supabase.from('clients').select('*'),
      supabase.from('product_names').select('*'),
      supabase.from('product_types').select('*')
    ]);

    const zip = new JSZip();
    
    if (ordersRes.data) zip.file('active_orders.csv', Papa.unparse(ordersRes.data));
    if (completedRes.data) zip.file('completed_orders.csv', Papa.unparse(completedRes.data));
    if (clientsRes.data) zip.file('clients.csv', Papa.unparse(clientsRes.data));
    if (productsRes.data) zip.file('product_names.csv', Papa.unparse(productsRes.data));
    if (typesRes.data) zip.file('product_types.csv', Papa.unparse(typesRes.data));

    const content = await zip.generateAsync({ type: "nodebuffer" });

    return new NextResponse(content, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="oms_database_backup.zip"',
      },
    });

  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
