import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseClient';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { logActivity } from '@/lib/logger';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const module = searchParams.get('module');

    const supabase = createServerClient();
    let query = supabase.from('quick_views').select('*').order('name', { ascending: true });
    
    if (module) {
      query = query.eq('module', module);
    }

    const { data, error } = await query;
    if (error) throw error;
    
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { name, module, filters } = await request.json();

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('quick_views')
      .insert([{ name: name.trim(), module: module || 'orders', filters: filters || [] }])
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'A quick view with this name already exists.' }, { status: 400 });
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
        module: 'Manage Views',
        recordId: data.id,
        details: { 'View Name': data.name, 'Module Applied To': data.module }
      });
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
