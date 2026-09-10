<<<<<<< HEAD
# GridMate --- Blockchain-Based Peer-to-Peer Energy Trading Platform

> **Capstone Project · Group 23 · MIT World Peace University ·
> 2026--2027**
=======
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

**Trading — double auction (protected by verification middleware)**
```
POST   /api/auction/orders              # Place a buy/sell order
GET    /api/auction/orders              # Current round's order-book depth
GET    /api/auction/orders/mine         # Your orders
POST   /api/auction/orders/:id/cancel   # Cancel a pending order
GET    /api/auction/matches             # Your cleared trades
GET    /api/trades                      # Full trade history (all mechanisms)
```
Orders accumulate silently; every `AUCTION_INTERVAL_MS` (default 120s) the
engine computes one market-clearing price and matches every eligible order
at it. Settlement then runs automatically via the settlement scheduler.

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
>>>>>>> baabf273cb3e9df6d81167ed2e72d56371f187b8

GridMate is a full-stack **peer-to-peer energy trading platform**
designed to enable households with rooftop solar generation
(**prosumers**) to trade surplus energy with nearby **consumers**
through an automated marketplace, with trade settlement recorded on
blockchain.

The platform is a software marketplace and settlement layer over the
existing electricity grid. It does not physically reroute electricity
between homes; the grid remains the underlying physical infrastructure
and balancing mechanism.

## ⚡ The Problem

Traditional electricity systems are largely centralized:

-   Prosumers may receive relatively low compensation for surplus energy
    exported to the grid.
-   Consumers purchase electricity at comparatively higher retail
    tariffs.
-   Manual buying and selling of electricity is impractical because
    consumers do not know their exact future energy requirement.
-   There is no simple, transparent mechanism for neighboring households
    to participate directly in energy trading.

## 💡 Our Solution

GridMate connects prosumers and consumers through an automated P2P
marketplace.

``` text
Solar Prosumer
      │
Surplus Energy
      ▼
┌─────────────────┐
│    GridMate     │
│ P2P Marketplace │
└────────┬────────┘
         │
 Automated Matching
   & Dynamic Pricing
         │
         ▼
     Consumer
         │
         ▼
   Energy Grid
 (Physical Network)
```

## 🔄 How It Works

1.  Smart-meter data provides consumption and generation information.
2.  The platform identifies available surplus energy from prosumers.
3.  Consumer demand is estimated from current and historical
    consumption.
4.  Available buyers and sellers enter the marketplace automatically.
5.  The **Double Auction engine** matches compatible supply and demand.
6.  A market-clearing price is determined.
7.  The consumer receives available P2P energy through the existing grid
    infrastructure.
8.  Any remaining requirement can be supplied by the conventional grid.
9.  The completed trade is recorded and settled using a blockchain smart
    contract.
10. Users can verify the resulting transaction on the public testnet
    explorer.

## 💰 Pricing Model

### Phase 1 --- Double Auction

Buyers submit required energy and maximum acceptable price. Sellers
submit available energy and minimum acceptable price. The matching
engine sorts and matches bids/offers, determines the market-clearing
condition, allocates energy, and produces the clearing price.

### Phase 2 --- Dynamic Pricing

The platform can incorporate current demand, available supply, renewable
generation, historical prices, time of day, consumption patterns,
weather, and grid conditions.

### Phase 3 --- AI-Assisted Pricing

An AI/ML layer can later use historical and real-time data to improve
demand forecasting, supply forecasting, and price recommendations.

``` text
Data
 ↓
Forecasting / AI Model
 ↓
Recommended Price
 ↓
Validation Rules
 ↓
Trading Engine
 ↓
Smart Contract
 ↓
Blockchain Settlement
```

## 🔗 Blockchain

GridMate uses blockchain for **verifiable trade and settlement
records**, rather than storing all application data on-chain.

-   Solidity 0.8.20
-   Hardhat
-   Ethers.js
-   MetaMask
-   Polygon Amoy Testnet

``` text
User
 ↓
React Frontend
 ↓
MetaMask
 ↓
Smart Contract
 ↓
Polygon Amoy
 ↓
Transaction Hash
 ↓
Explorer Verification
```

Large application and meter datasets remain off-chain in MongoDB.

## 🏗️ Architecture

``` text
┌─────────────────────────────────────────────────────┐
│                  FRONTEND                           │
│            React + Vite + Tailwind                  │
│                                                     │
│ Dashboards · Marketplace · Trading · Analytics      │
│ Wallet · Authentication · AI Assistant              │
└──────────────────────┬──────────────────────────────┘
                       │ REST API
                       ▼
┌─────────────────────────────────────────────────────┐
│                  BACKEND                            │
│             Node.js + Express                       │
│                                                     │
│ Auth · Marketplace · Matching · Pricing             │
│ Meter Data · Trading · Blockchain Service          │
└───────────────┬───────────────────┬─────────────────┘
                │                   │
                ▼                   ▼
      ┌─────────────────┐   ┌────────────────────────┐
      │   MongoDB Atlas │   │   Polygon Amoy         │
      │                 │   │                        │
      │ Users           │   │ Solidity Contracts     │
      │ Listings        │   │ Trade Settlement       │
      │ Bids            │   │ Blockchain Events      │
      │ Trades          │   └────────────────────────┘
      │ Meter Data      │
      └─────────────────┘
```

## 🧩 Core Features

### 🔐 Authentication

-   Email + password authentication
-   OTP-based verification
-   Forgot-password flow
-   Role selection
-   Google OAuth where configured
-   Wallet connection
-   Verification gate before trading

### ⚡ Marketplace & Trading

-   Consumer and prosumer dashboards
-   Energy listings
-   Buyer bids
-   Seller offers
-   Double-auction matching
-   Market-clearing pricing
-   Trading history
-   Automated trade workflow

### 🔗 Blockchain Settlement

-   Solidity smart contracts
-   MetaMask integration
-   Polygon Amoy testnet
-   On-chain trade records
-   Transaction hashes
-   Public transaction verification

### 🤖 AI Assistant

-   In-app AI assistant
-   Marketplace-aware responses
-   Energy trading guidance
-   Current marketplace information where available

### 👨‍💼 Administration

-   User management
-   Trade monitoring
-   Platform statistics
-   KYC/verification management
-   Dispute and operational oversight

## 🛠️ Technology Stack

  Layer        Technology
  ------------ ---------------------------------
  Frontend     React 18, Vite, Tailwind CSS
  Web3         Ethers.js, MetaMask
  Backend      Node.js, Express
  Database     MongoDB Atlas
  Blockchain   Solidity, Hardhat, Polygon Amoy
  AI           Azure OpenAI
  Email        Brevo
  SMS          Twilio
  Deployment   Vercel + Railway

## 📁 Project Structure

``` text
energy-trading-platform/
<<<<<<< HEAD
├── frontend/
│   ├── public/
│   └── src/
│       ├── components/
│       ├── pages/
│       ├── hooks/
│       ├── services/
│       └── utils/
├── backend/
│   ├── models/
│   ├── routes/
│   ├── services/
│   ├── middleware/
│   ├── scripts/
│   └── __tests__/
└── contracts/
    ├── contracts/
    ├── scripts/
    └── deployment.json
```

## 🚀 Quick Start

### Prerequisites

-   Node.js 18+
-   MongoDB Atlas
-   MetaMask
-   Git
-   Polygon Amoy testnet wallet/funds for development

### Frontend

``` bash
cd frontend
npm install
npm run dev
```

Default development URL: `http://localhost:5173`

### Backend

``` bash
cd backend
npm install
npm run dev
```

Default development URL: `http://localhost:5000`

### Smart Contracts

``` bash
cd contracts
npm install
npx hardhat compile
npx hardhat run scripts/deploy.js --network amoy
```

> Keep private keys, API keys, database credentials, and other secrets
> in environment variables. Never commit them to GitHub.

## 🔑 Environment Variables

Example backend configuration:

``` env
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_secret

BREVO_API_KEY=your_api_key
BREVO_SENDER_EMAIL=your_email

TWILIO_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE=your_phone_number

GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_secret

AZURE_OPENAI_ENDPOINT=your_endpoint
AZURE_OPENAI_DEPLOYMENT=your_deployment
AZURE_OPENAI_API_KEY=your_key

ENERGY_TRADE_CONTRACT_ADDRESS=your_contract_address
PLATFORM_WALLET_ADDRESS=your_wallet_address
PLATFORM_PRIVATE_KEY=your_private_key
```

**Never commit real secrets to the repository.**

## 🌐 API Overview

### Authentication

``` text
POST   /api/auth/register
POST   /api/auth/verify-email-otp
POST   /api/auth/verify-mobile-otp
POST   /api/auth/login-email-password
POST   /api/auth/forgot-password
POST   /api/auth/google
PATCH  /api/auth/role
GET    /api/auth/me
```

### Trading

``` text
GET    /api/listings
POST   /api/trades
GET    /api/trades
```

### AI Assistant

``` text
POST   /api/chat
```

## 📜 Smart Contracts

  -----------------------------------------------------------------------
  Contract                            Purpose
  ----------------------------------- -----------------------------------
  `EnergyTrade.sol`                   Energy listings and trade-related
                                      blockchain state

  `Settlement.sol`                    Trade settlement and payment
                                      distribution
  -----------------------------------------------------------------------

**Network:** Polygon Amoy Testnet

Contract addresses should be maintained in deployment configuration and
environment variables rather than hardcoded into this README.

## 🧪 Testing

``` bash
cd backend
npm test
```

Testing should cover authentication, protected routes, marketplace
functionality, pricing/matching, blockchain integration, and AI
endpoints.

Smart-contract tests should cover valid and invalid trades, unauthorized
calls, settlement failures, duplicate trades, invalid energy quantities,
access control, and reentrancy protection.

## 📊 Development Roadmap

1.  Requirements, architecture and literature review
2.  Backend, database and authentication
3.  Marketplace and frontend
4.  Double-auction matching and mathematical pricing
5.  Smart contracts and automated settlement
6.  MetaMask + Ethers.js + Polygon integration
7.  Meter-data integration and automated demand/surplus detection
8.  Dynamic pricing
9.  AI-assisted forecasting/pricing
10. Security, performance testing and deployment

## 🔬 Research Contribution

GridMate focuses on combining:

-   Peer-to-peer household energy trading
-   Automated supply-demand matching
-   Double-auction pricing
-   Dynamic/AI-assisted pricing
-   Blockchain-based settlement
-   Smart-meter data integration
-   Existing grid infrastructure as the physical balancing layer

The goal is to provide a practical software architecture that moves
beyond a purely simulated P2P energy-trading model.

## 👥 Team

### Group 23 --- B.Tech Capstone

**Om Raja** --- PRN `1032233046`\
Backend & Blockchain

**Aditya Mathur** --- PRN `1032230746`\
Frontend & UI/UX

**Atisha Malwadkar** --- PRN `1032233373`\
Testing & QA

### Guides

**Dr. Sumitra Motade** --- Guide\
**Dr. Krishna Kumar Saini** --- Co-Guide

## ⚠️ Project Status

This project is being developed as an academic capstone.

Blockchain transactions are performed on a **public testnet** and do not
represent real-money energy transactions.

The platform demonstrates the technical feasibility of automated P2P
energy trading, pricing, and blockchain settlement. Real-world
electricity delivery, utility settlement, regulatory compliance, and
physical grid operation remain dependent on applicable utility and
regulatory infrastructure.

## 📄 License

This project is developed for academic and educational purposes as part
of the MIT-WPU B.Tech Capstone Project.
=======
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
>>>>>>> baabf273cb3e9df6d81167ed2e72d56371f187b8
