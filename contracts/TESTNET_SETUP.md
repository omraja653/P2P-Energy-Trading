# Testnet Wallet Setup — Polygon Amoy

Before deploying `EnergyTrade.sol` + `Settlement.sol`, you need a wallet with
free test MATIC to pay gas. This guide walks through creating one.

> ⚠️ **Security rules, read first**
> - Use a **brand-new wallet dedicated to this testnet**, never an account
>   that holds (or will ever hold) real funds.
> - Your private key goes in **`contracts/.env` only** — never in chat,
>   Slack, a screenshot, or committed to git. `.env` is already gitignored
>   here, so it's safe to paste it there.
> - Testnet MATIC is worthless play-money, but the habit of protecting a
>   private key should be the same as for a real wallet.

## Step A — Install MetaMask
1. Go to https://metamask.io/download/ and install the browser extension.
2. Create a new wallet and **write the seed phrase down somewhere safe**
   (not this repo, not a chat).
3. Create a new **account** inside that wallet specifically for this
   project's testnet use (Account menu → "Add account").

## Step B — Add the Polygon Amoy network
1. Open MetaMask → network dropdown (top) → **Add network** → **Add a
   network manually**.
2. Fill in:
   | Field | Value |
   |---|---|
   | Network name | Polygon Amoy |
   | RPC URL | `https://polygon-amoy-bor-rpc.publicnode.com` |
   | Chain ID | `80002` |
   | Currency symbol | MATIC |
   | Block explorer | `https://amoy.polygonscan.com` |
3. Save. "Polygon Amoy" should now be selectable in the network dropdown.

## Step C — Export the private key
1. In MetaMask, select the testnet-only account from Step A.
2. Account menu → **Account details** → **Show private key**.
3. Enter your MetaMask password.
4. Copy the key (starts with `0x`).
5. **Do not paste it anywhere except `contracts/.env` in the next step.**

## Step D — Get free test MATIC
1. Copy your wallet address from MetaMask (top of the extension).
2. Go to https://faucet.polygon.technology/ and select **Polygon Amoy**.
3. Paste your address, solve the captcha, submit.
4. Wait 1–2 minutes, then check MetaMask — you should see ~0.5 MATIC
   (some faucets give 0.2, that's plenty for two contract deployments).

## Step E — Save the key locally
1. Open `contracts/.env` (create it from `contracts/.env.example` if it
   doesn't exist yet).
2. Set:
   ```
   PRIVATE_KEY=0xyour_private_key_here
   POLYGON_RPC_URL=https://polygon-amoy-bor-rpc.publicnode.com
   ```
3. Save the file. **Do not** paste its contents into chat — just tell your
   assistant/teammate "done", and it can verify the key is present and
   correctly formatted without ever reading the raw value.

Once this is done, deployment is a single command:
```bash
cd contracts
npx hardhat run scripts/deploy.js --network polygonAmoy
```
