import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'nikhil@decentralthink.com';
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin_secure_password_123';
  const JWT_SECRET = process.env.JWT_SECRET || 'klendoo_admin_secret_key';

  const { email, password } = req.body;

  if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
    const token = jwt.sign(
      { email, role: 'super_admin', iat: Math.floor(Date.now() / 1000) },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    const maxAge = 60 * 60 * 24;
    res.setHeader(
      'Set-Cookie',
      `adminToken=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`
    );

    console.log(`[Admin] Login successful: ${email}`);

    return res.status(200).json({ token, email });
  }

  console.warn(`[Admin] Failed login attempt: ${email}`);
  return res.status(401).json({ error: 'Invalid credentials' });
}
