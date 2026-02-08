# Treasure Box 💰

A secure investment and utility payment platform built with React, Node.js, Express, and PostgreSQL.

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS
- **Backend**: Node.js + Express + Prisma ORM
- **Database**: PostgreSQL
- **Auth**: JWT (JSON Web Tokens)

## Project Structure

```
├── client/              # React frontend
│   ├── src/
│   │   ├── api/         # API client (axios)
│   │   ├── components/  # Reusable UI components
│   │   ├── contexts/    # React contexts (Auth, Toast)
│   │   └── pages/       # Page components
│   └── ...
├── server/              # Express backend
│   ├── prisma/          # Database schema
│   └── src/
│       ├── middleware/  # Auth, error handling
│       └── routes/      # API endpoints
└── ...
```

## Features

- 🔐 **Secure Authentication** - JWT-based auth with bcrypt password hashing
- 💰 **Investment Plans** - Multiple duration plans with automatic maturity processing
- 💳 **Wallet Management** - Deposit, withdraw, and track transactions
- 📱 **Utility Payments** - Airtime, data, electricity, cable TV
- 👥 **Referral System** - Earn bonuses by referring friends
- 👨‍💼 **Admin Dashboard** - User management, withdrawal approvals, audit logs
- 📊 **Real-time Notifications** - Stay updated on transactions

## Deployment to Railway

### 1. Create Railway Project
- Go to [railway.app](https://railway.app)
- Create a new project
- Add a PostgreSQL database

### 2. Connect GitHub Repository
- Push this code to GitHub
- Connect the repository to Railway

### 3. Set Environment Variables
In Railway dashboard, set these variables:

```
DATABASE_URL=<auto-provided by Railway PostgreSQL>
JWT_SECRET=your-super-secret-jwt-key
CRON_SECRET=your-cron-secret
NODE_ENV=production
```

### 4. Deploy
Railway will automatically:
- Install dependencies
- Build the frontend
- Build the backend
- Run Prisma migrations
- Start the server

## Local Development

### Prerequisites
- Node.js 18+
- PostgreSQL (or use Docker)

### Setup

```bash
# Install dependencies
npm run install:all

# Setup database (in server/)
cd server
cp .env.example .env
# Edit .env with your DATABASE_URL
npx prisma migrate dev

# Run both client and server
cd ..
npm run dev
```

## API Endpoints

### Auth
- `POST /api/auth/register` - Create account
- `POST /api/auth/login` - Login

### User
- `GET /api/users/me` - Get profile
- `PATCH /api/users/me` - Update profile
- `PUT /api/users/me/bank` - Update bank details

### Transactions
- `GET /api/transactions` - Get user transactions
- `POST /api/transactions/deposit` - Request deposit
- `POST /api/transactions/withdraw` - Request withdrawal

### Investments
- `GET /api/investments` - Get user investments
- `POST /api/investments` - Create investment

### Admin
- `GET /api/admin/stats` - Dashboard stats
- `GET /api/admin/users` - List all users
- `GET /api/admin/withdrawals/pending` - Pending withdrawals
- `POST /api/admin/withdrawals/:id/approve` - Approve withdrawal
- `POST /api/admin/withdrawals/:id/reject` - Reject withdrawal

## License

MIT
