# P2P Energy Trading Platform - Backend

Node.js + Express backend API for the energy trading marketplace.

## Setup

```bash
npm install
npm run dev
```

Server runs on http://localhost:5000

## API Endpoints
- POST /api/auth/register
- POST /api/auth/login
- GET /api/health
- GET/POST /api/smartmeter
- GET /api/pricing
- GET/POST /api/trades
- GET/POST /api/settlements

## Database
MongoDB Atlas required. Set `MONGODB_URI` in `.env`.

## Tests
```bash
npm test
```
