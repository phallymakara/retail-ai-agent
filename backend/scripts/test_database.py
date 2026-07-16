import asyncio

from sqlalchemy import text

from app.db.session import AsyncSessionFactory, close_database


async def main() -> None:
    try:
        async with AsyncSessionFactory() as session:
            result = await session.execute(
                text(
                    """
                    SELECT
                        current_database() AS database_name,
                        current_user AS database_user,
                        version() AS postgres_version
                    """
                )
            )

            row = result.one()

            print("Neon connection successful")
            print(f"Database: {row.database_name}")
            print(f"User: {row.database_user}")
            print(
                "PostgreSQL:",
                row.postgres_version.split(",")[0],
            )
    finally:
        await close_database()


if __name__ == "__main__":
    asyncio.run(main())