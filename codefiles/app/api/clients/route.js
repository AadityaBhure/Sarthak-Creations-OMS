import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseClient';

export async function GET() {
  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { name, address } = await request.json();

    if (!name || name.trim() === '') {
      return NextResponse.json({ error: 'Client name is required.' }, { status: 400 });
    }

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('clients')
      .insert([{ name: name.trim(), address: address ? address.trim() : null }])
      .select()
      .single();

    if (error) {
      if (error.code === '23505') { // Postgres unique violation
        return NextResponse.json({ error: 'A client with this name already exists.' }, { status: 400 });
      }
      throw error;
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
