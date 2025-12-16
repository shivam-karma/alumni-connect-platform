// backend/src/routes/auth.js
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { isEmail, isStrongPassword } from '../utils/validators.js';
import User from '../models/User.js';
import { awardPoints } from '../services/pointsService.js';

const router = Router();

/**
 * POST /api/auth/register
 * Body: { name, email, password, department?, batch?, role? = 'Student',
 *         title?, company?, location?, skills?[], isMentor? }
 */
router.post('/register', async (req, res) => {
  try {
    const {
      name, email, password, department, batch, role = 'Student',
      title = '', company = '', location = '', skills = [], isMentor = false
    } = req.body;

    if (!name || !email || !password)
      return res.status(400).json({ message: 'Name, email, and password are required' });
    if (!isEmail(email)) return res.status(400).json({ message: 'Invalid email address' });
    if (!isStrongPassword(password))
      return res.status(400).json({ message: 'Password must be at least 6 characters long' });
    if (!['Student', 'Alumni'].includes(role))
      return res.status(400).json({ message: 'Role must be Student or Alumni' });

    const existing = await User.findOne({ email });
    if (existing)
      return res.status(409).json({ message: 'Email already registered' });

    const passwordHash = await bcrypt.hash(password, 10);
    const newUser = await User.create({
      name, email, passwordHash, department, batch, role,
      title, company, location, skills, isMentor
    });

    // ✅ Award signup points and first badge
    try {
      if (typeof awardPoints === 'function') {
        await awardPoints(newUser._id, 'signup', 50, {
          badge: {
            key: 'early_joiner',
            name: 'Early Joiner',
            description: 'Earned for joining AlumniConnect',
          }
        });
      } else {
        newUser.points = 50;
        newUser.badges = [{
          key: 'early_joiner',
          name: 'Early Joiner',
          description: 'Earned for joining AlumniConnect',
          awardedAt: new Date(),
        }];
        await newUser.save();
      }
    } catch (err) {
      console.warn('⚠️ Gamification signup award failed:', err);
    }

    res.status(201).json({ user: newUser.toSafeJSON() });
  } catch (err) {
    console.error('REGISTER ERROR:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * POST /api/auth/login
 * Body: { email, password }
 * Returns: { token, user }
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: 'Email and password are required' });

    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });

    const token = jwt.sign({ id: user._id.toString() }, process.env.JWT_SECRET, {
      expiresIn: '7d',
    });

    const cookieSecure = String(process.env.COOKIE_SECURE) === 'true';
    res.cookie('token', token, {
      httpOnly: true,
      secure: cookieSecure,
      sameSite: cookieSecure ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.json({ token, user: user.toSafeJSON() });
  } catch (err) {
    console.error('LOGIN ERROR:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * GET /api/auth/me
 * Header: Authorization: Bearer <token>  OR cookie 'token'
 */
router.get('/me', async (req, res) => {
  try {
    const header = req.headers.authorization;
    const bearer = header && header.startsWith('Bearer ') ? header.slice(7) : null;
    const token = req.cookies?.token || bearer;
    if (!token) return res.status(401).json({ message: 'Unauthorized' });

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    return res.json({ user: user.toSafeJSON() });
  } catch (err) {
    console.error('ME ERROR:', err);
    res.status(401).json({ message: 'Invalid or expired token' });
  }
});

export default router;
