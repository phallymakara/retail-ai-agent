from pathlib import Path
from uuid import uuid4

from azure.storage.blob import ContentSettings
from azure.storage.blob.aio import BlobServiceClient

from app.core.config import settings


ALLOWED_IMAGE_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}

MAX_IMAGE_SIZE = 5 * 1024 * 1024


class InvalidImageError(ValueError):
    pass


class BlobStorageService:
    def __init__(self) -> None:
        self.service = BlobServiceClient.from_connection_string(
            settings.AZURE_STORAGE_CONNECTION_STRING.get_secret_value()
        )
        self.container = self.service.get_container_client(
            settings.AZURE_STORAGE_CONTAINER_NAME
        )

    async def upload_product_image(
        self,
        *,
        content: bytes,
        filename: str,
        content_type: str,
    ) -> str:
        if content_type not in ALLOWED_IMAGE_TYPES:
            raise InvalidImageError(
                "Only JPG, PNG and WebP images are supported."
            )

        if not content:
            raise InvalidImageError("The image file is empty.")

        if len(content) > MAX_IMAGE_SIZE:
            raise InvalidImageError(
                "The image must not exceed 5 MB."
            )

        extension = ALLOWED_IMAGE_TYPES[content_type]
        safe_stem = Path(filename).stem.lower().replace(" ", "-")
        blob_name = (
            f"products/{safe_stem}-{uuid4().hex}{extension}"
        )

        blob_client = self.container.get_blob_client(blob_name)

        await blob_client.upload_blob(
            content,
            overwrite=False,
            content_settings=ContentSettings(
                content_type=content_type,
                cache_control="public, max-age=86400",
            ),
        )

        return blob_client.url

    async def delete_image(self, image_url: str) -> None:
        marker = (
            f"/{settings.AZURE_STORAGE_CONTAINER_NAME}/"
        )

        if marker not in image_url:
            raise ValueError("Invalid product image URL.")

        blob_name = image_url.split(marker, maxsplit=1)[1]
        blob_client = self.container.get_blob_client(blob_name)

        await blob_client.delete_blob(
            delete_snapshots="include",
        )

    async def close(self) -> None:
        await self.service.close()