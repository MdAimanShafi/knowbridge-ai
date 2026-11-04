import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db.ts';
import { generateToken, authMiddleware } from '../auth.ts';

export const authRoutes = Router();

// Register new user
authRoutes.post('/register', async (req: Request, res: Response) => {
  const { email, name, title, password } = req.body || {};
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  const normalizedName = typeof name === 'string' ? name.trim() : '';

  if (!normalizedEmail || typeof password !== 'string' || !normalizedName) {
    return res.status(400).json({ error: 'Email, name, and password are required.' });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) || normalizedEmail.length > 254) {
    return res.status(400).json({ error: 'Provide a valid email address.' });
  }
  if (normalizedName.length > 100) {
    return res.status(400).json({ error: 'Name must be 100 characters or fewer.' });
  }
  if (password.length < 8 || password.length > 128) {
    return res.status(400).json({ error: 'Password must be between 8 and 128 characters.' });
  }

  const existing = await db.findUserByEmail(normalizedEmail);
  if (existing) {
    return res.status(409).json({ error: 'An account with this email already exists.' });
  }

  const user = await db.createUser({
    email: normalizedEmail,
    name: normalizedName,
    title: typeof title === 'string' && title.trim() ? title.trim().slice(0, 100) : 'Project Member',
    password,
    role: 'MEMBER',
  });

  const token = generateToken(user);

  await db.logActivity({
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
authRoutes.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body || {};
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

  if (!normalizedEmail || typeof password !== 'string' || !password || password.length > 128) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const userWithHash = await db.findUserByEmail(normalizedEmail);
  if (!userWithHash) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const isMatch = bcrypt.compareSync(password, userWithHash.passwordHash);
  if (!isMatch) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const { passwordHash: _, ...safeUser } = userWithHash;
  const token = generateToken(safeUser);

  await db.logActivity({
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
authRoutes.post('/demo-login', async (req: Request, res: Response) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'Demo sign-in is unavailable in production.' });
  }

  const demoUsers = {
    alex: 'demo@knowbridge.ai',
    sarah: 'sarah.lin@phoenix-retail.com',
    marcus: 'marcus.vance@phoenix-retail.com',
  } as const;
  const role = req.body?.role;
  const targetEmail =
    role === 'sarah' ? demoUsers.sarah : role === 'marcus' ? demoUsers.marcus : demoUsers.alex;

  const userWithHash = await db.findUserByEmail(targetEmail);
  if (!userWithHash) {
    return res.status(404).json({ error: 'Demo user account not found.' });
  }

  const { passwordHash: _, ...safeUser } = userWithHash;
  const token = generateToken(safeUser);

  await db.logActivity({
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
authRoutes.get('/me', authMiddleware, async (req: Request, res: Response) => {
  const authed = (req as any).user;
  const user = await db.findUserById(authed.id);
  if (!user) {
    return res.status(404).json({ error: 'User profile not found.' });
  }
  res.json({ user });
});
