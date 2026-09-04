// Returns the dashboard route for a user's type, or null if they haven't
// chosen a role yet (RoleSelector hasn't run). Callers that might see a
// typeless user and need a guaranteed path should fall back to '/login' —
// that's where the "authenticated but no role yet" case is handled by
// showing RoleSelector instead of the login form.
export function dashboardPathFor(type) {
  // Consumer and prosumer now share one unified Dashboard page (branches on
  // role internally) instead of two separate routes/pages.
  if (type === 'prosumer' || type === 'consumer') return '/dashboard'
  if (type === 'admin') return '/admin'
  // Support agents have no trading dashboard of their own — their "home" is
  // the ticket queue.
  if (type === 'support') return '/support-dashboard'
  return null
}
