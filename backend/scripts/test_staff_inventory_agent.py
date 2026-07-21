import asyncio
from app.db.session import AsyncSessionFactory, init_db
from app.services import inventory_service


async def test_staff_agent_workflow():
    print("=== Testing Staff Inventory Agent & Shared Services Workflow ===")
    await init_db()
    async with AsyncSessionFactory() as session:
        # 1. Reorder Alerts
        print("\n1. Testing Reorder Level Monitoring...")
        alerts = await inventory_service.check_reorder_alerts(session)
        print(f"Found {len(alerts)} items reaching/below reorder level.")

        # 2. Stock Adjustment Proposal
        print("\n2. Testing Controlled Stock Adjustment Proposal...")
        adjustment_prop = await inventory_service.propose_stock_adjustment(
            session,
            sku="MILK-UHT-1L",
            store_code="PP-BKK1",
            quantity_change=25,
            reason="Weekly restock shipment received",
            staff_user_id="staff-test-01",
            staff_name="Admin Staff",
        )
        print(f"Proposal Created: ID={adjustment_prop['id']}, Status={adjustment_prop['status']}")
        print(f"Stock Before: {adjustment_prop['previous_quantity']}, Stock After: {adjustment_prop['new_quantity']}")

        # 3. Confirm Proposal
        print("\n3. Testing Proposal Execution & Audit Logging...")
        confirmed_adj = await inventory_service.confirm_inventory_proposal(
            session,
            proposal_id=adjustment_prop["id"],
            staff_user_id="staff-test-01",
            staff_name="Admin Staff",
        )
        print(f"Proposal Status after Confirmation: {confirmed_adj['status']}, Executed At: {confirmed_adj['executed_at']}")

        # 4. Stock Transfer Proposal
        print("\n4. Testing Inter-Branch Stock Transfer Proposal...")
        transfer_prop = await inventory_service.propose_stock_transfer(
            session,
            sku="MILK-UHT-1L",
            from_store_code="PP-BKK1",
            to_store_code="PP-TTP",
            quantity=5,
            reason="Branch rebalance request",
            staff_user_id="staff-test-01",
            staff_name="Admin Staff",
        )
        print(f"Transfer Proposal Created: ID={transfer_prop['id']}")
        print(f"PP-BKK1 Stock: {transfer_prop['previous_quantity']} -> {transfer_prop['new_quantity']}")
        print(f"PP-TTP Stock: {transfer_prop['target_previous_quantity']} -> {transfer_prop['target_new_quantity']}")

        # Confirm Transfer
        confirmed_trans = await inventory_service.confirm_inventory_proposal(
            session,
            proposal_id=transfer_prop["id"],
            staff_user_id="staff-test-01",
            staff_name="Admin Staff",
        )
        print(f"Transfer Proposal Status after Confirmation: {confirmed_trans['status']}")

        # 5. Audit Logs
        print("\n5. Testing Inventory Audit Log Retrieval...")
        audit_logs = await inventory_service.get_inventory_audit_logs(session, limit=5)
        print(f"Retrieved {len(audit_logs)} audit log entries.")
        for log in audit_logs:
            print(f"  - [{log['created_at']}] {log['sku']} ({log['store_code']}): {log['change_type']} ({log['quantity_delta']}) by {log['staff_name']}")

        # 6. Inventory Summary Report
        print("\n6. Testing Inventory Report Generation...")
        report = await inventory_service.generate_inventory_report(session)
        print(f"Report Generated: Total Tracked={report['total_products_tracked']}, Total Available={report['total_available_quantity']}, Low Stock Count={report['low_stock_count']}")

    print("\n=== All Staff Inventory Agent Services Tested Successfully! ===")


if __name__ == "__main__":
    asyncio.run(test_staff_agent_workflow())
