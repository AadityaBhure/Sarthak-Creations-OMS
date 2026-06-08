import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseClient';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { logActivity } from '@/lib/logger';

export async function GET() {
  try {
    const supabase = createServerClient();
    let allData = [];
    let page = 0;
    const limit = 1000;

    while (true) {
      const { data, error } = await supabase
        .from('product_types')
        .select('*')
        .order('name', { ascending: true })
        .range(page * limit, (page + 1) * limit - 1);

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
    const { name } = await request.json();

    if (!name || name.trim() === '') {
      return NextResponse.json({ error: 'Product type is required.' }, { status: 400 });
    }

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('product_types')
      .insert([{ name: name.trim() }])
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'A product type with this name already exists.' }, { status: 400 });
      }
      throw error;
    }

    const cookieStore = await cookies();
    const token = cookieStore.get('session')?.value;
    const payload = token ? await verifyToken(token) : null;
    if (payload?.userId) {
      await logActivity({
        userId: payload.userId,
        username: payload.username,
        action: 'CREATE',
        module: 'Product Types',
        recordId: data.id,
        details: { 'Product Type': data.name }
      });
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
