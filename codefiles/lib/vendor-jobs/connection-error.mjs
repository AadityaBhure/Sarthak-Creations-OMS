export function connectionError(error) {
  const detail = [error?.message, error?.details, error?.cause?.code].filter(Boolean).join(' ');
  if (/ENOTFOUND|EAI_AGAIN/.test(detail)) return 'Cannot reach the database: the Supabase address could not be resolved. Check your internet or DNS connection, then retry.';
  if (/fetch failed|ECONNRESET|ECONNREFUSED|ETIMEDOUT|TimeoutError|AbortError|UND_ERR_CONNECT_TIMEOUT/i.test(detail)) return 'The database connection failed or timed out. Check your connection, then retry.';
  return null;
}
