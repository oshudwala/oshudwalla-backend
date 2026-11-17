-- STEP 1 / PRE-CHECK (read-only). Send me the output if any number is not what is expected.
SELECT r.name AS role, count(u.id) AS users FROM roles r LEFT JOIN users u ON u."roleId" = r.id GROUP BY r.name ORDER BY 1;
SELECT 'inventory rows (expect 0)' AS check, count(*) FROM inventory;
SELECT 'stock_movements rows (expect 0)' AS check, count(*) FROM stock_movements;
SELECT "staffRole", count(*) FROM pharmacy_staff GROUP BY 1;
