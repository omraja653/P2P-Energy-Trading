// Returns the dashboard route for a user's type, or null if they haven't
// chosen a role yet (RoleSelector hasn't run). Callers that might see a
// typeless user and need a guaranteed path should fall back to '/login' —
// that's where the "authenticated but no role yet" case is handled by
// showing RoleSelector instead of the login form.
export function dashboardPathFor(type) {
  if (type === 'prosumer') return '/prosumer-dashboard'
  if (type === 'admin') return '/admin'
  if (type === 'consumer') return '/consumer-dashboard'
  return null
}
