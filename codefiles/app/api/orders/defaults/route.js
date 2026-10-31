import { createServerClient } from '@/lib/supabaseClient';
import { numberingFailure } from '@/lib/order-numbering';

export async function GET() {
  const { data, error } = await createServerClient().rpc('oms_order_defaults');
  if (error) return numberingFailure(error);
  return Response.json(data, { headers: { 'Cache-Control': 'no-store' } });
}
