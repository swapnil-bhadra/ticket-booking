import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { query } from '../db/index.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

/**
 * Generate JWT token
 */
export function generateToken(userId, role) {
  return jwt.sign({ userId, role }, JWT_SECRET, { expiresIn: '7d' });
}

/**
 * Verify and decode JWT token
 */
export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    throw new Error('Invalid token');
  }
}

/**
 * Hash password
 */
export async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

/**
 * Compare password with hash
 */
export async function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

/**
 * Middleware to authenticate requests
 */
export function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid authorization header' });
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);
    
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

/**
 * Middleware to check role-based access
 */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}

/**
 * Get user by ID from database
 */
export async function getUserById(userId) {
  try {
    const result = await query('SELECT id, email, name, role FROM users WHERE id = $1', [userId]);
    return result.rows[0] || null;
  } catch (error) {
    throw error;
  }
}

/**
 * Get user by email from database
 */
export async function getUserByEmail(email) {
  try {
    const result = await query('SELECT * FROM users WHERE email = $1', [email]);
    return result.rows[0] || null;
  } catch (error) {
    throw error;
  }
}
