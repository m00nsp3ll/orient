import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "./prisma"
import bcrypt from "bcryptjs"

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as NextAuthOptions["adapter"],
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        username: { label: "Kullanıcı Adı", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          throw new Error("Kullanıcı adı ve şifre gerekli")
        }

        // Önce username ile kesin eşleşme dene (en yüksek öncelik)
        // Bulamazsan name veya email ile ara
        const user =
          (await prisma.user.findUnique({ where: { username: credentials.username } })) ??
          (await prisma.user.findFirst({
            where: {
              OR: [
                { name: credentials.username },
                { email: credentials.username },
              ],
            },
            orderBy: { createdAt: "asc" }, // en eski kaydı al (tutarlılık için)
          }))

        if (!user) {
          throw new Error("Kullanıcı bulunamadı")
        }

        const isValid = await bcrypt.compare(credentials.password, user.password)

        if (!isValid) {
          throw new Error("Geçersiz şifre")
        }

        const staff = await prisma.staff.findUnique({
          where: { userId: user.id },
          select: { position: true },
        })

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          position: staff?.position || null,
        }
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role
        token.id = user.id
        token.position = user.position
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.role = token.role as string
        session.user.id = token.id as string
        session.user.position = (token.position as string | null) ?? null
      }
      return session
    },
  },
  pages: {
    signIn: "/login",
  },
}
