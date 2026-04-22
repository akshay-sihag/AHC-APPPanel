import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { prisma } from './prisma';
import bcrypt from 'bcryptjs';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        secretToken: { label: 'Secret Token', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        // Find user with their secret tokens
        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase().trim() },
          include: {
            secretTokens: {
              where: {
                isLoginToken: true,
                isActive: true,
              },
            },
          },
        });

        if (!user || !user.isActive) {
          return null;
        }

        // Verify password
        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.password
        );

        if (!isPasswordValid) {
          return null;
        }

        // Check if secret token is required for login
        if (user.secretTokens.length > 0) {
          if (!credentials.secretToken) {
            throw new Error('Secret token is required for login');
          }

          // Verify the secret token against all active login tokens
          let tokenValid = false;
          for (const token of user.secretTokens) {
            const isValid = await bcrypt.compare(credentials.secretToken, token.token);
            if (isValid) {
              tokenValid = true;
              // Update last used
              await prisma.secretToken.update({
                where: { id: token.id },
                data: { lastUsed: new Date() },
              });
              break;
            }
          }

          if (!tokenValid) {
            throw new Error('Invalid secret token');
          }
        }

        // Update login tracking (IP will be set from request context if available)
        const clientIp = 'unknown'; // IP tracking can be added via request context if needed

        await prisma.user.update({
          where: { id: user.id },
          data: {
            lastLoginAt: new Date(),
            lastLoginIp: clientIp,
            currentIp: clientIp,
            loginCount: user.loginCount + 1,
            lastActivityAt: new Date(),
          },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // Initial sign in
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
        token.email = user.email;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token) {
        (session.user as any).id = token.id as string;
        (session.user as any).role = token.role as string;
        if (token.email) {
          session.user.email = token.email as string;
        }
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 7 * 24 * 60 * 60, // 7 days
  },
  secret: process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET,
  debug: process.env.NODE_ENV === 'development',
};

