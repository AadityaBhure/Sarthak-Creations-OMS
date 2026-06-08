import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseClient';
import { hash } from 'bcryptjs';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { logActivity } from '@/lib/logger';

export async function GET() {
  try {
    const supabase = createServerClient();
    let allData = [];
    let page = 0;
    const limit = 1000;

    // Note: Do not fetch password_hash
    while (true) {
      const { data, error } = await supabase
        .from('users')
        .select('id, first_name, last_name, username, phone_number, role')
        .order('first_name', { ascending: true })
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
    const { first_name, last_name, phone_number, password } = await request.json();

    if (!first_name || !last_name || !phone_number || !password) {
      return NextResponse.json({ error: 'First Name, Last Name, Phone Number, and Password are required.' }, { status: 400 });
    }

    if (!/^\d{10}$/.test(phone_number)) {
      return NextResponse.json({ error: 'Phone number must be exactly 10 digits.' }, { status: 400 });
    }

    const username = (first_name.trim() + last_name.trim()).toLowerCase();
    const supabase = createServerClient();

    // Check if user exists
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .or(`username.eq.${username},phone_number.eq.${phone_number}`)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: 'An executive with this Name or Phone Number already exists.' }, { status: 400 });
    }

    const password_hash = await hash(password, 10);

    const { data, error } = await supabase
      .from('users')
      .insert([{ 
        first_name: first_name.trim(), 
        last_name: last_name.trim(),
        username,
        phone_number: phone_number.trim(),
        password_hash
      }])
      .select('id, first_name, last_name, username, phone_number, role')
      .single();

    if (error) {
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
        module: 'Executive List',
        recordId: data.id,
        details: { 
          'First Name': data.first_name, 
          'Last Name': data.last_name, 
          'Phone': data.phone_number, 
          'Role': data.role 
        }
      });
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
