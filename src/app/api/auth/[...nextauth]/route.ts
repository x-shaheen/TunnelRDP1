import NextAuth from 'next-auth'
import GitHubProvider from 'next-auth/providers/github'
import { SupabaseService } from '@/services/SupabaseService'

const handler = NextAuth({
  providers: [
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: 'repo workflow user:email read:org admin:org'
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, account, profile }) {
      // Persist the OAuth access_token to the token right after signin
      if (account && profile) {
        token.accessToken = account.access_token

        // Create or update user in Supabase
        const supabaseService = SupabaseService.getInstance()
        const user = await supabaseService.createOrUpdateUser({
          id: (profile as any).id as string,
          email: (profile as any).email as string,
          login: (profile as any).login as string,
          avatar_url: (profile as any).avatar_url as string,
        })

        if (user) {
          token.supabaseUserId = user.id
        }
      }
      return token
    },
    async session({ session, token }) {
      // Send properties to the client
      session.accessToken = token.accessToken as string
      session.supabaseUserId = token.supabaseUserId as string
      return session
    },
  }
})

export { handler as GET, handler as POST }
