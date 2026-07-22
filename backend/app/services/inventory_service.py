import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import Inventory, InventoryAuditLog, InventoryProposal, Product, Store


async def _find_product(session: AsyncSession, identifier: str) -> Product | None:
    clean = identifier.strip()
    if not clean:
        return None

    # 1. Match SKU (case-insensitive exact)
    product = await session.scalar(
        select(Product).where(
            func.lower(Product.sku) == clean.lower(),
            Product.is_active.is_(True),
        )
    )
    if product:
        return product

    # 2. Match Name (case-insensitive exact)
    product = await session.scalar(
        select(Product).where(
            func.lower(Product.name) == clean.lower(),
            Product.is_active.is_(True),
        )
    )
    if product:
        return product

    # 3. Match Category (case-insensitive exact)
    product = await session.scalar(
        select(Product).where(
            func.lower(Product.category) == clean.lower(),
            Product.is_active.is_(True),
        ).limit(1)
    )
    if product:
        return product

    # 4. Match Substring ILIKE (SKU, Name, Khmer Name, Category, or Brand)
    product = await session.scalar(
        select(Product).where(
            Product.is_active.is_(True),
            or_(
                Product.sku.ilike(f"%{clean}%"),
                Product.name.ilike(f"%{clean}%"),
                Product.name_km.ilike(f"%{clean}%"),
                Product.category.ilike(f"%{clean}%"),
                Product.brand.ilike(f"%{clean}%"),
            ),
        ).limit(1)
    )
    return product


async def _find_store(session: AsyncSession, identifier: str) -> Store | None:
    clean = identifier.strip()
    if not clean:
        return None

    store = await session.scalar(
        select(Store).where(
            func.lower(Store.code) == clean.lower(),
            Store.is_active.is_(True),
        )
    )
    if store:
        return store

    store = await session.scalar(
        select(Store).where(
            func.lower(Store.name) == clean.lower(),
            Store.is_active.is_(True),
        )
    )
    if store:
        return store

    store = await session.scalar(
        select(Store).where(
            Store.is_active.is_(True),
            or_(
                Store.code.ilike(f"%{clean}%"),
                Store.name.ilike(f"%{clean}%"),
            ),
        ).limit(1)
    )
    return store


def serialize_proposal(proposal: InventoryProposal) -> dict[str, Any]:
    return {
        "id": str(proposal.id),
        "proposal_type": proposal.proposal_type,
        "product_id": str(proposal.product_id),
        "sku": proposal.product.sku if proposal.product else None,
        "product_name": proposal.product.name if proposal.product else None,
        "store_id": str(proposal.store_id),
        "store_code": proposal.store.code if proposal.store else None,
        "store_name": proposal.store.name if proposal.store else None,
        "target_store_id": str(proposal.target_store_id) if proposal.target_store_id else None,
        "target_store_code": proposal.target_store.code if proposal.target_store else None,
        "target_store_name": proposal.target_store.name if proposal.target_store else None,
        "quantity_change": proposal.quantity_change,
        "previous_quantity": proposal.previous_quantity,
        "new_quantity": proposal.new_quantity,
        "target_previous_quantity": proposal.target_previous_quantity,
        "target_new_quantity": proposal.target_new_quantity,
        "reason": proposal.reason,
        "status": proposal.status,
        "staff_user_id": proposal.staff_user_id,
        "staff_name": proposal.staff_name,
        "created_at": proposal.created_at.isoformat() if proposal.created_at else None,
        "executed_at": proposal.executed_at.isoformat() if proposal.executed_at else None,
    }


def serialize_audit_log(log: InventoryAuditLog) -> dict[str, Any]:
    return {
        "id": str(log.id),
        "sku": log.product.sku if log.product else None,
        "product_name": log.product.name if log.product else None,
        "store_code": log.store.code if log.store else None,
        "store_name": log.store.name if log.store else None,
        "target_store_code": log.target_store.code if log.target_store else None,
        "target_store_name": log.target_store.name if log.target_store else None,
        "change_type": log.change_type,
        "quantity_delta": log.quantity_delta,
        "previous_quantity": log.previous_quantity,
        "new_quantity": log.new_quantity,
        "reason": log.reason,
        "staff_user_id": log.staff_user_id,
        "staff_name": log.staff_name,
        "created_at": log.created_at.isoformat() if log.created_at else None,
    }


async def check_reorder_alerts(
    session: AsyncSession,
    *,
    store_code: str | None = None,
) -> list[dict[str, Any]]:
    statement = (
        select(Inventory)
        .join(Store, Store.id == Inventory.store_id)
        .join(Product, Product.id == Inventory.product_id)
        .options(selectinload(Inventory.product), selectinload(Inventory.store))
        .where(
            Store.is_active.is_(True),
            Product.is_active.is_(True),
        )
    )

    if store_code:
        statement = statement.where(Store.code == store_code.strip().upper())

    inventories = (await session.scalars(statement)).all()
    alerts = []

    for inv in inventories:
        avail = inv.available_quantity
        if avail <= inv.reorder_level:
            alerts.append(
                {
                    "sku": inv.product.sku,
                    "product_name": inv.product.name,
                    "product_name_km": inv.product.name_km,
                    "category": inv.product.category,
                    "store_code": inv.store.code,
                    "store_name": inv.store.name,
                    "total_quantity": inv.quantity,
                    "reserved_quantity": inv.reserved_quantity,
                    "available_quantity": avail,
                    "reorder_level": inv.reorder_level,
                    "status": "out_of_stock" if avail <= 0 else "low_stock",
                }
            )

    return alerts


async def propose_stock_adjustment(
    session: AsyncSession,
    *,
    sku: str,
    store_code: str,
    quantity_change: int,
    reason: str | None = None,
    staff_user_id: str | None = None,
    staff_name: str | None = None,
) -> dict[str, Any]:
    product = await _find_product(session, sku)
    if not product:
        raise ValueError(f"Product '{sku}' not found.")

    store = await _find_store(session, store_code)
    if not store:
        raise ValueError(f"Store branch '{store_code}' not found.")

    inventory = await session.scalar(
        select(Inventory).where(
            Inventory.product_id == product.id,
            Inventory.store_id == store.id,
        )
    )

    if not inventory:
        inventory = Inventory(
            store_id=store.id,
            product_id=product.id,
            quantity=0,
            reserved_quantity=0,
            reorder_level=5,
        )
        session.add(inventory)
        await session.flush()

    previous_qty = inventory.quantity
    new_qty = previous_qty + quantity_change
    if new_qty < 0:
        raise ValueError(
            f"Cannot decrease stock below 0. Current stock at {store.name} is {previous_qty}."
        )

    proposal = InventoryProposal(
        proposal_type="adjustment",
        product_id=product.id,
        store_id=store.id,
        quantity_change=quantity_change,
        previous_quantity=previous_qty,
        new_quantity=new_qty,
        reason=reason or ("Stock adjustment via Staff Agent"),
        status="pending",
        staff_user_id=staff_user_id,
        staff_name=staff_name or "Staff Member",
    )
    session.add(proposal)
    await session.commit()
    await session.refresh(proposal, ["product", "store"])

    return serialize_proposal(proposal)


async def propose_stock_transfer(
    session: AsyncSession,
    *,
    sku: str,
    from_store_code: str,
    to_store_code: str,
    quantity: int,
    reason: str | None = None,
    staff_user_id: str | None = None,
    staff_name: str | None = None,
) -> dict[str, Any]:
    if quantity <= 0:
        raise ValueError("Transfer quantity must be greater than zero.")

    product = await _find_product(session, sku)
    if not product:
        raise ValueError(f"Product '{sku}' not found.")

    to_store = await _find_store(session, to_store_code)
    if not to_store:
        raise ValueError(f"Target store '{to_store_code}' not found.")

    from_store = await _find_store(session, from_store_code) if from_store_code else None
    if not from_store or from_store.id == to_store.id:
        best_inv = await session.scalar(
            select(Inventory)
            .join(Store, Store.id == Inventory.store_id)
            .where(
                Inventory.product_id == product.id,
                Store.id != to_store.id,
                Store.is_active.is_(True),
            )
            .order_by(Inventory.quantity.desc())
            .limit(1)
        )
        if best_inv:
            from_store = await session.scalar(select(Store).where(Store.id == best_inv.store_id))

    if not from_store:
        raise ValueError(f"Source store '{from_store_code}' not found.")

    if from_store.id == to_store.id:
        raise ValueError("Source store and target store cannot be the same branch.")

    from_inv = await session.scalar(
        select(Inventory).where(
            Inventory.product_id == product.id,
            Inventory.store_id == from_store.id,
        )
    )
    from_prev_qty = from_inv.quantity if from_inv else 0
    from_avail = from_inv.available_quantity if from_inv else 0

    if from_avail < quantity:
        raise ValueError(
            f"Insufficient available stock at {from_store.name}. Required: {quantity}, Available: {from_avail}."
        )

    to_inv = await session.scalar(
        select(Inventory).where(
            Inventory.product_id == product.id,
            Inventory.store_id == to_store.id,
        )
    )
    to_prev_qty = to_inv.quantity if to_inv else 0

    proposal = InventoryProposal(
        proposal_type="transfer",
        product_id=product.id,
        store_id=from_store.id,
        target_store_id=to_store.id,
        quantity_change=quantity,
        previous_quantity=from_prev_qty,
        new_quantity=from_prev_qty - quantity,
        target_previous_quantity=to_prev_qty,
        target_new_quantity=to_prev_qty + quantity,
        reason=reason or f"Transfer from {from_store.code} to {to_store.code}",
        status="pending",
        staff_user_id=staff_user_id,
        staff_name=staff_name or "Staff Member",
    )
    session.add(proposal)
    await session.commit()
    await session.refresh(proposal, ["product", "store", "target_store"])

    return serialize_proposal(proposal)


async def confirm_inventory_proposal(
    session: AsyncSession,
    *,
    proposal_id: str | uuid.UUID,
    staff_user_id: str | None = None,
    staff_name: str | None = None,
) -> dict[str, Any]:
    if isinstance(proposal_id, str):
        proposal_id = uuid.UUID(proposal_id)

    proposal = await session.scalar(
        select(InventoryProposal).where(InventoryProposal.id == proposal_id)
    )
    if not proposal:
        raise ValueError("Inventory proposal not found.")

    if proposal.status != "pending":
        raise ValueError(f"Proposal is already in status '{proposal.status}'.")

    refresh_attrs = ["product", "store"]
    if proposal.target_store_id:
        refresh_attrs.append("target_store")
    await session.refresh(proposal, refresh_attrs)

    if proposal.proposal_type == "adjustment":
        inv = await session.scalar(
            select(Inventory).where(
                Inventory.product_id == proposal.product_id,
                Inventory.store_id == proposal.store_id,
            )
        )
        if not inv:
            inv = Inventory(
                store_id=proposal.store_id,
                product_id=proposal.product_id,
                quantity=0,
                reserved_quantity=0,
                reorder_level=5,
            )
            session.add(inv)
            await session.flush()

        prev_qty = inv.quantity
        inv.quantity = proposal.new_quantity

        change_type = "adjustment_add" if proposal.quantity_change > 0 else "adjustment_remove"
        audit_log = InventoryAuditLog(
            product_id=proposal.product_id,
            store_id=proposal.store_id,
            change_type=change_type,
            quantity_delta=proposal.quantity_change,
            previous_quantity=prev_qty,
            new_quantity=inv.quantity,
            reason=proposal.reason,
            staff_user_id=staff_user_id or proposal.staff_user_id,
            staff_name=staff_name or proposal.staff_name,
        )
        session.add(audit_log)

    elif proposal.proposal_type == "transfer":
        # Source Store
        from_inv = await session.scalar(
            select(Inventory).where(
                Inventory.product_id == proposal.product_id,
                Inventory.store_id == proposal.store_id,
            )
        )
        if not from_inv or from_inv.quantity < proposal.quantity_change:
            raise ValueError("Insufficient stock in source branch for transfer.")

        from_prev = from_inv.quantity
        from_inv.quantity -= proposal.quantity_change

        # Target Store
        to_inv = await session.scalar(
            select(Inventory).where(
                Inventory.product_id == proposal.product_id,
                Inventory.store_id == proposal.target_store_id,
            )
        )
        if not to_inv:
            to_inv = Inventory(
                store_id=proposal.target_store_id,
                product_id=proposal.product_id,
                quantity=0,
                reserved_quantity=0,
                reorder_level=5,
            )
            session.add(to_inv)
            await session.flush()

        to_prev = to_inv.quantity
        to_inv.quantity += proposal.quantity_change

        # Audit Logs (One for transfer out, one for transfer in)
        audit_out = InventoryAuditLog(
            product_id=proposal.product_id,
            store_id=proposal.store_id,
            target_store_id=proposal.target_store_id,
            change_type="transfer_out",
            quantity_delta=-proposal.quantity_change,
            previous_quantity=from_prev,
            new_quantity=from_inv.quantity,
            reason=proposal.reason,
            staff_user_id=staff_user_id or proposal.staff_user_id,
            staff_name=staff_name or proposal.staff_name,
        )
        audit_in = InventoryAuditLog(
            product_id=proposal.product_id,
            store_id=proposal.target_store_id,
            target_store_id=proposal.store_id,
            change_type="transfer_in",
            quantity_delta=proposal.quantity_change,
            previous_quantity=to_prev,
            new_quantity=to_inv.quantity,
            reason=proposal.reason,
            staff_user_id=staff_user_id or proposal.staff_user_id,
            staff_name=staff_name or proposal.staff_name,
        )
        session.add_all([audit_out, audit_in])

    proposal.status = "confirmed"
    proposal.executed_at = datetime.now(UTC)
    await session.commit()
    await session.refresh(proposal, refresh_attrs)

    return serialize_proposal(proposal)


async def cancel_inventory_proposal(
    session: AsyncSession,
    *,
    proposal_id: str | uuid.UUID,
) -> dict[str, Any]:
    if isinstance(proposal_id, str):
        proposal_id = uuid.UUID(proposal_id)

    proposal = await session.scalar(
        select(InventoryProposal).where(InventoryProposal.id == proposal_id)
    )
    if not proposal:
        raise ValueError("Proposal not found.")

    proposal.status = "cancelled"
    await session.commit()

    refresh_attrs = ["product", "store"]
    if proposal.target_store_id:
        refresh_attrs.append("target_store")
    await session.refresh(proposal, refresh_attrs)

    return serialize_proposal(proposal)


async def get_inventory_audit_logs(
    session: AsyncSession,
    *,
    store_code: str | None = None,
    sku: str | None = None,
    limit: int = 20,
) -> list[dict[str, Any]]:
    limit = min(max(limit, 1), 50)

    statement = (
        select(InventoryAuditLog)
        .options(
            selectinload(InventoryAuditLog.product),
            selectinload(InventoryAuditLog.store),
            selectinload(InventoryAuditLog.target_store),
        )
        .join(Product, Product.id == InventoryAuditLog.product_id)
        .join(Store, Store.id == InventoryAuditLog.store_id)
        .order_by(InventoryAuditLog.created_at.desc())
        .limit(limit)
    )

    if store_code:
        statement = statement.where(Store.code == store_code.strip().upper())

    if sku:
        statement = statement.where(Product.sku == sku.strip().upper())

    logs = (await session.scalars(statement)).all()
    return [serialize_audit_log(log) for log in logs]


async def generate_inventory_report(
    session: AsyncSession,
    *,
    store_code: str | None = None,
) -> dict[str, Any]:
    statement = (
        select(Store, Product, Inventory)
        .join(Inventory, Inventory.store_id == Store.id)
        .join(Product, Product.id == Inventory.product_id)
        .where(Store.is_active.is_(True), Product.is_active.is_(True))
    )

    if store_code:
        statement = statement.where(Store.code == store_code.strip().upper())

    rows = (await session.execute(statement)).all()

    total_items = len(rows)
    total_quantity = sum(inv.quantity for _, _, inv in rows)
    total_available = sum(inv.available_quantity for _, _, inv in rows)
    total_reserved = sum(inv.reserved_quantity for _, _, inv in rows)

    low_stock_items = []
    out_of_stock_items = []

    store_summaries = {}
    category_summaries = {}
    resolved_store_name = None

    for store, product, inv in rows:
        if store_code and not resolved_store_name:
            resolved_store_name = store.name

        if store.code not in store_summaries:
            store_summaries[store.code] = {
                "store_code": store.code,
                "store_name": store.name,
                "total_items": 0,
                "total_quantity": 0,
                "available_quantity": 0,
                "low_stock_count": 0,
                "out_of_stock_count": 0,
            }
        st = store_summaries[store.code]
        st["total_items"] += 1
        st["total_quantity"] += inv.quantity
        st["available_quantity"] += inv.available_quantity

        cat = product.category or "General"
        if cat not in category_summaries:
            category_summaries[cat] = {
                "category": cat,
                "total_items": 0,
                "total_quantity": 0,
                "available_quantity": 0,
                "products": [],
            }
        cs = category_summaries[cat]
        cs["total_items"] += 1
        cs["total_quantity"] += inv.quantity
        cs["available_quantity"] += inv.available_quantity
        cs["products"].append(
            {
                "sku": product.sku,
                "product_name": product.name,
                "product_name_km": product.name_km,
                "brand": product.brand,
                "image_url": product.image_url,
                "total_quantity": inv.quantity,
                "available_quantity": inv.available_quantity,
                "store_code": store.code,
            }
        )

        item_info = {
            "sku": product.sku,
            "product_name": product.name,
            "category": cat,
            "store_code": store.code,
            "store_name": store.name,
            "available_quantity": inv.available_quantity,
            "reorder_level": inv.reorder_level,
        }

        if inv.available_quantity <= 0:
            st["out_of_stock_count"] += 1
            out_of_stock_items.append(item_info)
        elif inv.available_quantity <= inv.reorder_level:
            st["low_stock_count"] += 1
            low_stock_items.append(item_info)

    return {
        "generated_at": datetime.now(UTC).isoformat(),
        "store_code_filter": store_code,
        "store_name": resolved_store_name or ("All Store Branches"),
        "total_products_tracked": total_items,
        "total_stock_quantity": total_quantity,
        "total_available_quantity": total_available,
        "total_reserved_quantity": total_reserved,
        "low_stock_count": len(low_stock_items),
        "out_of_stock_count": len(out_of_stock_items),
        "branch_breakdown": list(store_summaries.values()),
        "category_breakdown": list(category_summaries.values()),
        "low_stock_items": low_stock_items,
        "out_of_stock_items": out_of_stock_items,
    }
