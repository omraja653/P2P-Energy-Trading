import { useWallet } from '../hooks/useWallet.js'

function WalletConnect() {
  const { address, connect, isConnecting } = useWallet()

  return (
    <button
      onClick={connect}
      disabled={isConnecting}
      className="rounded bg-accent px-3 py-1 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
    >
      {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Connect Wallet'}
    </button>
  )
}

export default WalletConnect
