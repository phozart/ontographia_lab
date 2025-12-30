// pages/api/auth/[...nextauth].js
// NextAuth.js configuration for OAuth and Email/Password authentication

import NextAuth from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import GitHubProvider from 'next-auth/providers/github';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { query } from '../../../lib/db';
import { authLimiter } from '../../../lib/rateLimit';

export const authOptions = {
  providers: [
    // Email/Password authentication
    CredentialsProvider({
      id: 'credentials',
      name: 'Email',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email and password are required');
        }

        try {
          // Find user by email
          const result = await query(
            'SELECT id, email, name, image, password_hash, role, status FROM users WHERE email = $1',
            [credentials.email.toLowerCase()]
          );

          if (result.rows.length === 0) {
            throw new Error('No account found with this email');
          }

          const user = result.rows[0];

          // Check if user has a password (email/password account)
          if (!user.password_hash) {
            throw new Error('Please sign in with Google or GitHub');
          }

          // Verify password
          const isValid = await bcrypt.compare(credentials.password, user.password_hash);
          if (!isValid) {
            throw new Error('Invalid password');
          }

          // Update last login
          await query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

          // Return user object (will be passed to JWT callback)
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            image: user.image,
          };
        } catch (error) {
          console.error('Credentials auth error:', error.message);
          throw error;
        }
      },
    }),

    // OAuth providers
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
    }),
  ],

  callbacks: {
    async signIn({ user, account }) {
      try {
        // For credentials provider, user already exists (created during signup)
        // Just allow sign in - last_login is updated in authorize()
        if (account.provider === 'credentials') {
          return true;
        }

        // For OAuth providers, check if user exists
        const existing = await query(
          'SELECT id, role, status FROM users WHERE email = $1',
          [user.email]
        );

        if (existing.rows.length > 0) {
          // Update last login and profile info from OAuth
          await query(
            'UPDATE users SET last_login = NOW(), name = $1, image = $2 WHERE email = $3',
            [user.name, user.image, user.email]
          );
        } else {
          // Create new user from OAuth
          // Check if this is the admin email (auto-approve)
          const isAdmin = user.email === process.env.ADMIN_EMAIL;

          await query(
            `INSERT INTO users (email, name, image, provider, provider_id, role, status, approved_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
              user.email,
              user.name,
              user.image,
              account.provider,
              account.providerAccountId,
              isAdmin ? 'admin' : 'user',
              isAdmin ? 'active' : 'pending',
              isAdmin ? new Date().toISOString() : null,
            ]
          );
        }

        return true;
      } catch (error) {
        console.error('Error in signIn callback:', error);
        return true; // Still allow sign in, but log the error
      }
    },

    async session({ session, token }) {
      // Fetch user data from database
      try {
        const result = await query(
          'SELECT id, role, status, subscription_tier FROM users WHERE email = $1',
          [session.user.email]
        );

        if (result.rows.length > 0) {
          const dbUser = result.rows[0];
          session.user.id = dbUser.id;
          session.user.role = dbUser.role;
          session.user.status = dbUser.status;
          session.user.subscriptionTier = dbUser.subscription_tier;
        }
      } catch (error) {
        console.error('Error fetching user in session callback:', error);
      }

      return session;
    },

    async jwt({ token, user, account }) {
      if (account && user) {
        token.accessToken = account.access_token;
        token.provider = account.provider;
      }
      return token;
    },
  },

  pages: {
    signIn: '/login',
    error: '/login',
  },

  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  secret: process.env.NEXTAUTH_SECRET,
};

// Wrap NextAuth with rate limiting for sign-in attempts
const nextAuthHandler = NextAuth(authOptions);

export default async function handler(req, res) {
  // Apply rate limiting only to credential sign-in attempts (POST to callback/credentials)
  const isCredentialSignIn =
    req.method === 'POST' &&
    req.url?.includes('callback/credentials');

  if (isCredentialSignIn) {
    const { success } = await authLimiter.check(req, res);
    if (!success) return;
  }

  return nextAuthHandler(req, res);
}
