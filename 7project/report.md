# Project Report

## 1. Project Overview

**Project Name**: Personal Finance Tracker

**Group Member**:

| Field           |      Value      |
| --------------- | --------------- |
| Name            |  B M Nafis Fuad |
| Student ID      |  274502         |
| GitHub username | nafis4139       |

**Brief Description**: 

The **Personal Finance Tracker** is a full-stack web application that allows users to track income, expenses, and budgets efficiently. Users can record transactions, categorize their spending, and view interactive dashboards for monthly summaries and budgeting insights. The platform focuses on simplicity, visual feedback, and data-driven decision-making for personal finance management.

## 2. Architecture Overview

### 2.1 System diagram
```mermaid
flowchart LR
  user((User)) --> ui[Web App]
  ui --> api[Backend API]
  api --> auth[Auth Service]
  api --> db[(Database)]
```

The system is a classic three-tier web application:
- A React app in the browser
- A Go/Gin REST API on the server
- A PostgreSQL database hosted in the cloud (Render)

The frontend talks to the backend over `/api/*` endpoints, and the backend persists all data in PostgreSQL.

### 2.2 Components and responsibilities

**01. Web App (Frontend ):** 

Handles user interface, form inputs, and dashboards. Communicates with backend via REST API.
  - Built with React + TypeScript + Vite.
  - Uses React Router to provide pages for **Login / Register**, **Dashboard**, **Transactions**, **Categories**, **Budgets**.
  - Uses a small API helper (lib/api) to call the backend with fetch.
  - Stores the JWT token in `localStorage` and attaches it to `Authorization: Bearer ...` for authenticated requests.
  - Uses Recharts to render visualizations on the dashboard, for example spending by category, monthly trends etc.
  - Built as static files and served by Nginx inside the frontend Docker container.
  - Nginx is also configured as a reverse proxy so that browser requests to `/api/` are forwarded to the backend service on Render.
   
**02. Backend API (Server):** 

Exposes endpoints for authentication, transactions, categories, and budgets. Handles validation, business logic, and database access.
  - Implemented in Go using the Gin framework.
  - Core Structure:
    - `backend/cmd/api/main.go` is the main entrypoint that loads config (port, DB_DSN, JWT secret), connects to PostgreSQL, runs database migrations.
    - `backend/internal/handler/` contains HTTP handlers for each endpoint (e.g. /api/login, /api/transactions).
    - `backend/internal/repo/` contains the database/repository layer that runs SQL queries.
    - `backend/internal/model/` contains the Go structs that represent core entities (User, Category, Transaction, Budget).
    - `backend/internal/auth/` contains password hashing, JWT creation and verification.
    - `backend/internal/platform` contains configuration, migrations, and platform utilities.
  - API responsibilities:
    - User registration and login.
    - Validating and authenticating requests using JWT middleware.
    - CRUD operations for categories, transactions, and budgets.
    - Aggregation logic for dashboard summaries (e.g. monthly totals).

**03. Auth Service (JWT):** 

Issues and validates JWT tokens for authenticated requests.
  - Uses JSON Web Tokens for stateless authentication.
  - On `/api/login`:
    - Checks the user’s email/password (using hashed passwords).
    - Returns a signed JWT containing the user ID and expiry.
  - The frontend stores this token and sends it on every request in the Authorization header.
  - A Gin middleware (JWTMiddleware) verifies the token:
    - Rejects missing/invalid tokens.
    - Extracts the user ID and attaches it to the request context.
  - All protected routes (`/api/me`, `/api/transactions`, `/api/budgets`, etc.) require a valid token.
    
**04. Database (PostgreSQL):** 

Stores persistent data such as users, transactions, categories and budgets.
  - Hosted as a managed PostgreSQL instance on Render (pft-db).
  - It Stores:
    - Users and credentials
    - User-defined categories
    - Transactions (income/expense entries)
    - Budgets per month per category
  - Accessed via pgx connection pool in Go.
  - Database schema is created and updated via migrations that run on startup.

**05. Deployment (Render + Docker):**
  - Both frontend and backend are containerized using Docker.
  - Backend service (pft-api):
    - Built from `backend/Dockerfile`.
    - Receives `DB_DSN` and `JWT_SECRET` from Render environment (via `render.yaml`).
  - Frontend service (pft-frontend):
    - Built from `frontend/Dockerfile` (Node build → Nginx serve).
    - Nginx forwards `/api/` calls to `https://pft-api-x9xf.onrender.com/api/`.
  - `render.yaml` describes:
    - The managed PostgreSQL database.
    - The backend and frontend services.
    - Environment variables and health check paths.

Each push to GitHub triggers a new build and deployment on Render.

### 2.3 Data Model
The core of the system is four entities: **User**, **Category**, **Transaction**, and **Budget**. They are modeled as relational tables in PostgreSQL and corresponding structs in Go.

- User
  - Represents an application user.
  - Attributes: id, name, email, password_hash, created_at
  - Relationships:
    - One-to-many with Category (a user defines many categories)
    - One-to-many with Transaction (a user records many transactions)
    - One-to-many with Budget (a user sets many budgets)

- Category
  - Represents a spending or income category owned by a user.
  - Attributes: id, user_id, name, type (income or expense), created_at
  - Relationships:
    - Many-to-one with User
    - One-to-many with Transaction
    - One-to-many with Budget (e.g., monthly category budgets)
   
- Transaction
  - Represents a single income or expense entry.
  - Attributes: id, user_id, category_id, amount, type (income or expense), date, description, created_at
  - Relationships:
    - Many-to-one with User
    - Many-to-one with Category

- Budget
  - Represents a user’s limit for a month, optionally for a category.
  - Attributes: id, user_id, category_id (nullable for overall budget), period_month (YYYY-MM), limit_amount, created_at
  - Relationships:
    - Many-to-one with User
    - Many-to-one with Category
   
```mermaid
erDiagram
  USER ||--o{ CATEGORY : has
  USER ||--o{ TRANSACTION : makes
  USER ||--o{ BUDGET : sets
  CATEGORY ||--o{ TRANSACTION : categorizes
  CATEGORY ||--o{ BUDGET : limits

  USER {
    int id PK
    text name
    text email
    text password_hash
    datetime created_at
  }

  CATEGORY {
    int id PK
    int user_id FK
    text name
    text type  
    datetime created_at
  }

  TRANSACTION {
    int id PK
    int user_id FK
    int category_id FK
    numeric amount
    text type  
    date date
    text description
    datetime created_at
  }

  BUDGET {
    int id PK
    int user_id FK
    int category_id FK  
    char period_month   
    numeric limit_amount
    datetime created_at
  }

```

### 2.4 System Workflow

**01. User Login**
- The user opens the web app (React on Render).
- The login form sends a `POST /api/login` request.
- Nginx forwards the request to the backend API.
- The Go backend checks the email & password in PostgreSQL.
- If correct, the backend returns a JWT token.
- The frontend saves the token and redirects the user to the dashboard.

**02. Adding a Transaction**
- The user fills in the transaction form (amount, category, date, etc.).
- Frontend sends `POST /api/transactions` with `**Authorization: Bearer <JWT>**`.
- Backend validates the JWT and gets the user ID.
- Backend inserts a new transaction into PostgreSQL using the repo layer.
- Frontend updates the list and charts.

**03. Viewing Dashboard Summary**
- The dashboard page loads and requests `/api/dashboard/summary`.
- Backend reads all transactions (and budgets) for the selected period.
- Backend calculates:
  - total income/expenses
  - category spending
  - monthly totals
- Returns the summary as JSON.
- Frontend displays charts and tables with Recharts.

**04. Managing Categories & Budgets**
- Categories and budgets follow the same flow:
  - Frontend sends create/update/delete requests.
  - Backend validates the JWT and checks if the category/budget belongs to the user.
  - Repository layer writes changes to PostgreSQL.
  - UI updates instantly.

This following sequence diagram summarizes how frontend, backend, and database work together for typical user actions.

```mermaid
sequenceDiagram
  participant U as User Browser
  participant F as Frontend (Nginx+React)
  participant B as Backend (Go/Gin)
  participant D as Database (PostgreSQL)

  U->>F: Open app URL (GET /)
  F-->>U: index.html + JS bundle (React SPA)

  U->>F: API call (e.g. POST /api/login)
  F->>B: Proxy /api/login (HTTPS)
  B->>D: SELECT user + verify password
  D-->>B: User row
  B-->>F: { token, id }
  F-->>U: JSON response

  U->>F: Authenticated API call (e.g. GET /api/dashboard/summary)
  F->>B: Proxy with Authorization: Bearer <JWT>
  B->>D: Query transactions/budgets
  D-->>B: Aggregated data
  B-->>F: Summary JSON
  F-->>U: Render charts and tables
```


### 2.5 Technologies Used

- **Backend**: Go (Gin)
- **Frontend**: React + TypeScript
- **Database**: PostgreSQ
- **Cloud Services**: Render (Frontend + Backend + Managed PostgreSQL)
- **Container Orchestration**: Docker
- **Visualization**: Recharts (for dashboards)
- **Testing**: Go testing, Playwright (E2E), Vitest (frontend unit), k6 (performance)

## 3. Prerequisites

### 3.1 System Requirements

- Operating System: Linux, macOS, Windows
- Minimum RAM: 8GB
- Storage: 10GB free space

### 3.2 Required Software

- Docker Engine 20.10+
- WSL (Ubuntu 24.04).

### 3.3 Dependencies

- Node.js 20+
- Go 1.25+
- Git
- npm

## 4. Build Instructions

### 1. Clone the Repository

```bash
git clone https://github.com/dat515-2025/Group-24.git
cd 7project/personal-finance-tracker
```

### 2. Backend Setup

```bash
cd backend
go mod tidy
```

### 3. Frontend Setup

```bash
cd ..
cd frontend
npm install

```

## 5. Deployment Instructions

### 5.1 Local Deployment

- Start Docker Desktop.

```bash
cd ..
cd deploy
docker compose -f docker-compose.dev.yml build
docker compose -f docker-compose.dev.yml up -d
```

### 5.2 Cloud Deployment (Render)

The project is deployed on Render Cloud using **render.yaml** for automated provisioning. After logging into Render, click the New button at top right corner and select **Blueprint**. From there connect the GitHub repository containing the project.

| Component        | URL                                    | 
| ---------------- | -------------------------------------- |
| Frontend         | https://pft-frontend-h0qd.onrender.com | 
| Backend API      | https://pft-api-x9xf.onrender.com      |
| Database         | Managed PostgreSQL (Render)            |

### 5.3 Verification

**Health Check**
```bash
curl https://pft-api-x9xf.onrender.com/api/healthz

```

## 6. Testing Instructions

### 6.1 Unit Tests

```bash
cd backend/
mkdir -p /tmp/dc
docker --config /tmp/dc run --rm -v "$PWD":/app -w /app golang:1.25   bash -lc 'export PATH=$PATH:/usr/local/go/bin; go test ./...'
```

### 6.2 Integration Tests

```bash
cd backend/
PG_TEST_DSN="postgres://app:app@localhost:5432/app?sslmode=disable" go test ./integration -v
```

### 6.3 End-to-End Tests

```bash
cd frontend/
npm i -D @playwright/test
npx playwright install
sudo npx playwright install-deps

E2E_BASE=http://localhost:8080 npx playwright test                    #localhost
E2E_BASE=https://pft-frontend-h0qd.onrender.com npx playwright test   #Render
```

### 6.4 Performance testing

```bash
cd ..             #root directory
mkdir -p /tmp/dc
DOCKER_CONFIG=/tmp/dc docker run --rm   -e BASE=https://pft-api-x9xf.onrender.com/api   -v "$PWD/perf":/scripts grafana/k6 run /scripts/login_k6.js
```

## 7. Usage Examples

### 7.1 Usage - via Web App

01. Open the deployed frontend:
    https://pft-frontend-h0qd.onrender.com

02. Register a new user:
    - Click **Register here** on the login page.
    - Fill in your name, email (e.g., test@example.com), and password.
    - On success, you will be redirected to the login page.

03. Login to the dashboard:
    - Enter your credentials and click Login.
    - The dashboard will display your total income, expenses, and a spending summary chart.

04. Add a new category:
    - Navigate to Categories → Add Category → e.g., “Groceries”.

05. Add a transaction:
    - Go to Transactions → Add Transaction.
    - Choose your category, enter an amount, and save it.

06. View your budget summary:
    - Click Budgets → set your monthly limit and compare against your total spending.
    - The dashboard updates dynamically with Recharts.

### 7.2 API Usage

01. Set Base URL (Render)
```bash
BASE=https://pft-api-x9xf.onrender.com/api
```

02. Register a new user (one-time; replace email if it already exists)
```bash
curl -s -X POST "$BASE/register" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test1","email":"test1@example.com","password":"secret123"}'
```

03. Login and get JWT token
```bash
TOKEN=$(curl -s -X POST "$BASE/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"test1@example.com","password":"secret123"}' | jq -r .token)
```

04. Sanity Check
```bash
echo "JWT: $TOKEN"
```

05. Check current user
```bash
curl -s "$BASE/me" -H "Authorization: Bearer $TOKEN"
```

06. Health check
```bash
curl -s "$BASE/healthz"
```

---

## 8. Presentation Video

**YouTube Link**: [\[Personal Finance Tracker\]](https://www.youtube.com/watch?v=Ke1JY3yQggc)

**Duration**: 09 minutes 03 seconds

**Video Includes**:

- [x] Project overview and architecture
- [x] Live demonstration of key features
- [x] Code walkthrough
- [x] Build and deployment showcase

## 9. Troubleshooting

### 9.1 Common Issues

#### Issue 1: HTTP 502 – Bad Gateway when Logging In

**Symptoms**:
  - The frontend website loaded correctly, but any login or register attempt returned HTTP 502 Bad Gateway.
  - The API health endpoint (/api/healthz) sometimes worked locally but not through Render.
  - Render frontend logs showed TLS or handshake errors such as
  ```bash
  SSL_do_handshake() failed (SSL routines::ssl/tls alert handshake failure)
  ```
**Cause**:
  - The Nginx configuration in the frontend container was not properly handling HTTPS connections to the backend API hosted on Render. Render uses HTTPS internally, so requests from Nginx needed SNI and trusted certificates to connect securely.

**Solution**:
  - Updated the frontend’s nginx.conf to include:
  ```bash
  proxy_ssl_server_name on;
  proxy_set_header Host pft-api-x9xf.onrender.com;
  ```
  and installed CA certificates in frontend Dockerfile with:
  ```bash 
  RUN apk add --no-cache ca-certificates && update-ca-certificates
  ```
  - Configured the proxy to forward all /api/* requests to the backend:
  ```bash
  location /api/ {
    proxy_pass https://pft-api-x9xf.onrender.com/api/;
  }
  ```
  - Redeployed both the backend (pft-api) and frontend (pft-frontend) on Render. After the update, login requests were successfully routed through Nginx and reached the API.

#### Issue 2: 500 Internal Server Error on backend startup

**Symptoms**: 
  - Render logs show db ping: connection refused or failed to connect to database.

**Cause**: 
  - The environment variable DB_DSN (database connection string) was missing or misconfigured.

**Solution**:
  - Verified DB_DSN is linked to the managed Render database in render.yaml:
  ```bash
  - key: DB_DSN
    fromDatabase:
      name: pft-db
      property: connectionString
  ```
  - Redeployed the backend service to refresh environment variables.

#### Issue 3: Dashboard not showing all yearly data

**Symptoms**: 
  - The yearly dashboard displayed only a few months (e.g., October, November), while other months with transactions were missing.

**Cause**: 
  - The backend pagination default limited /transactions API responses to 50 rows.
  
**Solution**:
  - Increased the API limit to 5000 in the frontend when calling the yearly summary:
  ```bash
  apiList<Txn>(`/transactions?from=${start}&to=${end}&limit=5000`)
  ```
  - Added explicit limit and offset handling in the Go backend (ListTransactions).

### 9.2 Debug Commands

**Local/Docker**

```bash
# Build everything
docker compose -f docker-compose.dev.yml build

# Build a single service
docker compose -f docker-compose.dev.yml build api
docker compose -f docker-compose.dev.yml build frontend

# Up in background
docker compose -f docker-compose.dev.yml up -d

# Recreate just one service (after code change)
docker compose -f docker-compose.dev.yml up -d api
docker compose -f docker-compose.dev.yml up -d frontend

# Stop + remove (incl. volumes = wipes DB!)
docker compose -f docker-compose.dev.yml down
docker compose -f docker-compose.dev.yml down -v

# What’s running
docker compose -f docker-compose.dev.yml ps

# Follow logs
docker compose -f docker-compose.dev.yml logs -f api
docker compose -f docker-compose.dev.yml logs -f frontend
docker compose -f docker-compose.dev.yml logs -f nginx
docker compose -f docker-compose.dev.yml logs -f db

# PSQL shell
docker compose -f docker-compose.dev.yml exec db psql -U app -d app

# Run a one-off SQL (example: list tables)
docker compose -f docker-compose.dev.yml exec -T db psql -U app -d app -c "\dt"

# Nginx entry (app at http://localhost:8080)
curl -i http://localhost:8080/

# API health (proxied through nginx)
curl -i http://localhost:8080/api/healthz

# Clean rebuild API only, restart it
docker compose -f docker-compose.dev.yml build --no-cache api \
  && docker compose -f docker-compose.dev.yml up -d api

# Nuke everything and start fresh (DB wiped)
docker compose -f docker-compose.dev.yml down -v \
  && docker compose -f docker-compose.dev.yml build \
  && docker compose -f docker-compose.dev.yml up -d
```

**Cloud/Render**
  - Logs: Render dashboard → select service → Logs
  - Manual redeploy: Render dashboard → Manual Deploy
  - API health (public URL):
  ```bash
  curl -i https://pft-api-x9xf.onrender.com/api/healthz
  ```

---

## 10. Progress Table

| Task/Component                                                                                                         | Assigned To | Status        | Time Spent | Difficulty | Notes       |
| ---------------------------------------------------------------------------------------------------------------------- | ----------- | ------------  | ---------- | ---------- | ----------- |
| Project Setup & Repository                                                                                             | Nafis       | ✅ Complete   | 01 hours   | Easy       |             |
| [Design Document](https://github.com/dat515-2025/Group-24/blob/main/7project/design.md)                                | Nafis       | ✅ Complete   | 08 hours   | Medium     |             |
| [Backend API Development](https://github.com/dat515-2025/Group-24/tree/main/7project/personal-finance-tracker/backend) | Nafis       | ✅ Complete   | 33 hours   | Hard       |             |
| [Database Setup & Models](https://github.com/dat515-2025/Group-24)                                                     | Nafis       | ✅ Complete   | 10 hours   | Medium     |             |
| [Frontend Development](https://github.com/dat515-2025/Group-24/tree/main/7project/personal-finance-tracker/frontend)   | Nafis       | ✅ Complete   | 16 hours   | Medium     |             |
| [Docker Configuration](https://github.com/dat515-2025/Group-24)                                                        | Nafis       | ✅ Complete   | 06 hours   | Easy       |             |
| [Cloud Deployment](https://github.com/dat515-2025/Group-24/blob/main/render.yaml)                                      | Nafis       | ✅ Complete   | 18 hours   | Hard       |             |
| [Testing Implementation](https://github.com/dat515-2025/Group-24)                                                      | Nafis       | ✅ Complete   | 09 hours   | Medium     |             |
| [Documentation](https://github.com/dat515-2025/Group-24)                                                               | Nafis       | ✅ Complete   | 16 hours   | Medium     |             |
| [Presentation Video](https://github.com/dat515-2025/Group-24)                                                          | Nafis       | ✅ Complete   | 07 hours   | Medium     |             |

## 11. Hour Sheet

[Link to the specific commit on GitHub for each contribution.](https://github.com/dat515-2025/Group-24/commits/main/?author=nafis4139)

### B M Nafis Fuad

| Date      | Activity                    | Hours   | Description                                                          |
| --------- | --------------------------- | ------- | -------------------------------------------------------------------- |
| 30 Oct    | Initial Setup               | 1       | Repository setup, project structure                                  |
| 30 Oct    | Database Design             | 4       | Designed ERD, created migrations, set up schema relations            |
| 31 Oct    | Database Design             | 6       | Designed ERD, created migrations, set up schema relations            |
| 31 Oct    | Backend Foundations         | 8       | Started Go backend, configured modules, routing structure            |
| 01 Nov    | Backend Development         | 10      | Implemented registration, login, JWT authentication, middleware      |
| 01 Nov    | Backend Development         | 5       | Added CRUD endpoints for Categories, Transactions, Budgets           |
| 02 Nov    | Backend Development         | 3       | Added CRUD endpoints for Categories, Transactions, Budgets           |
| 02 Nov    | Backend Enhancements        | 7       | Added dashboard monthly/yearly summary, validation improvements      |
| 02 Nov    | Docker Setup                | 6       | Wrote multi-stage Dockerfiles for frontend and backend               |
| 03 Nov    | Deployment (Backend)        | 6       | Configured Render backend service, fixed DB_DSN & migration issues   |
| 03 Nov    | Frontend UI Development     | 10      | Built login, register, dashboard, budgets, transactions, category UI |
| 03 Nov    | Frontend Visualization      | 2       | Added Recharts graphs, responsive layout, UX improvements            |
| 04 Nov    | Frontend Visualization      | 4       | Added Recharts graphs, responsive layout, UX improvements            |
| 04 Nov    | Integration (FE & BE)       | 6       | Connected frontend to backend API using JWT and API wrapper          |
| 04 Nov    | Deployment (Frontend)       | 7       | Nginx config, proxy to backend, fixed HTTPS issues on Render         |
| 05 Nov    | Debugging Deployment Issues | 5       | Fixed TLS proxy issue, installed CA certificates, redeployed         |
| 05 Nov    | Backend Testing             | 3       | Wrote Go unit tests, integration tests with Postgres                 |
| 05 Nov    | Frontend Testing            | 2       | Added Vitest, testing library, login/register UI tests               |
| 09 Nov    | Performance Testing         | 4       | Setup k6, wrote performance script, load tested login & healthz      |
| 11 Nov    | Documentation               | 10      | Updated design.md, report.md, testing guide                          |
| 16 Nov    | Presentation Video          | 7       | Screen recording, script writing, editing, upload to YouTube         |
| 16 Nov    | Documentation               | 6       | Updated report.md                                                    |
| **Total** |                             | **122** |                                                                      |

### Group Total: 122 hours

---

## 12. Final Reflection

### What I Learned

I became proficient in Go backend development, DevOps (Docker + Render), and end-to-end testing workflows. This project strengthened my problem-solving, debugging, and cloud deployment skills.

### Challenges Faced
  - Frontend–Backend Proxy and HTTPS Handshake Failures
  - Partial Dashboard Data and Pagination Issues
  - Backend Connectivity & Environment Variables Issues
  - Adapting test frameworks (Playwright, Vitest, k6)

### If I Did This Again

I would integrate CI/CD GitHub Actions earlier to automate testing and deployment. I would also improve UI design consistency and add budgeting analytics.

### Individual Growth

I became proficient in Go backend development, DevOps (Docker + Render), and end-to-end testing workflows. This project strengthened my problem-solving, debugging, and cloud deployment skills.

---

**Report Completion Date**: 16 November 2025
**Last Updated**: 16 November 2025
