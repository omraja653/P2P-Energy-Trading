import { useState } from 'react'
import { formatCurrency, formatDateTime, formatKwh, truncateHash } from '../utils/formatting.js'
import StatusBadge from './StatusBadge.jsx'
import ConfirmModal from './ConfirmModal.jsx'
import { disputeTrade } from '../services/admin.js'

const EXPLORER_BASE = 'https://amoy.polygonscan.com/tx/'

function personName(p) {
  return p ? `${p.firstName} ${p.lastName}` : 'Unknown'
}

function TradeDetailModal({ trade, onClose, onDisputeRaised, onOpenResolve }) {
  const [showDisputeConfirm, setShowDisputeConfirm] = useState(false)

  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center bg-black/40 px-4">
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-bold text-slate-900">Trade Details</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>

        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Status</span>
            <StatusBadge status={trade.status} />
          </div>
          <div className="flex items-center justify-between"><span className="text-slate-400">Prosumer (Seller)</span><span>{personName(trade.sellerId)}</span></div>
          <div className="flex items-center justify-between"><span className="text-slate-400">Consumer (Buyer)</span><span>{personName(trade.buyerId)}</span></div>
          <div className="flex items-center justify-between"><span className="text-slate-400">Quantity</span><span>{formatKwh(trade.quantityKWh)}</span></div>
          <div className="flex items-center justify-between"><span className="text-slate-400">Price</span><span>{formatCurrency(trade.pricePerKwh)}/kWh</span></div>
          <div className="flex items-center justify-between"><span className="text-slate-400">Total Amount</span><span className="font-semibold">{formatCurrency(trade.totalAmount)}</span></div>
          <div className="flex items-center justify-between"><span className="text-slate-400">Matched</span><span>{formatDateTime(trade.matchedAt)}</span></div>
          {trade.settledAt && <div className="flex items-center justify-between"><span className="text-slate-400">Settled</span><span>{formatDateTime(trade.settledAt)}</span></div>}
          {trade.blockchainTxHash && (
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Blockchain TX</span>
              <a href={`${EXPLORER_BASE}${trade.blockchainTxHash}`} target="_blank" rel="noreferrer" className="text-brand-blue hover:underline">
                {truncateHash(trade.blockchainTxHash)} ↗
              </a>
            </div>
          )}
        </div>

        {trade.dispute?.reason && (
          <div className="mt-4 rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm">
            <p className="font-semibold text-orange-700">Dispute</p>
            <p className="mt-1 text-orange-700">{trade.dispute.reason}</p>
            {trade.dispute.decision && (
              <p className="mt-1 text-xs text-orange-600">
                Resolved: {trade.dispute.decision.replace(/_/g, ' ')} — {trade.dispute.resolutionNotes}
              </p>
            )}
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          {trade.status === 'disputed' ? (
            <button onClick={() => onOpenResolve(trade)} className="rounded-lg bg-brand-green px-3 py-1.5 text-sm font-medium text-white hover:opacity-90">
              Resolve Dispute
            </button>
          ) : (
            trade.status !== 'cancelled' && (
              <button onClick={() => setShowDisputeConfirm(true)} className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50">
                Mark as Disputed
              </button>
            )
          )}
        </div>
      </div>

      {showDisputeConfirm && (
        <ConfirmModal
          title="Mark trade as disputed?"
          requireReason="Dispute reason"
          confirmLabel="Mark Disputed"
          onClose={() => setShowDisputeConfirm(false)}
          onConfirm={async (reason) => {
            await disputeTrade(trade._id, reason)
            setShowDisputeConfirm(false)
            onDisputeRaised()
          }}
        />
      )}
    </div>
  )
}

export default TradeDetailModal
