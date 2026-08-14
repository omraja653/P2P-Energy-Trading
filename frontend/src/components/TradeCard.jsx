function TradeCard({ trade }) {
  if (!trade) return null

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="font-medium">{trade.energyAmount} kWh</span>
        <span className="text-sm text-gray-500">{trade.status}</span>
      </div>
      <p className="mt-1 text-sm text-gray-600">Price: {trade.price}</p>
      <p className="mt-1 text-xs text-gray-400">Tx: {trade.txHash}</p>
    </div>
  )
}

export default TradeCard
