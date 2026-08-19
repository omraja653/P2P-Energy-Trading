import { passwordChecklist } from '../utils/validation.js'

// Same live-requirements checklist used inline in Register.jsx, pulled out
// so the profile page's "change password" tab can reuse it verbatim.
function PasswordStrengthIndicator({ password }) {
  const checklist = passwordChecklist(password)
  return (
    <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
      {checklist.map((rule) => (
        <li key={rule.label} className={rule.valid ? 'text-green-600' : 'text-slate-400'}>
          {rule.valid ? '✓' : '○'} {rule.label}
        </li>
      ))}
    </ul>
  )
}

export default PasswordStrengthIndicator
