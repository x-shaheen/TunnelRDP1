import NextAuth from "next-auth"

declare module "next-auth" {
  interface Session {
    accessToken?: string
    supabaseUserId?: string
  }

  interface JWT {
    accessToken?: string
    supabaseUserId?: string
  }
}
