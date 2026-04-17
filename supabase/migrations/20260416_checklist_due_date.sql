-- Add due_date column to checklist_item
ALTER TABLE public.checklist_item
  ADD COLUMN IF NOT EXISTS due_date DATE;
