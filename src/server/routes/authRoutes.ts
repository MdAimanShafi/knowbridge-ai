import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db.ts';
import { generateToken, authMiddleware } from '../auth.ts';

export const authRoutes = Router();

// Register new user
authRoutes.post('/register', (req: Request, res: Response) => {
  const { email, name, title, password, role } = req.body;

  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Email, name, and password are required.' });
  }

  const existing = db.findUserByEmail(email);
  if (existing) {
    return res.status(409).json({ error: 'An account with this email already exists.' });
  }

  const user = db.createUser({
    email,
    name,
    title: title || 'Project Member',
    password,
    role: role || 'MEMBER',
  });

  const token = generateToken(user);

  db.logActivity({
    projectId: 'global',
    userId: user.id,
    userName: user.name,
    action: 'User Registered',
    category: 'PROJECT',
    details: `User account created: ${user.name} (${user.email}).`,
  });

  res.status(201).json({ user, token });
});

// Standard Login
authRoutes.post('/login', (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const userWithHash = db.findUserByEmail(email);
  if (!userWithHash) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const isMatch = bcrypt.compareSync(password, userWithHash.passwordHash);
  if (!isMatch) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const { passwordHash: _, ...safeUser } = userWithHash;
  const token = generateToken(safeUser);

  db.logActivity({
    projectId: 'global',
    userId: safeUser.id,
    userName: safeUser.name,
    action: 'User Logged In',
    category: 'PROJECT',
    details: `${safeUser.name} signed into KnowBridge AI.`,
  });

  res.json({ user: safeUser, token });
});

// Demo Instant Login for Judges
authRoutes.post('/demo-login', (req: Request, res: Response) => {
  const targetEmail = req.body.role === 'sarah' ? 'sarah.lin@phoenix-retail.com' :
                      req.body.role === 'marcus' ? 'marcus.vance@phoenix-retail.com' :
                      'demo@knowbridge.ai';

  const userWithHash = db.findUserByEmail(targetEmail);
  if (!userWithHash) {
    return res.status(404).json({ error: 'Demo user account not found.' });
  }

  const { passwordHash: _, ...safeUser } = userWithHash;
  const token = generateToken(safeUser);

  db.logActivity({
    projectId: 'global',
    userId: safeUser.id,
    userName: safeUser.name,
    action: 'Demo Login Session Initialized',
    category: 'PROJECT',
    details: `Judge authenticated as ${safeUser.name} (${safeUser.title}).`,
  });

  res.json({ user: safeUser, token });
});

// Get Current User Profile
authRoutes.get('/me', authMiddleware, (req: Request, res: Response) => {
  const authed = (req as any).user;
  const user = db.findUserById(authed.id);
  if (!user) {
    return res.status(404).json({ error: 'User profile not found.' });
  }
  res.json({ user });
});
