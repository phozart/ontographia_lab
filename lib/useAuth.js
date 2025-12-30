// lib/useAuth.js
// Authentication hook with status checking and route protection

import { useSession, signIn, signOut } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect } from 'react';

/**
 * Authentication hook that handles user status
 * @param {Object} options
 * @param {boolean} options.required - If true, redirects unauthenticated users
 * @param {boolean} options.requireActive - If true, requires status='active'
 * @param {boolean} options.requireAdmin - If true, requires role='admin'
 */
export function useAuth({
  required = false,
  requireActive = false,
  requireAdmin = false,
} = {}) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const loading = status === 'loading';

  useEffect(() => {
    if (loading) return;

    // Redirect to login if required and not authenticated
    if (required && !session) {
      router.push('/login');
      return;
    }

    // Redirect pending users to pending-approval page
    if (session && requireActive && session.user?.status === 'pending') {
      if (router.pathname !== '/pending-approval') {
        router.push('/pending-approval');
      }
      return;
    }

    // Redirect suspended users to a suspended page or login
    if (session && requireActive && session.user?.status === 'suspended') {
      router.push('/login?error=suspended');
      return;
    }

    // Redirect non-admins trying to access admin routes
    if (session && requireAdmin && session.user?.role !== 'admin') {
      router.push('/dashboard');
      return;
    }
  }, [loading, session, required, requireActive, requireAdmin, router]);

  return {
    session,
    user: session?.user,
    loading,
    isAuthenticated: !!session,
    isActive: session?.user?.status === 'active',
    isAdmin: session?.user?.role === 'admin',
    isPending: session?.user?.status === 'pending',
    signIn,
    signOut: () => signOut({ callbackUrl: '/' }),
  };
}

/**
 * Get user from server session for API routes
 */
export async function getServerUser(req, res) {
  const { getServerSession } = await import('next-auth/next');
  const { authOptions } = await import('../pages/api/auth/[...nextauth]');

  const session = await getServerSession(req, res, authOptions);

  if (!session?.user) {
    return null;
  }

  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    role: session.user.role || 'user',
    status: session.user.status || 'pending',
  };
}

/**
 * Require authentication for an API route
 */
export async function requireAuth(req, res) {
  const user = await getServerUser(req, res);

  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }

  return user;
}

/**
 * Require active status for an API route
 */
export async function requireActiveUser(req, res) {
  const user = await requireAuth(req, res);
  if (!user) return null;

  if (user.status !== 'active') {
    res.status(403).json({ error: 'Account not activated' });
    return null;
  }

  return user;
}

/**
 * Require admin role for an API route
 */
export async function requireAdmin(req, res) {
  const user = await requireActiveUser(req, res);
  if (!user) return null;

  if (user.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return null;
  }

  return user;
}
