import express from 'express';
import { body, validationResult } from 'express-validator';
import { query } from '../db/index.js';
import {
  hashPassword,
  comparePassword,
  generateToken,
  authMiddleware,
  getUserById,
  getUserByEmail,
} from '../middleware/auth.js';

const router = express.Router();

/**
 * Register a new user
 */
router.post(
  '/register',
  [
    body('email').isEmail(),
    body('password').isLength({ min: 6 }),
    body('name').notEmpty(),
    body('role').isIn(['customer', 'organiser', 'admin']),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password, name, role } = req.body;

      // Check if user exists
      const existing = await getUserByEmail(email);
      if (existing) {
        return res.status(400).json({ error: 'Email already registered' });
      }

      // Hash password
      const passwordHash = await hashPassword(password);

      // Create user
      const result = await query(
        `INSERT INTO users (email, password_hash, name, role)
         VALUES ($1, $2, $3, $4)
         RETURNING id, email, name, role`,
        [email, passwordHash, name, role]
      );

      const user = result.rows[0];
      const token = generateToken(user.id, user.role);

      res.status(201).json({
        user,
        token,
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ error: 'Registration failed' });
    }
  }
);

/**
 * Login
 */
router.post(
  '/login',
  [body('email').isEmail(), body('password').notEmpty()],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password } = req.body;

      // Find user
      const user = await getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Check password
      const validPassword = await comparePassword(password, user.password_hash);
      if (!validPassword) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Generate token
      const token = generateToken(user.id, user.role);

      res.json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
        token,
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Login failed' });
    }
  }
);

/**
 * Get current user profile
 */
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const user = await getUserById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

export default router;
