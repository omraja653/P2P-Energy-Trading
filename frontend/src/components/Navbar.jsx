import { Link } from 'react-router-dom'
import WalletConnect from './WalletConnect.jsx'

function Navbar() {
  return (
    <nav className="flex items-center justify-between bg-primary px-6 py-4 text-white">
      <Link to="/" className="text-lg font-bold">
        Energy Trading Platform
      </Link>
      <div className="flex items-center gap-4">
        <Link to="/marketplace">Marketplace</Link>
        <Link to="/trades">Trade History</Link>
        <WalletConnect />
      </div>
    </nav>
  )
}

export default Navbar
