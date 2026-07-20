from typing import Annotated
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db_session
from app.services import retail_catalog

router = APIRouter(
    prefix="/api/v1/catalog",
    tags=["Catalog"],
)

DatabaseSession = Annotated[
    AsyncSession,
    Depends(get_db_session),
]


@router.get("/products")
async def get_products(
    session: DatabaseSession,
    query: str | None = Query(default=None),
    category: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=100),
):
    return await retail_catalog.search_products(
        session,
        query=query,
        category=category,
        limit=limit,
    )
