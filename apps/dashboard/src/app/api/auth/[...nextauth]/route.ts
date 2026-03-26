import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { compare } from 'bcryptjs';

const handler = NextAuth({
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          throw new Error('Username and password required');
        }

        // For now, use environment variables for admin credentials
        // In production, you'd want to use a proper database
        const adminUsername = process.env.ADMIN_USERNAME || 'admin';
        const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;

        if (!adminPasswordHash) {
          throw new Error('Admin password not configured');
        }

        // Check username
        if (credentials.username !== adminUsername) {
          throw new Error('Invalid credentials');
        }

        // Check password
        const isPasswordValid = await compare(credentials.password, adminPasswordHash);
        
        if (!isPasswordValid) {
          throw new Error('Invalid credentials');
        }

        // Return user object
        return {
          id: '1',
          name: adminUsername,
          email: 'admin@chronos.local',
        };
      }
    })
  ],
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24 hours
  },
  jwt: {
    maxAge: 24 * 60 * 60, // 24 hours
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user = { ...session.user, id: token.id as string };
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
});

export { handler as GET, handler as POST };
