// Next.js can build request.url from its bind address (for example 0.0.0.0).
// Host identifies the address the browser actually requested, including its port.
export function hasAllowedOrigin(request) {
  if (request.method === 'GET') return true;
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try {
    const target = new URL(request.url);
    const host = request.headers.get('host');
    const expected = host ? new URL(`${target.protocol}//${host}`).origin : target.origin;
    return new URL(origin).origin === expected && origin !== 'null';
  } catch {
    return false;
  }
}
