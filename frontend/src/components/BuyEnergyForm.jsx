import { useState } from 'react'

function BuyEnergyForm({ onSubmit }) {
  const [amount, setAmount] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    onSubmit?.({ amount: Number(amount) })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <label className="text-sm font-medium text-gray-700" htmlFor="amount">
        Amount (kWh)
      </label>
      <input
        id="amount"
        type="number"
        min="0"
        step="0.1"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="rounded border border-gray-300 px-3 py-2"
        required
      />
      <button type="submit" className="rounded bg-primary px-4 py-2 text-white">
        Buy Energy
      </button>
    </form>
  )
}

export default BuyEnergyForm
