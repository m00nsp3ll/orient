import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token
    const path = req.nextUrl.pathname

    // Redirect to dashboard if authenticated user tries to access auth pages
    if (token && (path === "/login" || path === "/register")) {
      return NextResponse.redirect(new URL("/dashboard", req.url))
    }

    // Check role-based access
    if (path.startsWith("/dashboard/settings") && token?.role !== "ADMIN") {
      return NextResponse.redirect(new URL("/dashboard", req.url))
    }

    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const path = req.nextUrl.pathname

        // Public pages
        if (
          path === "/" ||
          path === "/login" ||
          path === "/register" ||
          path.startsWith("/api/auth")
        ) {
          return true
        }

        // Dashboard requires authentication
        if (path.startsWith("/dashboard")) {
          return !!token
        }

        return true
      },
    },
  }
)

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/login",
    "/register",
  ],
}
