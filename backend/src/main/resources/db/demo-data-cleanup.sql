-- Run manually only when the BeautyLink demonstration catalog is no longer needed.
-- The transaction removes demo bookings and dependent records before suppliers.
START TRANSACTION;

CREATE TEMPORARY TABLE demo_supplier_ids AS
SELECT id, owner_user_id
FROM suppliers
WHERE demo_data = TRUE;

DELETE br
FROM booking_reviews br
JOIN bookings b ON b.id = br.booking_id
JOIN demo_supplier_ids d ON d.id = b.supplier_id;

DELETE pt
FROM payment_transactions pt
JOIN bookings b ON b.id = pt.booking_id
JOIN demo_supplier_ids d ON d.id = b.supplier_id;

DELETE b
FROM bookings b
JOIN demo_supplier_ids d ON d.id = b.supplier_id;

DELETE se
FROM schedule_exceptions se
JOIN practitioners p ON p.id = se.practitioner_id
JOIN demo_supplier_ids d ON d.id = p.supplier_id;

DELETE ar
FROM availability_rules ar
JOIN practitioners p ON p.id = ar.practitioner_id
JOIN demo_supplier_ids d ON d.id = p.supplier_id;

DELETE so
FROM service_offerings so
JOIN demo_supplier_ids d ON d.id = so.supplier_id;

DELETE p
FROM practitioners p
JOIN demo_supplier_ids d ON d.id = p.supplier_id;

DELETE s
FROM suppliers s
JOIN demo_supplier_ids d ON d.id = s.id;

DELETE u
FROM user_accounts u
JOIN demo_supplier_ids d ON d.owner_user_id = u.id;

DROP TEMPORARY TABLE demo_supplier_ids;
COMMIT;
