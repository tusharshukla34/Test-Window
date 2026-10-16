import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, signToken, verifyToken } from '../src/lib/auth';

describe('Authentication & Password Security', () => {
  it('hashes passwords using bcrypt with salt and verifies successfully', async () => {
    const rawPass = 'TrainerSecret@2026';
    const hash = await hashPassword(rawPass);

    expect(hash).not.toBe(rawPass);
    expect(hash.startsWith('$2a$') || hash.startsWith('$2b$')).toBe(true);

    const match = await verifyPassword(rawPass, hash);
    expect(match).toBe(true);

    const wrongMatch = await verifyPassword('WrongPassword', hash);
    expect(wrongMatch).toBe(false);
  });

  it('signs and verifies session tokens securely', async () => {
    const payload = {
      userId: 'usr-admin-tushar',
      role: 'admin' as const,
      email: 'tushar@portal.edu',
      name: 'Tushar Shukla',
      studentId: null
    };

    const token = await signToken(payload);
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(20);

    const verified = await verifyToken(token);
    expect(verified).not.toBeNull();
    expect(verified?.userId).toBe(payload.userId);
    expect(verified?.role).toBe('admin');
  });
});
