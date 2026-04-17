-- Partial index to speed up deadline-sorted checklist queries
CREATE INDEX IF NOT EXISTS idx_checklist_due_date
  ON public.checklist_item(due_date)
  WHERE due_date IS NOT NULL AND is_completed = false;
