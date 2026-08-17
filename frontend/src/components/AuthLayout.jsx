// Shared background/frame for the auth pages (Login, Register). Built as a
// CSS-only gradient rather than an image — no login_bg_professional.png
// exists anywhere in this repo; drop one into frontend/public/ and swap the
// div below for an <img>/background-image if you have that asset.
function AuthLayout({ children }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-4 py-12">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-accent/20 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.08),transparent_60%)]" />
      </div>

      <div className="relative w-full max-w-md">{children}</div>
    </div>
  )
}

export default AuthLayout
