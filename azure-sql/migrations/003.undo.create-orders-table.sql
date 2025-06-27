DROP INDEX idx_order_items_product ON order_items;
DROP INDEX idx_order_items_order ON order_items;
DROP INDEX idx_orders_created_at ON orders;
DROP INDEX idx_orders_status ON orders;
DROP INDEX idx_orders_user ON orders;
DROP TABLE order_items;
DROP TABLE orders;