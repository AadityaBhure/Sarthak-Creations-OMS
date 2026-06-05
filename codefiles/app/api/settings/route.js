import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseClient';

export async function GET() {
  try {
    const supabase = createServerClient();

    const { data, error } = await supabase
      .from('global_settings')
      .select('*')
      .eq('id', 'default')
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const body = await req.json();
    const supabase = createServerClient();

    const { error } = await supabase
      .from('global_settings')
      .update(body)
      .eq('id', 'default');

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
