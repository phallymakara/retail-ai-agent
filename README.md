# Retail AI Agent

An AI-powered retail product assistant and inventory manager. This project features a modern React + TypeScript + Vite frontend that hosts an interactive conversational chat page with the shopping assistant (**Dara**), backed by a robust FastAPI + SQLAlchemy + PostgreSQL backend integration.

---

## 🌟 Key Features

* **Conversational AI Assistant (Dara):** Provides natural language shopping assistance, product search, inventory inquiries, and promotion searches (supports English and Khmer).
* **Real-time Inventory Checks:** Validates product availability and stock levels across different retail branches.
* **Interactive Shopping Cart:** Automatically manages added products, accumulated quantities, and visualizes stock alerts (`In Stock`, `Low Stock`, `Out of Stock`).
* **Order Management System:** Handles order validation, processes line items, reserves quantities from inventory, and saves orders to the database.
* **Database Migrations:** Managed with Alembic for consistent and version-controlled schema definitions.

---

## 📂 Project Structure

```text
retail-ai-agent/
├── .gitignore               # Root git ignore rules (OS, IDEs, Venv, Node modules)
├── README.md                # Main project documentation
├── backend/                 # FastAPI Backend Application
│   ├── .env.example         # Example environment variables file
│   ├── pyproject.toml       # Python package dependencies and metadata
│   ├── alembic.ini          # Alembic database migration config
│   ├── app/
│   │   ├── main.py          # Application entrypoint (FastAPI, CORS, Lifespan)
│   │   ├── agents/          # AI Agent definitions and tools
│   │   │   ├── retail_agent.py
│   │   │   └── providers/
│   │   ├── api/             # API Router and endpoint routes
│   │   │   └── routes/
│   │   │       ├── chat.py
│   │   │       └── orders.py
│   │   ├── core/            # Configs and database session managers
│   │   ├── models/          # SQLAlchemy Database Models (Store, Product, Order)
│   │   │   ├── retail.py
│   │   │   └── order.py
│   │   ├── schemas/         # Pydantic Schemas (Chat, Order request/response)
│   │   └── services/        # Business Logic (Order creation, Inventory locking)
│   │       └── order_service.py
│   ├── migrations/          # Alembic database migration files
│   └── scripts/             # Seeding and testing helper scripts
│       ├── seed_retail_data.py
│       ├── test_order_service.py
│       └── test_retail_agent.py
└── frontend/                # React Frontend Application
    ├── package.json         # Node.js project manifests and scripts
    ├── vite.config.ts       # Vite bundler configuration
    ├── src/
    │   ├── main.tsx         # Frontend render entrypoint
    │   ├── App.tsx          # Main React Application shell and state
    │   ├── App.css          # Application layout styles
    │   ├── components/      # Reusable UI components (Product Cards)
    │   ├── services/        # API service clients (Chat, Orders)
    │   └── types/           # TypeScript Type/Interface definitions
```

---

## 🛠️ Prerequisites

* **Python 3.10+** (venv or uv recommended)
* **Node.js 18+** (npm or yarn)
* **PostgreSQL** (e.g., Neon Postgres)
* **Azure OpenAI** or Microsoft Foundry API Key

---

## ⚙️ Backend Installation & Setup (Windows)

1. **Navigate to the Backend folder:**
   ```powershell
   cd backend
   ```

2. **Set up a Virtual Environment:**
   ```powershell
   python -m venv .venv
   .venv\Scripts\activate
   ```

3. **Install Dependencies:**
   If using `uv` (recommended):
   ```powershell
   uv pip install -e .
   ```
   Or standard `pip`:
   ```powershell
   pip install -e .
   ```

4. **Configure Environment Variables:**
   Create a `.env` file in the `backend\` directory by copying `.env.example`:
   ```powershell
   copy .env.example .env
   ```
   Fill in your actual secrets in `.env`:
   * `OPENAI_API_KEY`
   * `OPENAI_BASE_URL`
   * `AZURE_AI_MODEL_DEPLOYMENT_NAME`
   * `DATABASE_URL` (PostgreSQL Connection URI)

5. **Run Database Migrations:**
   Ensure your database is reachable, then run Alembic migrations to create tables:
   ```powershell
   alembic upgrade head
   ```

6. **Seed Initial Database Data:**
   Ensure your database is seeded:
   ```powershell
   python scripts/seed_retail_data.py
   ```

7. **Start the FastAPI Server:**
   ```powershell
   uvicorn app.main:app --reload
   ```
   The backend API docs will be active at [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs).

---

## 💻 Frontend Installation & Setup (Windows)

1. **Navigate to the Frontend folder:**
   ```powershell
   cd frontend
   ```

2. **Install Package Dependencies:**
   ```powershell
   npm install
   ```

3. **Configure API URL (Optional):**
   By default, Vite reads `VITE_API_BASE_URL` from `frontend\.env`. You can override it via `.env.local`:
   ```env
   VITE_API_BASE_URL=http://localhost:8000
   ```

4. **Start the Development Server:**
   ```powershell
   npm run dev
   ```
   Open your browser to the local address displayed in the terminal (usually [http://localhost:5173](http://localhost:5173)).

5. **Build for Production:**
   Verify that TypeScript builds successfully without errors:
   ```powershell
   npm run build
   ```

---

## 🧪 Testing and Verification (Windows)

A set of diagnostic scripts is included in the `backend\scripts\` folder to verify system integrity:

* **Test Retail Agent & Tools:**
  ```powershell
  python scripts/test_retail_agent.py
  ```
* **Test Order Creation and Transaction Rollbacks:**
  ```powershell
  python scripts/test_order_service.py
  ```
* **Check database connections:**
  ```powershell
  python scripts/test_database.py
  ```
