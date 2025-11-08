# Design Document


| Field          | Value                        |
| -------------- | ---------------------------- |
| Project Name   |  Personal Finance Tracker    |
| Team Members   |  B M Nafis Fuad              |
| Repository URL |                              |
| Version        | v0.1                         |
| Last Updated   | 2025-10-30                   |

---

## 1. Overview
The **Personal Finance Tracker** is a web-based application that helps users manage and analyze their personal finances. It allows users to record their income and expenses, categorize transactions, and view visual summaries of their spending habits.

### Problem Statement
Many people struggle to monitor and control their daily expenses. This project provides an easy-to-use platform for tracking finances, identifying spending patterns, and setting simple budget goals.

### Target Users
- Students and young professionals seeking to manage personal expenses.
- Individuals wanting lightweight, secure budget tracking accessible from any device.

### Primary Objectives
- Implement user registration and authentication  
- Enable manual transaction entry with categorization  
- Provide spending analytics and budget tracking  
- Offer persistent cloud-based data storage  
- Deliver a simple, responsive web interface 

### Non-Goals
- No automated bank account integration or payment processing.
- No complex investment or tax features.

### Key Features
- User registration and login (JWT-based auth).
- CRUD operations for transactions and categories.
- Monthly budget overview and spending analytics dashboard.
- Responsive React frontend with simple visualization.
- Cloud deployment with persistent PostgreSQL storage.

## 2. Architecture
### 2.1 System diagram
```mermaid
flowchart LR
  user((User)) --> ui[Web App]
  ui --> api[Backend API]
  api --> auth[Auth Service]
  api --> db[(Database)]
  api --> cache[(Cache)]
```
**Components and responsibilities:**  
- **Web App:**  
  Handles user interface, form inputs, and dashboards. Communicates with backend via REST API.
   
- **Backend API:**  
  Exposes endpoints for authentication, transactions, categories, and budgets. Handles validation, business logic, and database access.

- **Auth Service:**  
  Issues and validates JWT tokens for authenticated requests.
    
- **Database:**  
  Stores persistent data such as users, transactions, categories and budgets.
 
- **Cache:**  
  Used for caching frequently accessed data and storing sessions.

**Data flow:**  
1. User actions in the web app trigger API requests.  
2. API authenticates via Auth Service and reads/writes from Database.  
3. Cache accelerates access to recent analytics to reduce DB load.  
4. Responses returned to Web App for display.

**State management:**  
- Persistent data in PostgreSQL (users, transactions, budgets).  
- Cached analytics in Redis (cached summaries, sessions).  
- Frontend uses local storage for session tokens  

### 2.2 Data model
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



### 2.3 APIs (REST)
### **key Endpoints:** 
**1. Auth**

| Method | Endpoint | Description |
|--------|-----------|-------------|
| **POST** | `/api/auth/register` | Register a new user account (`name`, `email`, `password`) |
| **POST** | `/api/auth/login` | Authenticate and issue a JWT (`email`, `password`) |
| **GET** | `/api/me` | Retrieve current user profile (requires JWT) |

**2. Categories**

| Method | Endpoint | Description |
|--------|-----------|-------------|
| **GET** | `/api/categories` | List all categories belonging to the authenticated user |
| **POST** | `/api/categories` | Create a new category (`name`, `type` — income/expense) |
| **PUT** | `/api/categories/:id` | Update an existing category name or type |
| **DELETE** | `/api/categories/:id` | Delete a category (reassign or set NULL on related items) |

**3. Transactions**

| Method | Endpoint | Description |
|--------|-----------|-------------|
| **GET** | `/api/transactions?from=&to=&category_id=&type=&page=&limit=` | Retrieve filtered transaction list (by date, category, type, pagination) |
| **POST** | `/api/transactions` | Create a new transaction (`amount`, `type`, `category_id`, `date`, `description`) |
| **PUT** | `/api/transactions/:id` | Update an existing transaction |
| **DELETE** | `/api/transactions/:id` | Delete a transaction record |

**4. Budgets**

| Method | Endpoint | Description |
|--------|-----------|-------------|
| **GET** | `/api/budgets?month=YYYY-MM` | Get budgets for the specified month |
| **POST** | `/api/budgets` | Create a budget (`category_id` \| null, `period_month`, `limit_amount`) |
| **PUT** | `/api/budgets/:id` | Update a budget entry |
| **DELETE** | `/api/budgets/:id` | Delete a budget record |

**5. Dashboard / Reports**

| Method | Endpoint | Description |
|--------|-----------|-------------|
| **GET** | `/api/dashboard/summary?month=YYYY-MM` | Retrieve summary of income, expenses, and budgets for a month |
| **GET** | `/api/healthz` | Health check endpoint (used for uptime/monitoring) |

---

## 3. Technologies

| Technology / Service     | Role                         | Why chosen (brief)                | Alternatives |
|--------------------------|------------------------------|-----------------------------------|--------------|
| **Go (Gin/Fiber)**       | Backend API                  | Fast, typed, simple handlers      | Node, Flask  |
| **React + TypeScript**   | Web App UI                   | Familiar, typed components        | Vue, Svelte  |
| **PostgreSQL**           | Database                     | Strong relational + constraints   | MySQL        |
| **Redis**                | Cache                        | Fast cached summaries/sessions    | Memcached    |
| **Docker + Compose**     | Dev/Prod containers          | Reproducible env                  | Podman       |
| **Render/Railway/Fly.io**| Hosting, managed Postgres    | Simple deploys, free tiers        | AWS/GCP/Azure|
| **Recharts/Chart.js**    | Charts                       | Quick, lightweight visuals        | D3           |
| **GitHub Actions**       | CI/CD                        | Build/test/deploy on push         | Jenkins      |

## 4. Deployment

**Environment:**  
- **Development:** Docker Compose locally  
- **Production:** Hosted on Render/Railway with managed PostgreSQL  

```mermaid
flowchart TB
  user((User)) --> web[React Frontend]
  web --> api[Backend Go API]
  api --> db[(Managed PostgreSQL)]
  api --> cache[(Redis)]
```

**Runtime platform:** Docker containers (frontend, backend, db)

**Configuration & secrets:**  
- Managed with `.env` files (JWT secret, DB credentials)  
- Stored securely in cloud environment variables  

**Build & release:**  
- GitHub Actions triggers build/test on push  
- Automatic deployment on main branch updates  

**Deployment steps:**  
1. Build Docker images for frontend and backend  
2. Push images to registry  
3. Deploy using Docker Compose or Render service configuration  
4. Connect backend to managed PostgreSQL instance  

**Scaling strategy:**  
- Stateless API allows multiple backend replicas  
- Managed DB handles automatic vertical scaling  
- Redis cache reduces database load 

---

## Optional Sections
### Security
- JWT-based authentication  
- Password hashing with bcrypt  
- HTTPS enforced by cloud provider  
- Environment-based secret management

### Scalability
- Redis caching for analytics  
- Load balancing through cloud platform 

### Monitoring & Logging
- `/healthz` endpoint for liveness checks  
- Cloud provider logging dashboard