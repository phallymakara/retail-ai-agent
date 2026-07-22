from contextlib import asynccontextmanager
from collections.abc import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.orders import router as orders_router
from app.api.routes.chat import router as chat_router
from app.api.routes.catalog import router as catalog_router
from app.api.routes.inventory import router as inventory_router

from app.core.config import settings
from app.db.session import close_database, init_db


@asynccontextmanager
async def lifespan(
    app: FastAPI,
) -> AsyncIterator[None]:
    await init_db()
    yield
    await close_database()


app = FastAPI(
    title="Retail AI Agent API",
    description=(
        "AI-powered retail product and inventory assistant."
    ),
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat_router)
app.include_router(catalog_router)
app.include_router(orders_router)
app.include_router(inventory_router)


@app.get(
    "/health",
    tags=["System"],
)
async def health_check() -> dict[str, str]:
    return {
        "status": "healthy",
        "service": "retail-ai-agent",
    }