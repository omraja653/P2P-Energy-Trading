export async function connectWallet() {
  if (!window.ethereum) {
    throw new Error('MetaMask is not installed.')
  }

  const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' })
  return accounts[0]
}

export async function getConnectedAccount() {
  if (!window.ethereum) return null
  const accounts = await window.ethereum.request({ method: 'eth_accounts' })
  return accounts[0] || null
}

export async function switchToPolygonAmoy() {
  const chainId = `0x${Number(import.meta.env.VITE_POLYGON_AMOY_CHAINID || 80002).toString(16)}`
  await window.ethereum.request({
    method: 'wallet_switchEthereumChain',
    params: [{ chainId }],
  })
}
