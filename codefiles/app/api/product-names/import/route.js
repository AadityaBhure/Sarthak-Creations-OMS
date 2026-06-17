import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseClient';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { logActivity } from '@/lib/logger';

const BATCH_SIZE = 200;

export async function POST(request) {
  try {
    const { rows, force } = await request.json();

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'No data provided.' }, { status: 400 });
    }

    const cleanedRows = rows.map(row => ({ 
      name: row.name ? row.name.trim() : '',
      client_name: row.client_name ? row.client_name.trim() : '',
      __original: row
    }));

    const supabase = createServerClient();

    const cookieStore = await cookies();
    const token = cookieStore.get('session')?.value;
    const payload = token ? await verifyToken(token) : null;
    const loggerUser = payload && (payload.userId || payload.role === 'admin') ? {
      userId: payload.userId || null,
      username: payload.username || 'Admin'
    } : null;

    // Fetch existing clients to map names to IDs
    const { data: clientsData, error: clientsError } = await supabase.from('clients').select('id, name');
    if (clientsError) throw clientsError;

    const clientMap = new Map(); // name -> id (lowercase for case-insensitive matching)
    clientsData.forEach(c => clientMap.set(c.name.toLowerCase(), c.id));

    // Identify unique new clients
    // Identify unique new clients
    const newClientNames = new Set();
    cleanedRows.forEach(row => {
      if (row.client_name && !clientMap.has(row.client_name.toLowerCase())) {
        newClientNames.add(row.client_name);
      }
    });

    // If there are unknown clients and we are not forcing the import
    if (newClientNames.size > 0 && !force) {
      const missingClients = Array.from(newClientNames);
      return NextResponse.json({
        requiresConfirmation: true,
        missingClients: missingClients,
        message: `One or more clients do not exist in the client list: ${missingClients.join(', ')}.`
      });
    }

    // Fetch existing product names to manually filter duplicates
    const { data: existingProducts, error: existingError } = await supabase
      .from('product_names')
      .select('name, client_id');
    
    if (existingError) throw existingError;

    // Create a set of existing "name|client_id" pairs
    const existingSet = new Set(
      existingProducts.map(p => `${p.name.toLowerCase()}|${p.client_id || 'null'}`)
    );

    // Prepare rows for insert into product_names
    const recordsToInsert = [];
    const skippedRows = [];
    let skippedCount = 0;

    cleanedRows.forEach(row => {
      if (!row.name) {
        skippedRows.push({ ...row, reason: 'Missing name' });
        skippedCount++;
        return;
      }

      const client_name_lower = row.client_name ? row.client_name.toLowerCase() : null;
      
      // If forcing and client is missing, skip the row
      if (client_name_lower && !clientMap.has(client_name_lower)) {
        skippedRows.push({ ...row, reason: 'Client not found' });
        skippedCount++;
        return;
      }

      const client_id = client_name_lower ? clientMap.get(client_name_lower) || null : null;
      const key = `${row.name.toLowerCase()}|${client_id || 'null'}`;
      
      if (!existingSet.has(key)) {
        recordsToInsert.push({
          name: row.name,
          client_id: client_id,
          original_client_name: row.client_name 
        });
        existingSet.add(key); 
      } else {
        skippedRows.push({ ...row, reason: 'Duplicate record' });
        skippedCount++;
      }
    });

    let totalInserted = 0;
    const insertedRecords = [];
    if (recordsToInsert.length > 0) {
      for (let i = 0; i < recordsToInsert.length; i += BATCH_SIZE) {
        // Strip original_client_name before DB insert
        const batch = recordsToInsert.slice(i, i + BATCH_SIZE).map(r => ({
          name: r.name,
          client_id: r.client_id
        }));
        
        const { data, error } = await supabase
          .from('product_names')
          .insert(batch)
          .select();

        if (error) throw error;
        if (data) {
          totalInserted += data.length;
          insertedRecords.push(...data);
        }
      }
    }

    if (loggerUser && insertedRecords.length > 0) {
      for (const row of insertedRecords) {
        await logActivity({
          userId: loggerUser.userId,
          username: loggerUser.username,
          action: 'CREATE',
          module: 'Product Names',
          recordId: row.id,
          details: { name: row.name, client_id: row.client_id }
        });
      }
    }

    return NextResponse.json({
      success: true,
      inserted: totalInserted,
      skipped: skippedCount,
      insertedRows: recordsToInsert.map(r => ({ name: r.name, client_name: r.original_client_name || '' })),
      skippedRows: skippedRows
    });

  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
