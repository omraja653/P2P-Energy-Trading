import { useEffect, useRef } from 'react'

/**
 * Renders Google's own "Sign in with Google" button via Google Identity
 * Services (loaded in index.html) and reports the resulting ID token.
 * The GIS script loads async, so this polls briefly for window.google
 * rather than assuming it's ready on mount.
 */
function GoogleSignInButton({ onCredential, disabled }) {
  const buttonRef = useRef(null)
  const onCredentialRef = useRef(onCredential)
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID

  useEffect(() => {
    onCredentialRef.current = onCredential
  }, [onCredential])

  useEffect(() => {
    if (!clientId) return
    let cancelled = false
    let attempts = 0

    function tryInit() {
      if (cancelled) return
      if (window.google?.accounts?.id && buttonRef.current) {
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => onCredentialRef.current(response.credential),
        })
        window.google.accounts.id.renderButton(buttonRef.current, {
          theme: 'outline',
          size: 'large',
          width: 320,
          text: 'continue_with',
        })
        return
      }
      attempts += 1
      if (attempts < 50) setTimeout(tryInit, 100) // ~5s of retries for the async script
    }

    tryInit()
    return () => {
      cancelled = true
    }
  }, [clientId])

  if (!clientId) {
    return (
      <button
        type="button"
        disabled
        className="w-full rounded border border-slate-300 px-4 py-2 text-sm text-slate-400"
        title="VITE_GOOGLE_CLIENT_ID is not set"
      >
        Sign in with Google (not configured)
      </button>
    )
  }

  return <div ref={buttonRef} className={disabled ? 'pointer-events-none opacity-50' : ''} />
}

export default GoogleSignInButton
