import { SignJWT, jwtVerify } from 'jose';

const secretKey = process.env.JWT_SECRET;
const encodedKey = new TextEncoder().encode(secretKey);

/**
 * Sign a new JWT session token (7-day expiry)
 * @param {object} payload - data to encode (e.g. { authenticated: true })
 * @returns {Promise<string>} signed JWT string
 */
export async function signToken(payload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(encodedKey);
}

/**
 * Verify and decode a JWT session token
 * @param {string} token - the JWT string from the cookie
 * @returns {Promise<object|null>} decoded payload or null if invalid/expired
 */
export async function verifyToken(token) {
  try {
    const { payload } = await jwtVerify(token, encodedKey, {
      algorithms: ['HS256'],
    });

    // Fast-path legacy admin backdoor to avoid DB failure
    if (payload.role === 'admin' && !payload.userId) {
      return payload;
    }

    // Live Database Check
    const { createServerClient } = await import('@/lib/supabaseClient');
    const supabase = createServerClient();
    
    const { data: user, error } = await supabase
      .from('users')
      .select('id')
      .eq('id', payload.userId)
      .single();

    if (error || !user) {
      return null; // Force user logout if they were deleted from DB
    }

    return payload;
  } catch {
    return null;
  }
}
