-- Run these directly on your hosted database (phpMyAdmin -> SQL tab, or `mysql -u user -p dbname < add_indexes.sql`).
-- Speeds up SalesEntryController@store's "existing unpriced record" lookup and
-- general bill_no/code lookups, which were doing full table scans on the
-- ever-growing `sales` table during a day's data entry.

ALTER TABLE `sales`
    ADD INDEX `idx_sales_unpriced_lookup` (`customer_code`, `item_code`, `supplier_code`, `price_per_kg`, `Processed`);

ALTER TABLE `sales`
    ADD INDEX `idx_sales_bill_no` (`bill_no`);

ALTER TABLE `sales`
    ADD INDEX `idx_sales_code` (`code`);

-- Optional, but recommended if you ever query GrnEntry/SalesHistory by `code`
-- (used by the rewritten updateGrnRemainingStock() in SalesEntryController.php):
ALTER TABLE `grn_entries`
    ADD INDEX `idx_grn_entries_code` (`code`);

ALTER TABLE `sales_histories`
    ADD INDEX `idx_sales_histories_code` (`code`);

-- ---------------------------------------------------------------------------
-- To undo (only if something goes wrong):
-- ALTER TABLE `sales` DROP INDEX `idx_sales_unpriced_lookup`;
-- ALTER TABLE `sales` DROP INDEX `idx_sales_bill_no`;
-- ALTER TABLE `sales` DROP INDEX `idx_sales_code`;
-- ALTER TABLE `grn_entries` DROP INDEX `idx_grn_entries_code`;
-- ALTER TABLE `sales_histories` DROP INDEX `idx_sales_histories_code`;
