# GridMate — Blockchain-Based Peer-to-Peer Energy Trading Platform

A full-stack decentralized marketplace that lets households with rooftop solar (**prosumers**) sell their surplus electricity directly to neighbouring **consumers**, with automated settlement recorded on the blockchain.

> **Capstone Project — Group 23 | MIT-WPU | 2026–2027**

---

## The Problem

Traditional energy grids centralize power distribution and leave rooftop-solar owners at a disadvantage:

- Prosumers earn low feed-in rates (≈ ₹0.08/kWh) while consumers pay high retail rates (≈ ₹0.15/kWh)
- Settlements are slow, opaque, and controlled by a single utility
- No direct, trusted mechanism for neighbors to trade energy peer-to-peer
- Small renewable producers have little economic incentive

## Our Solution

GridMate is a **software marketplace and settlement layer** on the existing grid—it does not reroute electricity physically. Surplus energy is listed, matched algorithmically, and settled via blockchain smart contracts for complete transparency.

Both sides win by meeting in the middle at **₹0.12/kWh**:

| Party | Traditional | GridMate |
|---|---|---|
| Prosumer earns | ₹0.08/kWh | **₹0.12/kWh** (+50%) |
| Consumer pays | ₹0.15/kWh | **₹0.12/kWh** (−20%) |
| Grid utility | full retail margin | **wheeling fee** (still profitable) |

Every trade splits automatically on-chain: **83% prosumer · 8% grid · 9% platform**

## How It Works

1. **Prosumer lists** surplus energy (kWh + price) → marketplace
2. **Double-auction engine** pairs buyers/sellers at fair supply/demand price
3. **Consumer purchases** energy from the marketplace
4. **Smart contract settles** the trade and three-way payment split on Polygon Amoy
5. **Both verify** the transaction publicly on BlockScout

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, Vite, Tailwind CSS, Ethers.js, MetaMask |
| **Backend** | Node.js 18+, Express, MongoDB Atlas, JWT Auth |
| **Blockchain** | Solidity 0.8.20, Hardhat, Polygon Amoy (PoS, testnet) |
| **AI** | Azure OpenAI GPT-4o-mini (marketplace chatbot) |
| **Services** | Brevo (email OTP), Twilio (SMS OTP) |
| **Deployment** | Vercel (frontend), Railway (backend) |

## Architecture

```
┌─────────────────────────────────────────┐
│      FRONTEND (React + Vite)            │
│  Dashboards · Marketplace · Chat Widget │
│  MetaMask Integration                   │
└──────────────┬──────────────────────────┘
               │ REST API + JWT
┌──────────────▼──────────────────────────┐
│     BACKEND (Node.js + Express)         │
│  Auth · Matching Engine · Pricing       │
│  Settlement · Blockchain Service        │
└──────────────┬──────────────────────────┘
        │              │
   ┌────▼──────┐  ┌────▼─────────────────┐
   │  MongoDB  │  │  Polygon Amoy Chain  │
   │  Atlas    │  │  Smart Contracts     │
   │  (DB)     │  │  (BlockScout)        │
   └───────────┘  └──────────────────────┘
```

## Features

**🔐 Authentication**
- Email + Mobile OTP verification
- Multiple login methods: Email+Password, Email+OTP, Mobile+OTP, Google OAuth
- Strong password policy + forgot-password via OTP
- Role selection (Prosumer / Consumer) after signup
- Pre-trading verification gate (mobile + KYC)

**⚡ Marketplace & Trading**
- Real-time prosumer & consumer dashboards
- Double-auction matching engine with live pricing
- Trade history with blockchain settlement verification
- AI chatbot grounded in live marketplace data

**🔗 Blockchain Settlement**
- `EnergyTrade.sol` + `Settlement.sol` deployed on Polygon Amoy
- MetaMask wallet connection
- Automatic three-way payment split
- All transactions verified on BlockScout

**🤖 AI Assistant**
- In-app chat widget (Azure OpenAI)
- Answers: how to trade, current prices, nearby prosumers
- Context-aware using live marketplace data

**👨‍💼 Admin Panel**
- User management, trade oversight, platform metrics
- Dispute resolution, KYC verification

## Quick Start

### Prerequisites
- Node.js 18+
- MongoDB Atlas connection string
- MetaMask browser extension
- API keys: Brevo, Twilio, Azure OpenAI, Google OAuth (optional for full features)

### Installation

**1. Frontend**
```bash
cd frontend
npm install
npm run dev              # http://localhost:5173
```

**2. Backend**
```bash
cd backend
npm install
npm run seed             # Load demo data
npm run dev              # http://localhost:5000
```

**3. Smart Contracts**
```bash
cd contracts
npm install
npx hardhat compile
npx hardhat run scripts/deploy.js --network amoy
```

### Demo Accounts
| Email | Password | Role |
|---|---|---|
| alice.prosumer@example.com | Password123 | Prosumer |
| bob.consumer@example.com | Password123 | Consumer |
| admin@energytrading.com | Admin1234 | Admin |

## Environment Variables

`.env` file in `backend/`:

```env
# Database
MONGODB_URI=your_mongodb_connection_string

# Auth
JWT_SECRET=your_secret_key

# Email (Brevo)
BREVO_API_KEY=your_api_key
BREVO_SENDER_EMAIL=your_email@domain.com

# SMS (Twilio)
TWILIO_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE=+1234567890

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_secret

# AI (Azure OpenAI)
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_DEPLOYMENT=gpt-4-mini
AZURE_OPENAI_API_KEY=your_key

# Blockchain
ENERGY_TRADE_CONTRACT_ADDRESS=0x...
PLATFORM_WALLET_ADDRESS=0x...
PLATFORM_PRIVATE_KEY=your_private_key
```

## API Endpoints

**Authentication**
```
POST   /api/auth/register
POST   /api/auth/verify-email-otp
POST   /api/auth/verify-mobile-otp
POST   /api/auth/login-email-password
POST   /api/auth/forgot-password
POST   /api/auth/google
PATCH  /api/auth/role
GET    /api/auth/me
```

**Trading (protected by verification middleware)**
```
GET    /api/listings                    # All active listings
POST   /api/trades                      # Create trade
GET    /api/trades                      # User's trade history
```

**Chat**
```
POST   /api/chat                        # AI assistant
```

## Smart Contracts

| Contract | Address | Purpose |
|---|---|---|
| **EnergyTrade** | `0xa842...` | Energy listings & trades |
| **Settlement** | `0x5Bf7...` | Three-way payment split |

**Network:** Polygon Amoy (testnet)
**Verified on:** BlockScout

## Testing

```bash
cd backend
npm test                    # Jest suites
```

**Status:** 38/38 tests passing ✅

Covers registration, login flows, trading gate, password reset, admin routes, chatbot.

## Current Status

✅ **Implemented**
- Full auth system (registration, OTP, multiple logins, Google OAuth)
- Consumer/Prosumer dashboards & marketplace
- AI chatbot with live marketplace context
- Email (Brevo) & SMS (Twilio) OTP delivery
- Smart contracts deployed & verified on Polygon Amoy
- 38/38 backend tests passing

⏳ **Next Phase**
- Wire `Settlement.sol` into live trade path (on-chain settlement integration)
- INR stablecoin (INRC) implementation
- Complete admin dashboard
- Mobile responsive polish
- Production deployment

## What We Closed (Literature Gap)

❌ **Existing research:**
- Simulation-only (never deployed live)
- Trusted intermediaries / central auctioneers
- Energy-heavy PoW blockchains
- EV/V2G niches only
- No real pricing engine

✅ **GridMate delivers:**
- ✅ Double-auction pricing engine
- ✅ Direct P2P via smart contracts (no intermediary)
- ✅ Low-energy Polygon PoS L2
- ✅ Generalizes to household solar + consumer market
- ✅ Working MVP deployed on public testnet
- ✅ Measurable savings: prosumers +50%, consumers −20%
- ✅ Grid wheeling-fee model keeps utility involved

## Project Structure

```
energy-trading-platform/
├── frontend/             React + Vite
│   ├── public/          assets, logos, hero image
│   └── src/
│       ├── components/  Navbar, modals, gates, chat widget
│       ├── pages/       Login, Register, dashboards, Marketplace
│       ├── hooks/       useAuth
│       ├── services/    API clients
│       └── utils/       validation, formatting
├── backend/             Node.js + Express
│   ├── models/          User, Trade, Settlement, Listing, MeterData
│   ├── routes/          auth, trades, admin, chat
│   ├── services/        matching, pricing, settlement, blockchain, email, SMS, OTP
│   ├── middleware/      auth, verification gate
│   ├── scripts/         seed.js
│   └── __tests__/       Jest suites (38/38 passing)
└── contracts/           Solidity + Hardhat
    ├── contracts/       EnergyTrade.sol, Settlement.sol
    ├── scripts/         deploy.js
    └── deployment.json  deployed addresses
```

## Team & Contributions

**Group 23 — B.Tech Capstone**

### Om Raja (1032233046) — Backend Architecture & Blockchain Integration
- **Authentication System**: Complete registration flow with email + mobile OTP verification, multiple login methods (Email+Password, Email+OTP, Mobile+OTP, Google OAuth), strong password validation, forgot-password via OTP, role selection post-login, pre-trading verification gate
- **Service Integrations**: Migrated email delivery from Gmail SMTP to Brevo REST API (fixed authentication failures), integrated Twilio SMS OTP delivery with trial account handling, Azure OpenAI chatbot integration with live marketplace data context
- **Backend Architecture**: Designed and implemented Node.js + Express API with JWT authentication, MongoDB schema design, all routes (auth, trades, admin, chat), service layer (matching engine, pricing, settlement, blockchain, OTP, email, SMS), middleware for auth and trading verification gates
- **Blockchain Integration**: Deployed EnergyTrade.sol and Settlement.sol on Polygon Amoy testnet, verified contracts on BlockScout, integrated ethers.js for wallet communication, designed three-way settlement split logic, planned on-chain settlement wiring
- **Testing & QA**: Built comprehensive Jest test suite (38/38 passing), covering registration, login flows, password reset, admin routes, pre-trading gate, chatbot endpoint; mocked external services (Brevo, Twilio, Azure) to ensure reliable testing without real API calls
- **Bug Fixes & Refinements**: Fixed MongoDB Atlas IP whitelisting, resolved partial-fill trade matching, debugged settlement logic, handled Twilio trial account SMS restrictions gracefully, implemented graceful degradation for failed OTP delivery

### Aditya Mathur (1032230746) — Frontend & UI/UX
- Login & registration pages with professional GridMate branding
- Consumer & prosumer dashboards with real-time stats
- Marketplace with energy listings and buy flow
- Trade history with blockchain settlement verification
- Mobile verification and KYC modals
- Chat widget integration
- Professional dark-theme navbar with navigation
- Responsive design across all pages

### Atisha Malwadkar (1032233373) — Testing, QA & Documentation
- End-to-end testing across auth and trading flows
- Mobile device testing (cross-network via LAN IP)
- Documentation and code cleanup
- Quality assurance for all features

**Guides:** Dr. Sumitra Motade | Dr. Vinayak Gaikwad

---

---

*Developed for academic purposes. Smart contracts run on public testnet; no real funds involved.*
