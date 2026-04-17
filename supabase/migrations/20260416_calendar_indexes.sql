-- Speed up calendar date-range queries
CREATE INDEX IF NOT EXISTS idx_order_date_range
  ON public."order"(scheduled_start, scheduled_end);

-- Speed up order_service joins when loading calendar orders
CREATE INDEX IF NOT EXISTS idx_order_service_order_id
  ON public.order_service(order_id, service_id);
