import 'dotenv/config';
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const configuredSecret = process.env.JWT_SECRET;
if (process.env.NODE_ENV === 'production' && (!configuredSecret || configuredSecret.length < 32)) {
  throw new Error('Set JWT_SECRET to a random value of at least 32 characters in production.');
}
const JWT_SECRET = configuredSecret || 'knowbridge-development-only-secret';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

export function generateToken(user: { id: string; email: string; name: string; role: string }): string {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. Provide a valid bearer token.' });
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) {
    return res.status(401).json({ error: 'Authentication required. Provide a valid bearer token.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthenticatedUser;
    (req as any).user = decoded;
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}
