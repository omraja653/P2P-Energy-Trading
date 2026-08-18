import { useEffect, useRef, useState } from 'react'
import api from '../services/api.js'

const GREETING = {
  role: 'assistant',
  content:
    "Hi! I'm GridMate. Ask me about current prices, how P2P trading works, or your recent trades or tap a quick action below.",
}

const QUICK_ACTIONS = [
  { label: 'Price Alerts', query: 'Alert me when the P2P price drops below $0.10/kWh.' },
  { label: 'My Trades', query: 'What are my pending trades right now?' },
  { label: 'Nearby Prosumers', query: 'Who has energy available to buy right now?' },
  { label: 'Savings Calculator', query: 'How much have I saved compared to grid prices this month?' },
  { label: 'FAQ', query: 'What tips do you have for getting good trades?' },
]

function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6">
      <path
        d="M4 4h16v12H7l-3 3V4z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6">
      <path
        d="M6 6l12 12M18 6L6 18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

function TypingIndicator() {
  return (
    <div className="flex gap-1 rounded-lg bg-slate-100 px-3 py-2">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </div>
  )
}

function MessageBubble({ role, content }) {
  const isUser = role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ${
          isUser ? 'bg-primary text-white' : 'bg-slate-100 text-slate-800'
        }`}
      >
        {content}
      </div>
    </div>
  )
}

function Chat() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState([GREETING])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const scrollRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, loading, isOpen])

  function handleQuickAction(query) {
    setInput(query)
    inputRef.current?.focus()
  }

  async function handleSend(e) {
    e.preventDefault()
    const question = input.trim()
    if (!question || loading) return

    setMessages((prev) => [...prev, { role: 'user', content: question }])
    setInput('')
    setError(null)
    setLoading(true)

    try {
      const { data } = await api.post('/chat', { message: question })
      setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }])
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 flex h-[31rem] w-80 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl sm:w-96">
          <div className="flex items-center justify-between bg-primary px-4 py-3 text-white">
            <span className="font-medium">GridMate</span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded p-1 hover:bg-white/10"
              aria-label="Close chat"
            >
              <CloseIcon />
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
            {messages.map((m, i) => (
              <MessageBubble key={i} role={m.role} content={m.content} />
            ))}
            {loading && <TypingIndicator />}
            {error && (
              <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>
            )}
          </div>

          <form onSubmit={handleSend} className="flex gap-2 border-t border-slate-200 p-3">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about prices, trades..."
              className="flex-1 rounded border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="rounded bg-primary px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              Send
            </button>
          </form>

          <div className="flex flex-wrap gap-1.5 border-t border-slate-200 bg-slate-50 px-3 py-2">
            {QUICK_ACTIONS.map((action) => (
              <button
                key={action.label}
                type="button"
                onClick={() => handleQuickAction(action.query)}
                disabled={loading}
                className="rounded-full border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-600 hover:border-primary hover:text-primary disabled:opacity-50"
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => {
          setIsOpen((open) => {
            const next = !open
            // Reopening after a close starts a fresh conversation.
            if (next) {
              setMessages([GREETING])
              setInput('')
              setError(null)
            }
            return next
          })
        }}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-lg transition hover:opacity-90"
        aria-label={isOpen ? 'Close chat' : 'Open chat'}
      >
        {isOpen ? <CloseIcon /> : <ChatIcon />}
      </button>
    </>
  )
}

export default Chat
