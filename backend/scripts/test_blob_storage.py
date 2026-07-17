import asyncio

from azure.storage.blob.aio import BlobServiceClient

from app.core.config import settings


async def main() -> None:
    service = BlobServiceClient.from_connection_string(
        settings.AZURE_STORAGE_CONNECTION_STRING.get_secret_value()
    )

    try:
        container = service.get_container_client(
            settings.AZURE_STORAGE_CONTAINER_NAME
        )

        properties = await container.get_container_properties()

        print("Azure Blob Storage connection successful")
        print(f"Container: {container.container_name}")
        print(f"Last modified: {properties.last_modified}")
    finally:
        await service.close()


if __name__ == "__main__":
    asyncio.run(main())