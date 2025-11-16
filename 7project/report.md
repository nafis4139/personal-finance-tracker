# Project Report

## Project Overview

**Project Name**: Personal Finance Tracker

**Group Member**:

| Field           |      Value      |
| --------------- | --------------- |
| Name            |  B M Nafis Fuad |
| Student ID      |  274502         |
| GitHub username | nafis4139       |

**Brief Description**: 

The **Personal Finance Tracker** is a full-stack web application that allows users to track income, expenses, and budgets efficiently. Users can record transactions, categorize their spending, and view interactive dashboards for monthly summaries and budgeting insights. The platform focuses on simplicity, visual feedback, and data-driven decision-making for personal finance management.

## Architecture Overview

### High-Level Architecture

```mermaid
flowchart LR
  user((User)) --> ui[Web App]
  ui --> api[Backend API]
  api --> auth[Auth Service]
  api --> db[(Database)]
```

### Components

- **Web App (Frontend):**  
  Built with React and TypeScript. It provides a responsive, user-friendly interface for login, category management, budgets, and transaction tracking. The UI includes data visualization using Recharts and supports persistent sessions with JWT tokens.
   
- **Backend API (Server):**  
  Implemented in Go using the Gin framework. It handles authentication, data validation, REST endpoints for categories, transactions, and budgets, and interacts with PostgreSQL via a repository layer.

- **Auth Service (JWT):**  
  Implements secure token-based authentication for all API routes. Tokens are validated for each request to ensure user-level data protection.
    
- **Database (PostgreSQL):**  
  Stores users, categories, budgets, and transactions in normalized relational tables, deployed using Render’s managed PostgreSQL service.

- **Deployment (Render + Docker):**  
  Both frontend and backend are containerized using Docker and deployed to Render Cloud, using a managed database and continuous deployment from GitHub.

### Technologies Used

- **Backend**: Go (Gin)
- **Frontend**: React + TypeScript
- **Database**: PostgreSQ
- **Cloud Services**: Render (Frontend + Backend + Managed PostgreSQL)
- **Container Orchestration**: Docker
- **Visualization**: Recharts (for dashboards)
- **Testing**: Go testing, Playwright (E2E), Vitest (frontend unit), k6 (performance)

## Prerequisites

### System Requirements

- Operating System: Linux, macOS, Windows
- Minimum RAM: 8GB
- Storage: 10GB free space

### Required Software

- Docker Engine 20.10+
- Node.js 18+
- Go 1.25+
- Git
- npm
- WSL (Ubuntu 24.04)

## Build Instructions

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

## Deployment Instructions

### Local Deployment

- Start Docker Desktop.

```bash
cd ..
cd deploy
docker compose -f docker-compose.dev.yml build
docker compose -f docker-compose.dev.yml up -d
```

### Cloud Deployment (Render)

The project is deployed on Render Cloud using **render.yaml** for automated provisioning. After logging into Render, click the New button at top right corner and select **Blueprint**. From there connect the GitHub repository containing the project.

| Component        | URL                                    | 
| ---------------- | -------------------------------------- |
| Frontend         | https://pft-frontend-h0qd.onrender.com | 
| Backend API      | https://pft-api-x9xf.onrender.com      |
| Database         | Managed PostgreSQL (Render)            |

### Verification

**Health Check**
```bash
curl https://pft-api-x9xf.onrender.com/api/healthz

```

## Testing Instructions

### Unit Tests

```bash
cd backend/
mkdir -p /tmp/dc
docker --config /tmp/dc run --rm -v "$PWD":/app -w /app golang:1.25   bash -lc 'export PATH=$PATH:/usr/local/go/bin; go test ./...'
```

### Integration Tests

```bash
cd backend/
PG_TEST_DSN="postgres://app:app@localhost:5432/app?sslmode=disable" go test ./integration -v
```

### End-to-End Tests

```bash
cd frontend/
npm i -D @playwright/test
npx playwright install
sudo npx playwright install-deps

E2E_BASE=http://localhost:8080 npx playwright test                    #localhost
E2E_BASE=https://pft-frontend-h0qd.onrender.com npx playwright test   #Render
```

### Performance testing

```bash
cd ..             #root directory
mkdir -p /tmp/dc
DOCKER_CONFIG=/tmp/dc docker run --rm   -e BASE=https://pft-api-x9xf.onrender.com/api   -v "$PWD/perf":/scripts grafana/k6 run /scripts/login_k6.js
```

## Usage Examples

### Usage - via Web App

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

### API Usage

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

## Presentation Video

**YouTube Link**: [\[Personal Finance Tracker\]](https://www.youtube.com/watch?v=Ke1JY3yQggc)

**Duration**: 09 minutes 03 seconds

**Video Includes**:

- [x] Project overview and architecture
- [x] Live demonstration of key features
- [x] Code walkthrough
- [x] Build and deployment showcase

## Troubleshooting

### Common Issues

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

### Debug Commands

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

## Progress Table

| Task/Component                                                      | Assigned To | Status        | Time Spent | Difficulty | Notes       |
| ------------------------------------------------------------------- | ----------- | ------------- | ---------- | ---------- | ----------- |
| Project Setup & Repository                                          | Nafis      | ✅ Complete    | 1 hours  | Easy     |  |
| [Design Document](https://github.com/dat515-2025/Group-24/blob/main/7project/design.md)         | Nafis      | ✅ Complete    | 8 hours  | Medium       |  |
| [Backend API Development](https://github.com/dat515-2025/Group-24/tree/main/7project/personal-finance-tracker/backend) | Nafis     | ✅ Complete    | 32 hours  | Hard       |  |
| [Database Setup & Models](https://github.com/dat515-2025/Group-24) | Nafis      | ✅ Complete    | 10 hours  | Medium     |  |
| [Frontend Development](https://github.com/dat515-2025/Group-24/tree/main/7project/personal-finance-tracker/frontend)    | Nafis      | ✅ Complete | 16 hours  | Medium     |  |
| [Docker Configuration](https://github.com/dat515-2025/Group-24)    | Nafis      | ✅ Complete    | 12 hours  | Easy       |  |
| [Cloud Deployment](https://github.com/dat515-2025/Group-24/blob/main/render.yaml)        | Nafis      | ✅ Complete    | 15 hours  | Hard       |  |
| [Testing Implementation](https://github.com/dat515-2025/Group-24)  | Nafis      | ✅ Complete     | 5 hours  | Medium     |  |
| [Documentation](https://github.com/dat515-2025/Group-24)           | Nafis      | ✅ Complete    | 6 hours | Easy       |  |
| [Presentation Video](https://github.com/dat515-2025/Group-24)      | Nafis      | ⏳ Pending    | X hours  | Medium     |  |

**Legend**: ✅ Complete | 🔄 In Progress | ⏳ Pending | ❌ Not Started

## Hour Sheet

[Link to the specific commit on GitHub for each contribution.](https://github.com/dat515-2025/Group-24/commits/main/?author=nafis4139)

### B M Nafis Fuad

| Date      | Activity                 | Hours      | Description                         |
| --------- | ------------------------ | ---------- | ----------------------------------- |
| 30 Oct    | Initial Setup            | 01      | Repository setup, project structure |
| 08 Nov    | Backend Development      | 32      | Implemented user authentication     |
| 09 Nov    | Testing                  | 02      | Unit tests for API endpoints        |
| 08 Nov    | Documentation            | 10      | Updated README and design doc       |
| 08 Nov    | Frontend Development     | 16      | Created user interface mockups            |
| 08 Nov    | Integration              | 04      | Connected frontend to backend API         |
| 08 Nov    | Deployment               | 15      | Docker configuration and cloud deployment |
| 09 Nov    | Testing                  | 03      | End-to-end testing                        |
| 08 Nov    | Database Design          | 10      | Schema design and implementation |
| 08 Nov    | Cloud Configuration      | 15      | Render setup and configuration  |
|           | Performance Optimization |         | Caching and query optimization   |
|           | Monitoring               |         | Logging and monitoring setup     |
| **Total** |                          | **108** |                                     |


### Group Total: 108 hours

---

## Final Reflection

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

**Report Completion Date**: 09 November 2025
**Last Updated**: 09 November 2025
