import argparse
import asyncio
import mimetypes
from pathlib import Path

from app.services.blob_storage import BlobStorageService


async def upload(image_path: Path) -> None:
    if not image_path.is_file():
        raise FileNotFoundError(
            f"Image not found: {image_path}"
        )

    content_type, _ = mimetypes.guess_type(image_path.name)

    if content_type is None:
        raise ValueError(
            "Unable to determine the image content type."
        )

    service = BlobStorageService()

    try:
        image_url = await service.upload_product_image(
            content=image_path.read_bytes(),
            filename=image_path.name,
            content_type=content_type,
        )

        print("Image uploaded successfully")
        print(f"Blob URL: {image_url}")
    finally:
        await service.close()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "image_path",
        type=Path,
        help="Path to a JPG, PNG or WebP image",
    )

    args = parser.parse_args()
    asyncio.run(upload(args.image_path))


if __name__ == "__main__":
    main()