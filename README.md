# SplitEase — Shared Expense Tracker

A full-stack Splitwise clone built with React, Node.js/Express, MongoDB, and JWT auth.

## Features

- **Auth** — Register, login, JWT session persistence, password change
- **Groups** — Create groups (Trip, Home, Office), invite members by email, export CSV
- **Expenses** — Add/delete expenses with equal, exact, or percentage splits; multi-payer support
- **Balances** — Debt simplification algorithm minimizes the number of payments needed
- **Settle Up** — Record payments, partial settlements supported
- **Dashboard** — Net balance summary, recent activity, group overview
- **Profile** — Avatar, currency selection (USD/EUR/GBP/AED/INR/JPY/CAD/AUD), notifications
- **Dark Mode** — System-aware, persisted in localStorage
- **Responsive** — Mobile-first with collapsible sidebar

---

## Quick Start

### Prerequisites

- Node.js 18+
- MongoDB (local or Atlas)

---

### 1. Clone & set up environment

```bash
# Copy env files
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Edit `backend/.env`:
```
PORT=5000
MONGODB_URI=mongodb://localhost:27017/splitease
JWT_SECRET=change_this_to_a_long_random_string
JWT_EXPIRES_IN=7d
NODE_ENV=development
CLIENT_URL=http://localhost:5173
```

---

### 2. Install & run the backend

```bash
cd backend
npm install
npm run dev       # uses nodemon for hot reload
# or: npm start   # production
```

Backend runs at **http://localhost:5000**

---

### 3. Install & run the frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at **http://localhost:5173** (Vite proxies `/api` → port 5000)

---

## Project Structure

```
splitease/
├── backend/
│   ├── server.js                   # Express entry point
│   └── src/
│       ├── config/db.js            # Mongoose connection
│       ├── models/
│       │   ├── User.js             # Auth + notifications
│       │   ├── Group.js            # Group + members
│       │   ├── Expense.js          # Expense + splits
│       │   └── Settlement.js       # Recorded payments
│       ├── middleware/
│       │   ├── auth.js             # JWT protect middleware
│       │   └── errorHandler.js     # Centralized error handling
│       ├── controllers/            # Business logic
│       ├── routes/                 # Express routers
│       └── utils/
│           └── debtSimplifier.js   # Minimize cash flow algorithm
└── frontend/
    └── src/
        ├── context/
        │   ├── AuthContext.jsx     # User session state
        │   └── ThemeContext.jsx    # Dark/light mode
        ├── services/api.js         # Axios instance
        ├── utils/formatters.js     # Currency, date, avatar helpers
        ├── components/
        │   ├── common/             # Layout, Modal, Avatar, Spinner
        │   ├── expenses/           # AddExpenseModal
        │   └── settlements/        # SettleUpModal
        └── pages/                  # Dashboard, Groups, GroupDetail, Profile
```

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Login |
| GET  | `/api/auth/me` | Current user |
| GET  | `/api/users/balance-summary` | Overall owe/owed |
| GET  | `/api/users/search?email=` | Find users |
| GET  | `/api/groups` | All user groups |
| POST | `/api/groups` | Create group |
| GET  | `/api/groups/:id/balances` | Simplified debts |
| GET  | `/api/groups/:id/expenses` | Group expenses |
| POST | `/api/expenses` | Add expense |
| DELETE | `/api/expenses/:id` | Soft-delete expense |
| POST | `/api/settlements` | Record payment |

---

## Debt Simplification Algorithm

Located in `backend/src/utils/debtSimplifier.js`.

Given all expenses and settlements:
1. Compute each member's **net balance** (paid − owed)
2. Separate into **creditors** (positive) and **debtors** (negative)
3. Greedily match largest debtor → largest creditor, creating one transaction per match
4. Result: minimum number of payments to settle all debts

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, Tailwind CSS, React Router v6 |
| Backend | Node.js, Express 4 |
| Database | MongoDB with Mongoose |
| Auth | JWT (jsonwebtoken) + bcryptjs |
| UI Icons | react-icons (Feather) |
| Toasts | react-hot-toast |
