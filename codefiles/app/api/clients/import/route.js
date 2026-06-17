import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseClient';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { logActivity } from '@/lib/logger';

const BATCH_SIZE = 200;

export async function POST(request) {
  try {
    const { rows } = await request.json();

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'No data provided.' }, { status: 400 });
    }

    // Clean data
    const cleanedRows = rows.map(row => ({
      name: row.name ? String(row.name).trim() : '',
      contact_person: row.contact_person ? String(row.contact_person).trim() : null,
      phone_number: row.phone_number ? String(row.phone_number).trim() : null
    }));

    const supabase = createServerClient();

    const cookieStore = await cookies();
    const token = cookieStore.get('session')?.value;
    const payload = token ? await verifyToken(token) : null;
    const loggerUser = payload && (payload.userId || payload.role === 'admin') ? {
      userId: payload.userId || null,
      username: payload.username || 'Admin'
    } : null;

    // Fetch existing clients to check for duplicates
    const { data: existingClients, error: existingError } = await supabase
      .from('clients')
      .select('name');
    
    if (existingError) throw existingError;

    const existingSet = new Set(existingClients.map(c => c.name.toLowerCase()));

    const recordsToInsert = [];
    const skippedRows = [];
    const insertedRows = [];

    cleanedRows.forEach(row => {
      if (!row.name) {
        skippedRows.push({ ...row, reason: 'Missing name' });
        return;
      }

      const nameLower = row.name.toLowerCase();
      
      if (!existingSet.has(nameLower)) {
        recordsToInsert.push(row);
        existingSet.add(nameLower); // prevent duplicates within the same import file
      } else {
        skippedRows.push({ ...row, reason: 'Duplicate client name' });
      }
    });

    let totalInserted = 0;
    if (recordsToInsert.length > 0) {
      for (let i = 0; i < recordsToInsert.length; i += BATCH_SIZE) {
        const batch = recordsToInsert.slice(i, i + BATCH_SIZE);
        const { data, error } = await supabase
          .from('clients')
          .insert(batch)
          .select();

        if (error) throw error;
        if (data) {
          totalInserted += data.length;
          insertedRows.push(...data);
        }
      }
    }

    if (loggerUser && insertedRows.length > 0) {
      for (const row of insertedRows) {
        await logActivity({
          userId: loggerUser.userId,
          username: loggerUser.username,
          action: 'CREATE',
          module: 'Client List',
          recordId: row.id,
          details: { name: row.name, contact_person: row.contact_person, phone_number: row.phone_number }
        });
      }
    }

    return NextResponse.json({
      success: true,
      inserted: totalInserted,
      skipped: skippedRows.length,
      insertedRows: insertedRows,
      skippedRows: skippedRows
    });

  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
