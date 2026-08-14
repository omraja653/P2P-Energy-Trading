import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar.jsx'
import Login from './pages/Login.jsx'
import ConsumerDashboard from './pages/ConsumerDashboard.jsx'
import ProsumerDashboard from './pages/ProsumerDashboard.jsx'
import AdminDashboard from './pages/AdminDashboard.jsx'
import TradeHistory from './pages/TradeHistory.jsx'
import Marketplace from './pages/Marketplace.jsx'
import NotFound from './pages/NotFound.jsx'

function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/consumer" element={<ConsumerDashboard />} />
        <Route path="/prosumer" element={<ProsumerDashboard />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/trades" element={<TradeHistory />} />
        <Route path="/marketplace" element={<Marketplace />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </div>
  )
}

export default App
