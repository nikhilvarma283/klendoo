import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';

const ADMIN_CREDENTIALS = {
  email: process.env.ADMIN_EMAIL || 'nikhil@decentralthink.com',
  password: process.env.ADMIN_PASSWORD || 'admin_secure_password_123',
};

const JWT_SECRET = process.env.JWT_SECRET || 'klendoo_admin_secret_key';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, password } = req.body;

  // Validate credentials
  if (email === ADMIN_CREDENTIALS.email && password === ADMIN_CREDENTIALS.password) {
    // Generate JWT token
    const token = jwt.sign(
      { email, role: 'super_admin', iat: Math.floor(Date.now() / 1000) },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    console.log(`[Admin] Login successful: ${email}`);

    return res.status(200).json({ token, email });
  }

  console.warn(`[Admin] Failed login attempt: ${email}`);
  return res.status(401).json({ error: 'Invalid credentials' });
}
