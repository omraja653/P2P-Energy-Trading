import { useState } from 'react'
import { useAuth } from '../hooks/useAuth.js'
import { createTopUpOrder, verifyTopUp } from '../services/dashboard.js'
import { formatCurrency } from '../utils/formatting.js'

const QUICK_AMOUNTS = [100, 500, 1000, 5000]
const RAZORPAY_KEY_ID = import.meta.env.VITE_RAZORPAY_KEY_ID

// Real Razorpay Checkout flow: create-order (backend, real amount
// validation) -> Checkout collects payment -> verify-topup (backend,
// verifies the signature + fetches the payment from Razorpay before
// crediting anything — see routes/wallet.js). No amount is ever trusted
// from the client past the initial "how much do you want to add" choice.
function AddBalanceModal({ onClose, onSuccess }) {
  const { user } = useAuth()
  const [amount, setAmount] = useState(500)
  const [customAmount, setCustomAmount] = useState('')
  const [useCustom, setUseCustom] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const effectiveAmount = useCustom ? Number(customAmount) : amount

  async function handlePay() {
    setError('')
    if (!effectiveAmount || effectiveAmount <= 0) {
      setError('Enter a valid amount')
      return
    }
    if (!window.Razorpay) {
      setError('Payment gateway failed to load. Check your connection and try again.')
      return
    }

    setSubmitting(true)
    try {
      const order = await createTopUpOrder(effectiveAmount)

      const options = {
        key: RAZORPAY_KEY_ID,
        amount: Math.round(order.amount * 100),
        currency: order.currency,
        name: 'GridMate Energy Trading',
        description: 'Add balance to wallet',
        order_id: order.orderId,
        handler: async (response) => {
          try {
            const result = await verifyTopUp({
              orderId: order.orderId,
              paymentId: response.razorpay_payment_id,
              signature: response.razorpay_signature,
            })
            onSuccess?.(result)
          } catch (err) {
            setError(err.response?.data?.error || 'Payment verification failed. Please contact support.')
          } finally {
            setSubmitting(false)
          }
        },
        modal: {
          // Checkout closed without paying — not an error, just stop the spinner.
          ondismiss: () => setSubmitting(false),
        },
        prefill: {
          name: `${user?.firstName || ''} ${user?.lastName || ''}`.trim(),
          email: user?.email || '',
        },
        theme: { color: '#009687' },
      }

      const rzp = new window.Razorpay(options)
      rzp.on('payment.failed', () => {
        setError('Payment failed. Please try again.')
        setSubmitting(false)
      })
      rzp.open()
    } catch (err) {
      setError(err.response?.data?.error || 'Could not start payment. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center bg-black/40 px-2.5 sm:px-4">
      <div className="w-full max-w-md rounded-xl bg-white p-4 shadow-2xl sm:p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Add Balance to Your Wallet</h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="Close">
            ✕
          </button>
        </div>
        <p className="mt-1 text-sm text-slate-500">This balance will be used to purchase energy.</p>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {QUICK_AMOUNTS.map((amt) => (
            <button
              key={amt}
              type="button"
              onClick={() => { setUseCustom(false); setAmount(amt) }}
              className={`min-h-[44px] rounded-lg border px-2 py-2 text-sm font-semibold transition ${
                !useCustom && amount === amt ? 'border-teal bg-teal/10 text-teal' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              ₹{amt}
            </button>
          ))}
        </div>

        <div className="mt-3">
          <label className="mb-1 block text-xs font-medium text-slate-600">Custom amount (₹)</label>
          <input
            type="number"
            min="1"
            step="1"
            value={customAmount}
            onFocus={() => setUseCustom(true)}
            onChange={(e) => { setUseCustom(true); setCustomAmount(e.target.value) }}
            placeholder="Enter amount"
            className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none ${
              useCustom ? 'border-teal ring-2 ring-teal/20' : 'border-slate-300'
            }`}
          />
        </div>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="min-h-[44px] rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 sm:min-h-0"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handlePay}
            disabled={submitting || !effectiveAmount || effectiveAmount <= 0}
            style={{ backgroundColor: 'rgb(0, 150, 135)' }}
            className="min-h-[44px] rounded-lg px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50 sm:min-h-0"
          >
            {submitting ? '⏳ Processing…' : `Proceed to Payment${effectiveAmount ? ` (${formatCurrency(effectiveAmount)})` : ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}

export default AddBalanceModal
