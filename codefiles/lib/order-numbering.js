import { NextResponse } from 'next/server';

export function numberingFailure(error) {
  const codes = { P0002: 'DUPLICATE_ORDER_NUMBER', P0003: 'ORDER_NUMBER_CHANGED' };
  if (codes[error.code]) return NextResponse.json({ error: error.message, code: codes[error.code] }, { status: 409 });
  if (['PGRST202', '42703', 'PGRST204'].includes(error.code)) return NextResponse.json({ error: 'The numbering update is not installed. Run 20261028_order_numbering.sql in Supabase SQL Editor, then retry.', code: 'SETUP_REQUIRED' }, { status: 503 });
  return NextResponse.json({ error: error.code === 'P0001' ? error.message : 'Could not save this order. Check the fields and try again.' }, { status: 400 });
}

export function orderNumber(value, allowBlank = false) {
  if (value === null || value === '' || value === undefined) {
    if (allowBlank) return null;
    throw new Error('Enter an Order Number.');
  }
  if (!/^\d+$/.test(String(value)) || !Number.isSafeInteger(Number(value)) || Number(value) < 1 || Number(value) > Number.MAX_SAFE_INTEGER - 1) throw new Error('Order Number must be a positive whole number.');
  return Number(value);
}
