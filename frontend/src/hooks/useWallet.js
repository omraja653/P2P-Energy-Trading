import { useCallback, useState } from 'react'
import { connectWallet } from '../services/wallet.js'

export function useWallet() {
  const [address, setAddress] = useState(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState(null)

  const connect = useCallback(async () => {
    setIsConnecting(true)
    setError(null)
    try {
      const account = await connectWallet()
      setAddress(account)
      return account
    } catch (err) {
      setError(err)
      throw err
    } finally {
      setIsConnecting(false)
    }
  }, [])

  return { address, connect, isConnecting, error }
}
