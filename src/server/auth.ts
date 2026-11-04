import 'dotenv/config';
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db } from './db.ts';

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

export type AuthenticatedRequest = Request & { user?: AuthenticatedUser };

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

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. Provide a valid bearer token.' });
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) {
    return res.status(401).json({ error: 'Authentication required. Provide a valid bearer token.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (
      typeof decoded === 'string' ||
      typeof decoded.id !== 'string' ||
      typeof decoded.email !== 'string' ||
      typeof decoded.name !== 'string' ||
      typeof decoded.role !== 'string'
    ) {
      return res.status(401).json({ error: 'Invalid or expired token.' });
    }
    const storedUser = await db.findUserById(decoded.id);
    if (!storedUser) {
      return res.status(401).json({ error: 'Invalid or expired token.' });
    }
    (req as AuthenticatedRequest).user = {
      id: decoded.id,
      email: storedUser.email,
      name: storedUser.name,
      role: storedUser.role,
    };
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}
