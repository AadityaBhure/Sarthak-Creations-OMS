import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseClient';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { logActivity } from '@/lib/logger';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const clientIdFilter = searchParams.get('client_id');

    const supabase = createServerClient();
    let allData = [];
    let page = 0;
    const limit = 1000;

    while (true) {
      let query = supabase
        .from('product_names')
        .select('*, clients(name)')
        .order('name', { ascending: true })
        .range(page * limit, (page + 1) * limit - 1);

      if (clientIdFilter === 'none') {
        query = query.is('client_id', null);
      } else if (clientIdFilter) {
        query = query.eq('client_id', clientIdFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      allData = allData.concat(data);
      if (data.length < limit) break;
      page++;
    }

    return NextResponse.json(allData);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { name, client_id } = await request.json();

    if (!name || name.trim() === '') {
      return NextResponse.json({ error: 'Product list name is required.' }, { status: 400 });
    }

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('product_names')
      .insert([{ name: name.trim(), client_id: client_id || null }])
      .select('*, clients(name)')
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'A product with this name already exists.' }, { status: 400 });
      }
      throw error;
    }

    const cookieStore = await cookies();
    const token = cookieStore.get('session')?.value;
    const payload = token ? await verifyToken(token) : null;
    if (payload && (payload.userId || payload.role === 'admin')) {
      await logActivity({
        userId: payload.userId || null,
        username: payload.username || 'Admin',
        action: 'CREATE',
        module: 'Product Lists',
        recordId: data.id,
        details: { 'Product List': data.name }
      });
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
