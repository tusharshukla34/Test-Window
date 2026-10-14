import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { UserProfile, UserRole } from './db/types';

const JWT_SECRET = new TextEncoder().encode(
  process.env.AUTH_SECRET || 'tushar-portal-secure-jwt-secret-key-32-chars-long-minimum-2026'
);

export const COOKIE_NAME = 'portal_session_token';

export interface SessionPayload {
  userId: string;
  role: UserRole;
  email: string;
  studentId?: string | null;
  name: string;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function signToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return {
      userId: payload.userId as string,
      role: payload.role as UserRole,
      email: payload.email as string,
      studentId: (payload.studentId as string) || null,
      name: payload.name as string,
    };
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function requireAuth(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) {
    throw new Error('Unauthorized');
  }
  return session;
}

export async function requireAdmin(): Promise<SessionPayload> {
  const session = await requireAuth();
  if (session.role !== 'admin') {
    throw new Error('Forbidden: Trainer Administrator access required');
  }
  return session;
}

export async function requireStudent(): Promise<SessionPayload> {
  const session = await requireAuth();
  if (session.role !== 'student') {
    throw new Error('Forbidden: Student access required');
  }
  return session;
}

export async function getSessionUser() {
  const session = await getSession();
  if (!session) return null;
  return {
    id: session.userId,
    role: session.role,
    email: session.email,
    name: session.name,
    student_id: session.studentId
  };
}
