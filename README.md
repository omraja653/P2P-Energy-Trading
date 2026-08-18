# GridMate --- Blockchain-Based Peer-to-Peer Energy Trading Platform

> **Capstone Project · Group 23 · MIT World Peace University ·
> 2026--2027**

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
