import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'klendoo_admin_secret_key';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const token = req.headers.authorization?.split('Bearer ')[1] || req.cookies.adminToken;

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;

    if (decoded.role !== 'super_admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    return res.status(200).json({ authenticated: true, email: decoded.email });
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}
