import asyncio
import mimetypes
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from pathlib import Path

from sqlalchemy import select

from app.db.session import AsyncSessionFactory, close_database
from app.models import Inventory, Product, Promotion, Store
from app.services.blob_storage import BlobStorageService


BASE_DIR = Path(__file__).resolve().parent.parent
PRODUCT_IMAGE_DIR = BASE_DIR / "seed_assets" / "products"


STORES = [
    {
        "code": "PP-BKK1",
        "name": "Phnom Penh BKK1 Store",
        "address": "Boeung Keng Kang 1, Phnom Penh",
        "phone": "023 900 101",
    },
    {
        "code": "PP-TTP",
        "name": "Phnom Penh Toul Tom Poung Store",
        "address": "Toul Tom Poung, Phnom Penh",
        "phone": "023 900 102",
    },
    {
        "code": "SR-CENTRAL",
        "name": "Siem Reap Central Store",
        "address": "Central Siem Reap",
        "phone": "063 900 103",
    },
]


PRODUCTS = [
    {
        "sku": "RICE-JASMINE-5KG",
        "name": "Cambodian Jasmine Rice 5kg",
        "name_km": "អង្ករផ្កាម្លិះខ្មែរ ៥គីឡូក្រាម",
        "category": "Rice and Grains",
        "description": "Premium Cambodian jasmine rice.",
        "price": Decimal("8.50"),
        "currency": "USD",
        "brand": "Khmer Harvest",
        "image_filename": "rice-jasmine-5kg.png",
    },
    {
        "sku": "OIL-SOY-1L",
        "name": "Soybean Cooking Oil 1L",
        "name_km": "ប្រេងឆាសណ្តែកសៀង ១លីត្រ",
        "category": "Cooking Essentials",
        "description": "Refined soybean cooking oil.",
        "price": Decimal("2.80"),
        "currency": "USD",
        "brand": "Healthy Chef",
        "image_filename": "soybean-oil-1l.png",
    },
    {
        "sku": "FISH-SAUCE-700ML",
        "name": "Fish Sauce 700ml",
        "name_km": "ទឹកត្រី ៧០០មីលីលីត្រ",
        "category": "Sauces and Condiments",
        "description": "Traditional fish sauce for everyday cooking.",
        "price": Decimal("1.60"),
        "currency": "USD",
        "brand": "Three Fish",
        "image_filename": "fish-sauce-700ml.png",
    },
    {
        "sku": "NOODLE-CHICKEN-6PK",
        "name": "Chicken Instant Noodles 6 Pack",
        "name_km": "មីកញ្ចប់រសជាតិសាច់មាន់ ៦កញ្ចប់",
        "category": "Instant Food",
        "description": "Six packs of chicken-flavoured noodles.",
        "price": Decimal("2.20"),
        "currency": "USD",
        "brand": "Mama",
        "image_filename": "chicken-noodles-6pk.png",
    },
    {
        "sku": "WATER-1500ML",
        "name": "Drinking Water 1.5L",
        "name_km": "ទឹកបរិសុទ្ធ ១.៥លីត្រ",
        "category": "Beverages",
        "description": "Purified bottled drinking water.",
        "price": Decimal("0.60"),
        "currency": "USD",
        "brand": "Cambodia Water",
        "image_filename": "drinking-water-1500ml.png",
    },
    {
        "sku": "MILK-UHT-1L",
        "name": "UHT Fresh Milk 1L",
        "name_km": "ទឹកដោះគោស្រស់ UHT ១លីត្រ",
        "category": "Dairy",
        "description": "Full-cream UHT milk.",
        "price": Decimal("2.30"),
        "currency": "USD",
        "brand": "Angkor Milk",
        "image_filename": "uht-milk-1l.png",
    },
    {
        "sku": "COFFEE-3IN1-20PK",
        "name": "3-in-1 Coffee 20 Pack",
        "name_km": "កាហ្វេ ៣ក្នុង១ ២០កញ្ចប់",
        "category": "Beverages",
        "description": "Instant coffee with sugar and creamer.",
        "price": Decimal("4.50"),
        "currency": "USD",
        "brand": "Khmer Coffee",
        "image_filename": "coffee-3in1-20pk.png",
    },
    {
        "sku": "SOAP-ANTIBACTERIAL",
        "name": "Antibacterial Bar Soap",
        "name_km": "សាប៊ូដុំកម្ចាត់បាក់តេរី",
        "category": "Personal Care",
        "description": "Antibacterial soap for daily use.",
        "price": Decimal("1.10"),
        "currency": "USD",
        "brand": "Clean Plus",
        "image_filename": "antibacterial-soap.png",
    },
]


STOCK = {
    "PP-BKK1": {
        "RICE-JASMINE-5KG": 35,
        "OIL-SOY-1L": 50,
        "FISH-SAUCE-700ML": 42,
        "NOODLE-CHICKEN-6PK": 75,
        "WATER-1500ML": 120,
        "MILK-UHT-1L": 28,
        "COFFEE-3IN1-20PK": 20,
        "SOAP-ANTIBACTERIAL": 45,
    },
    "PP-TTP": {
        "RICE-JASMINE-5KG": 20,
        "OIL-SOY-1L": 32,
        "FISH-SAUCE-700ML": 25,
        "NOODLE-CHICKEN-6PK": 54,
        "WATER-1500ML": 90,
        "MILK-UHT-1L": 18,
        "COFFEE-3IN1-20PK": 12,
        "SOAP-ANTIBACTERIAL": 30,
    },
    "SR-CENTRAL": {
        "RICE-JASMINE-5KG": 15,
        "OIL-SOY-1L": 24,
        "FISH-SAUCE-700ML": 19,
        "NOODLE-CHICKEN-6PK": 40,
        "WATER-1500ML": 80,
        "MILK-UHT-1L": 4,
        "COFFEE-3IN1-20PK": 8,
        "SOAP-ANTIBACTERIAL": 22,
    },
}


async def upload_product_image(
    blob_service: BlobStorageService,
    product: Product,
    image_filename: str,
) -> bool:
    if product.image_url:
        return False

    image_path = PRODUCT_IMAGE_DIR / image_filename

    if not image_path.is_file():
        print(
            f"Warning: image missing for {product.sku}: "
            f"{image_path}"
        )
        return False

    content_type, _ = mimetypes.guess_type(image_path.name)

    if content_type is None:
        print(
            f"Warning: unknown image type for {image_path.name}"
        )
        return False

    product.image_url = await blob_service.upload_product_image(
        content=image_path.read_bytes(),
        filename=image_path.name,
        content_type=content_type,
    )

    print(f"Uploaded image for {product.sku}")
    return True


async def seed() -> None:
    blob_service = BlobStorageService()
    uploaded_images = 0

    try:
        async with AsyncSessionFactory() as session:
            store_map: dict[str, Store] = {}

            for store_data in STORES:
                store = await session.scalar(
                    select(Store).where(
                        Store.code == store_data["code"]
                    )
                )

                if store is None:
                    store = Store(**store_data)
                    session.add(store)
                    await session.flush()
                else:
                    for field, value in store_data.items():
                        setattr(store, field, value)

                store_map[store.code] = store

            product_map: dict[str, Product] = {}

            for product_seed in PRODUCTS:
                product_data = {
                    key: value
                    for key, value in product_seed.items()
                    if key != "image_filename"
                }

                product = await session.scalar(
                    select(Product).where(
                        Product.sku == product_data["sku"]
                    )
                )

                if product is None:
                    product = Product(**product_data)
                    session.add(product)
                    await session.flush()
                else:
                    for field, value in product_data.items():
                        setattr(product, field, value)

                image_uploaded = await upload_product_image(
                    blob_service=blob_service,
                    product=product,
                    image_filename=product_seed[
                        "image_filename"
                    ],
                )

                if image_uploaded:
                    uploaded_images += 1

                product_map[product.sku] = product

            for store_code, stock_items in STOCK.items():
                store = store_map[store_code]

                for sku, quantity in stock_items.items():
                    product = product_map[sku]

                    inventory = await session.scalar(
                        select(Inventory).where(
                            Inventory.store_id == store.id,
                            Inventory.product_id == product.id,
                        )
                    )

                    if inventory is None:
                        inventory = Inventory(
                            store_id=store.id,
                            product_id=product.id,
                            quantity=quantity,
                            reserved_quantity=0,
                            reorder_level=5,
                        )
                        session.add(inventory)
                    else:
                        inventory.quantity = quantity

            product = product_map["COFFEE-3IN1-20PK"]
            promotion_name = "Coffee Special 10% Off"

            promotion = await session.scalar(
                select(Promotion).where(
                    Promotion.name == promotion_name,
                    Promotion.product_id == product.id,
                )
            )

            now = datetime.now(UTC)

            if promotion is None:
                promotion = Promotion(
                    product_id=product.id,
                    name=promotion_name,
                    description=(
                        "Save 10% on selected Khmer coffee."
                    ),
                    discount_percent=Decimal("10.00"),
                    starts_at=now,
                    ends_at=now + timedelta(days=30),
                    is_active=True,
                )
                session.add(promotion)

            await session.commit()

            print(f"Seeded {len(STORES)} stores")
            print(f"Seeded {len(PRODUCTS)} products")
            print(
                "Seeded",
                sum(
                    len(items)
                    for items in STOCK.values()
                ),
                "inventory records",
            )
            print(f"Uploaded {uploaded_images} new images")
            print("Retail mock data is ready")

    finally:
        await blob_service.close()


async def main() -> None:
    try:
        await seed()
    finally:
        await close_database()


if __name__ == "__main__":
    asyncio.run(main())