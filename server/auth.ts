import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { getDb, hashPassword, verifyPassword, THOOTHUKUDI_TALUKS, TalukName } from './db.ts';

export type UserRole = 'Taluk Admin' | 'District Admin';

export interface UserAccount {
  user_id: string;
  username: string;
  designation: string;
  role: UserRole;
  assigned_taluk: string;
  active_status: string;
  id: string; // alias for user_id
  taluk: string; // alias for assigned_taluk
}

export interface UserRecordWithCredentials extends UserAccount {
  password_hash: string;
  password_salt: string;
  alt_password_hash?: string | null;
}

export function getUserByUsernameOrId(identifier: string): UserRecordWithCredentials | null {
  const db = getDb();
  const trimmed = identifier.trim().toLowerCase();

  // Support both tahsildar01 and tahsildar1 formats
  const normalizedUsername = trimmed.replace(/^tahsildar([1-9])$/, 'tahsildar0$1');
  const normalizedAlt = trimmed.replace(/^tahsildar0([1-9])$/, 'tahsildar$1');

  // Try matching user_id (case insensitive) or username (case insensitive)
  const row = db.prepare(`
    SELECT user_id, username, designation, role, assigned_taluk, active_status, password_hash, password_salt, alt_password_hash
    FROM users
    WHERE LOWER(user_id) = ? OR LOWER(username) = ? OR LOWER(username) = ? OR LOWER(username) = ?
  `).get(trimmed, trimmed, normalizedUsername, normalizedAlt) as any;

  if (!row) {
    if (trimmed.includes('collector') || trimmed === 'districtadmin') {
      return getUserByUsernameOrId('districtadmin');
    }
    for (let i = 0; i < THOOTHUKUDI_TALUKS.length; i++) {
      const t = THOOTHUKUDI_TALUKS[i].toLowerCase();
      if (trimmed.includes(t)) {
        return getUserByUsernameOrId(`U00${i + 1}`.slice(-4));
      }
    }
    return null;
  }

  return {
    user_id: row.user_id,
    username: row.username,
    designation: row.designation,
    role: row.role as UserRole,
    assigned_taluk: row.assigned_taluk,
    active_status: row.active_status,
    id: row.user_id,
    taluk: row.assigned_taluk,
    password_hash: row.password_hash,
    password_salt: row.password_salt,
    alt_password_hash: row.alt_password_hash
  };
}

export function getAllUsers(): UserAccount[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT user_id, username, designation, role, assigned_taluk, active_status
    FROM users
    ORDER BY user_id ASC
  `).all() as any[];

  return rows.map(row => ({
    user_id: row.user_id,
    username: row.username,
    designation: row.designation,
    role: row.role as UserRole,
    assigned_taluk: row.assigned_taluk,
    active_status: row.active_status,
    id: row.user_id,
    taluk: row.assigned_taluk
  }));
}

export function resetPassword(userId: string, newPlainPassword: string): boolean {
  const db = getDb();
  const { hash, salt } = hashPassword(newPlainPassword);
  const result = db.prepare(`
    UPDATE users
    SET password_hash = ?, password_salt = ?, alt_password_hash = NULL, updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ?
  `).run(hash, salt, userId);

  return result.changes > 0;
}

export function updateStatus(userId: string, status: 'Active' | 'Inactive'): boolean {
  const db = getDb();
  const result = db.prepare(`
    UPDATE users
    SET active_status = ?, updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ?
  `).run(status, userId);

  return result.changes > 0;
}

// In-Memory Token Sessions (Ephemeral, stateless across reboots, zero sensitive data on disk)
interface SessionData {
  user: UserAccount;
  createdAt: number;
}

const activeSessions = new Map<string, SessionData>();

export function createSession(user: UserAccount): string {
  const token = crypto.randomBytes(32).toString('hex');
  activeSessions.set(token, {
    user,
    createdAt: Date.now()
  });
  return token;
}

export function getSession(token: string): UserAccount | null {
  const session = activeSessions.get(token);
  if (!session) return null;

  // Session timeout: 24 hours
  if (Date.now() - session.createdAt > 24 * 60 * 60 * 1000) {
    activeSessions.delete(token);
    return null;
  }

  return session.user;
}

export function removeSession(token: string): void {
  activeSessions.delete(token);
}

export interface AuthenticatedRequest extends Request {
  user?: UserAccount;
}

export function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. Please sign in.' });
  }

  const token = authHeader.split(' ')[1];
  const user = getSession(token);
  if (!user) {
    return res.status(401).json({ error: 'Session expired or invalid. Please sign in again.' });
  }

  req.user = user;
  next();
}

/**
 * Middleware: Enforces that Tahsildars can ONLY query or mutate records from their assigned Taluk.
 */
export function enforceTalukScope(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const user = req.user;
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // District Admin has district-wide access
  if (user.role === 'District Admin' || user.assigned_taluk === 'All Taluks') {
    return next();
  }

  // Tahsildar check
  const requestedTaluk = req.params.taluk || req.query.taluk;
  if (requestedTaluk && typeof requestedTaluk === 'string' && requestedTaluk !== 'ALL') {
    if (requestedTaluk.toLowerCase() !== user.assigned_taluk.toLowerCase()) {
      return res.status(403).json({
        error: `Access Denied: You are only authorized to manage ${user.assigned_taluk} Taluk.`
      });
    }
  }

  next();
}
