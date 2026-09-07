// Shared background/frame for the auth pages. Login.jsx has its own
// separate hero-image layout and doesn't use this — only Register.jsx does,
// so restyling this is scoped to the signup page alone.
//
// Gradient hexes match the ones Login.jsx's own button/links already use
// (#1abf87, #2d7ae6) rather than introducing a third, slightly different
// palette — the two auth pages read as one consistent flow this way,
// rather than each having its own one-off gradient.
function AuthLayout({ children, maxWidthClassName = 'max-w-md' }) {
  return (
    <div
      className="relative flex min-h-screen items-center justify-center overflow-y-auto px-2 py-2"
      style={{ background: 'linear-gradient(135deg, #17A2B8 0%, #1abf87 55%, #2d7ae6 100%)' }}
    >
      {/* overflow-y-auto (not hidden) is a safety net, not the intended
          path — the compacted sizing in Register.jsx's form step is what
          actually keeps this within one viewport on real devices; auto
          just means an unusually short/zoomed viewport scrolls instead of
          clipping content, rather than hiding it entirely. */}
      <div className={`relative w-full ${maxWidthClassName}`}>{children}</div>
    </div>
  )
}

export default AuthLayout
