-- ============================================================================
-- MUŽÍČEK - Orders Management System
-- Migration v2: includes worker table fix
-- ============================================================================

DROP TABLE IF EXISTS public.order_worker CASCADE;
DROP TABLE IF EXISTS public.order_service CASCADE;
DROP TABLE IF EXISTS public.checklist_item CASCADE;
DROP TABLE IF EXISTS public."order" CASCADE;
DROP TABLE IF EXISTS public.customer_vehicle CASCADE;
DROP TABLE IF EXISTS public.customer CASCADE;
DROP TABLE IF EXISTS public.service CASCADE;
DROP TABLE IF EXISTS public.service_category CASCADE;
DROP TABLE IF EXISTS public.note CASCADE;
DROP TABLE IF EXISTS public.worker CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- ============================================================================
-- USERS (auth profiles)
-- ============================================================================

CREATE TABLE public.users (
  id UUID PRIMARY KEY,
  email VARCHAR(255) UNIQUE,
  full_name VARCHAR(200),
  phone VARCHAR(50),
  app_role VARCHAR(50) DEFAULT 'pending',
  worker_profile_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_users_app_role ON public.users(app_role);

-- ============================================================================
-- WORKERS (zaměstnanci)
-- ============================================================================

CREATE TABLE public.worker (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  phone VARCHAR(20),
  email VARCHAR(255),
  role VARCHAR(100),
  categories TEXT[],
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.worker ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_worker_active ON public.worker(is_active);

-- ============================================================================
-- SERVICE CATEGORIES & SERVICES
-- ============================================================================

CREATE TABLE public.service_category (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  color_class VARCHAR(50) NOT NULL DEFAULT 'bg-gray-100',
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.service_category ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.service (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  description TEXT,
  category_id UUID NOT NULL,
  default_price DECIMAL(10, 2),
  duration_minutes INT,
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  FOREIGN KEY (category_id) REFERENCES public.service_category(id) ON DELETE CASCADE
);

ALTER TABLE public.service ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_service_category ON public.service(category_id);
CREATE INDEX idx_service_active ON public.service(is_active);

-- ============================================================================
-- CUSTOMERS & VEHICLES
-- ============================================================================

CREATE TABLE public.customer (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  phone VARCHAR(20),
  email VARCHAR(255),
  ico VARCHAR(20),
  note TEXT,
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.customer ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_customer_phone ON public.customer(phone);
CREATE INDEX idx_customer_email ON public.customer(email);

CREATE TABLE public.customer_vehicle (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL,
  brand VARCHAR(100),
  model VARCHAR(100),
  spz VARCHAR(50) NOT NULL UNIQUE,
  vin VARCHAR(50) UNIQUE,
  color VARCHAR(100),
  year INT,
  specification TEXT,
  tk_expiry DATE,
  note TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  FOREIGN KEY (customer_id) REFERENCES public.customer(id) ON DELETE CASCADE
);

ALTER TABLE public.customer_vehicle ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_vehicle_customer ON public.customer_vehicle(customer_id);
CREATE INDEX idx_vehicle_spz ON public.customer_vehicle(spz);
CREATE INDEX idx_vehicle_active ON public.customer_vehicle(is_active);
CREATE INDEX idx_vehicle_tk_expiry ON public.customer_vehicle(tk_expiry);

-- ============================================================================
-- ORDERS (ZAKÁZKY)
-- ============================================================================

CREATE TABLE public."order" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number VARCHAR(50) UNIQUE,
  customer_id UUID,
  vehicle_id UUID,
  scheduled_start TIMESTAMP WITH TIME ZONE,
  scheduled_end TIMESTAMP WITH TIME ZONE,
  actual_start TIMESTAMP WITH TIME ZONE,
  actual_end TIMESTAMP WITH TIME ZONE,
  status VARCHAR(50) DEFAULT 'planned',
  total_price DECIMAL(12, 2) DEFAULT 0,
  payment_method VARCHAR(100),
  is_paid BOOLEAN DEFAULT FALSE,
  is_invoiced BOOLEAN DEFAULT FALSE,
  customer_notes TEXT,
  internal_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID,
  FOREIGN KEY (customer_id) REFERENCES public.customer(id) ON DELETE SET NULL,
  FOREIGN KEY (vehicle_id) REFERENCES public.customer_vehicle(id) ON DELETE SET NULL
);

ALTER TABLE public."order" ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_order_customer ON public."order"(customer_id);
CREATE INDEX idx_order_vehicle ON public."order"(vehicle_id);
CREATE INDEX idx_order_status ON public."order"(status);
CREATE INDEX idx_order_scheduled_start ON public."order"(scheduled_start);
CREATE INDEX idx_order_created_at ON public."order"(created_at);

-- ============================================================================
-- ORDER SERVICES (M:N)
-- ============================================================================

CREATE TABLE public.order_service (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL,
  service_id UUID,
  custom_service_name VARCHAR(200),
  custom_description TEXT,
  price DECIMAL(12, 2),
  quantity INT DEFAULT 1,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  FOREIGN KEY (order_id) REFERENCES public."order"(id) ON DELETE CASCADE,
  FOREIGN KEY (service_id) REFERENCES public.service(id) ON DELETE SET NULL
);

ALTER TABLE public.order_service ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_order_service_order ON public.order_service(order_id);
CREATE INDEX idx_order_service_service ON public.order_service(service_id);

-- ============================================================================
-- ORDER WORKERS (M:N)
-- ============================================================================

CREATE TABLE public.order_worker (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL,
  worker_id UUID NOT NULL,
  service_id UUID,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  FOREIGN KEY (order_id) REFERENCES public."order"(id) ON DELETE CASCADE,
  FOREIGN KEY (worker_id) REFERENCES public.worker(id) ON DELETE CASCADE,
  FOREIGN KEY (service_id) REFERENCES public.service(id) ON DELETE SET NULL
);

ALTER TABLE public.order_worker ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_order_worker_order ON public.order_worker(order_id);
CREATE INDEX idx_order_worker_worker ON public.order_worker(worker_id);

-- ============================================================================
-- CHECKLIST ITEMS
-- ============================================================================

CREATE TABLE public.checklist_item (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL,
  title VARCHAR(300) NOT NULL,
  description TEXT,
  is_completed BOOLEAN DEFAULT FALSE,
  assigned_to UUID,
  assigned_service_id UUID,
  sort_order INT DEFAULT 0,
  due_date DATE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  FOREIGN KEY (order_id) REFERENCES public."order"(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_to) REFERENCES public.worker(id) ON DELETE SET NULL,
  FOREIGN KEY (assigned_service_id) REFERENCES public.service(id) ON DELETE SET NULL
);

ALTER TABLE public.checklist_item ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_checklist_order ON public.checklist_item(order_id);
CREATE INDEX idx_checklist_assigned ON public.checklist_item(assigned_to);
CREATE INDEX idx_checklist_completed ON public.checklist_item(is_completed);

-- ============================================================================
-- NOTES
-- ============================================================================

CREATE TABLE public.note (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(300),
  content TEXT NOT NULL,
  order_id UUID,
  customer_id UUID,
  vehicle_id UUID,
  status VARCHAR(50) DEFAULT 'active',
  priority INT DEFAULT 0,
  created_by UUID,
  assigned_to UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  FOREIGN KEY (order_id) REFERENCES public."order"(id) ON DELETE SET NULL,
  FOREIGN KEY (customer_id) REFERENCES public.customer(id) ON DELETE SET NULL,
  FOREIGN KEY (vehicle_id) REFERENCES public.customer_vehicle(id) ON DELETE SET NULL,
  FOREIGN KEY (assigned_to) REFERENCES public.worker(id) ON DELETE SET NULL
);

ALTER TABLE public.note ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_note_order ON public.note(order_id);
CREATE INDEX idx_note_customer ON public.note(customer_id);
CREATE INDEX idx_note_vehicle ON public.note(vehicle_id);
CREATE INDEX idx_note_status ON public.note(status);
CREATE INDEX idx_note_created_at ON public.note(created_at);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_timestamp_users
BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_timestamp_worker
BEFORE UPDATE ON public.worker FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_timestamp_service_category
BEFORE UPDATE ON public.service_category FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_timestamp_service
BEFORE UPDATE ON public.service FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_timestamp_customer
BEFORE UPDATE ON public.customer FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_timestamp_customer_vehicle
BEFORE UPDATE ON public.customer_vehicle FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_timestamp_order
BEFORE UPDATE ON public."order" FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_timestamp_checklist_item
BEFORE UPDATE ON public.checklist_item FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_timestamp_note
BEFORE UPDATE ON public.note FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

CREATE POLICY "Users - select own" ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users - insert own" ON public.users FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users - update own" ON public.users FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Workers - full access" ON public.worker FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service categories - full access" ON public.service_category FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Services - full access" ON public.service FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Customers - full access" ON public.customer FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Customer vehicles - full access" ON public.customer_vehicle FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Orders - full access" ON public."order" FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Order service - full access" ON public.order_service FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Order worker - full access" ON public.order_worker FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Checklist items - full access" ON public.checklist_item FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Notes - full access" ON public.note FOR ALL USING (true) WITH CHECK (true);

-- ============================================================================
-- SEED DATA: SERVICE CATEGORIES & SERVICES
-- ============================================================================

INSERT INTO public.service_category (name, color_class, sort_order) VALUES
  ('PPF A WRAP',      'bg-blue-100 border-l-4 border-blue-500',   1),
  ('MYTÍ A ČIŠTĚNÍ',  'bg-green-100 border-l-4 border-green-500', 2),
  ('DETAILING',       'bg-purple-100 border-l-4 border-purple-500',3),
  ('PODVOZKY',        'bg-orange-100 border-l-4 border-orange-500',4),
  ('TÓNOVÁNÍ SKEL',   'bg-indigo-100 border-l-4 border-indigo-500',5),
  ('SERVIS',          'bg-gray-100 border-l-4 border-gray-500',    6),
  ('TRANSPORT',       'bg-red-100 border-l-4 border-red-500',      7),
  ('EXTERNÍ SLUŽBY',  'bg-yellow-100 border-l-4 border-yellow-500',8);

-- PPF A WRAP
INSERT INTO public.service (name, category_id, description, sort_order) VALUES
  ('PPF STANDARD',    (SELECT id FROM public.service_category WHERE name = 'PPF A WRAP'), 'Ochrana laku PPF Standard', 1),
  ('PPF FRONT+',      (SELECT id FROM public.service_category WHERE name = 'PPF A WRAP'), 'Ochrana přední části vozidla', 2),
  ('PPF FULL',        (SELECT id FROM public.service_category WHERE name = 'PPF A WRAP'), 'Úplná ochrana vozidla', 3),
  ('PPF INDIVIDUAL',  (SELECT id FROM public.service_category WHERE name = 'PPF A WRAP'), 'Individuální řešení PPF', 4),
  ('WRAP FULL',       (SELECT id FROM public.service_category WHERE name = 'PPF A WRAP'), 'Úplný wrap vozidla', 5),
  ('WRAP INDIVIDUAL', (SELECT id FROM public.service_category WHERE name = 'PPF A WRAP'), 'Individuální wrap řešení', 6);

-- MYTÍ A ČIŠTĚNÍ
INSERT INTO public.service (name, category_id, description, sort_order) VALUES
  ('Udržovačka',                 (SELECT id FROM public.service_category WHERE name = 'MYTÍ A ČIŠTĚNÍ'), 'Základní údržba', 1),
  ('Mytí základní',              (SELECT id FROM public.service_category WHERE name = 'MYTÍ A ČIŠTĚNÍ'), 'Mytí bez detailů', 2),
  ('Mytí detailní',              (SELECT id FROM public.service_category WHERE name = 'MYTÍ A ČIŠTĚNÍ'), 'Detailní mytí s péčí', 3),
  ('Dekontaminace laku',         (SELECT id FROM public.service_category WHERE name = 'MYTÍ A ČIŠTĚNÍ'), 'Odstranění kontaminace', 4),
  ('Čištění interiéru základní', (SELECT id FROM public.service_category WHERE name = 'MYTÍ A ČIŠTĚNÍ'), 'Základní čištění vnitřku', 5),
  ('Čištění interiéru detailní', (SELECT id FROM public.service_category WHERE name = 'MYTÍ A ČIŠTĚNÍ'), 'Detailní čištění interiéru', 6),
  ('Mytí motoru',                (SELECT id FROM public.service_category WHERE name = 'MYTÍ A ČIŠTĚNÍ'), 'Čištění motorového prostoru', 7),
  ('Keramický vosk',             (SELECT id FROM public.service_category WHERE name = 'MYTÍ A ČIŠTĚNÍ'), 'Ochrana voskem', 8);

-- DETAILING
INSERT INTO public.service (name, category_id, description, sort_order) VALUES
  ('Leštění jednokrokové',               (SELECT id FROM public.service_category WHERE name = 'DETAILING'), 'Jednoduché leštění', 1),
  ('Leštění vícekrokové',                (SELECT id FROM public.service_category WHERE name = 'DETAILING'), 'Komplexní leštění', 2),
  ('Retušování laku',                    (SELECT id FROM public.service_category WHERE name = 'DETAILING'), 'Oprava drobných poškození', 3),
  ('Keramický sealant',                  (SELECT id FROM public.service_category WHERE name = 'DETAILING'), 'Základní keramická ochrana', 4),
  ('Keramická ochrana 2 roky',           (SELECT id FROM public.service_category WHERE name = 'DETAILING'), 'Ochrana na 2 roky', 5),
  ('Keramická ochrana 3 roky',           (SELECT id FROM public.service_category WHERE name = 'DETAILING'), 'Ochrana na 3 roky', 6),
  ('Keramická ochrana čelního okna',     (SELECT id FROM public.service_category WHERE name = 'DETAILING'), 'Ochrana předního skla', 7),
  ('Keramická ochrana skel',             (SELECT id FROM public.service_category WHERE name = 'DETAILING'), 'Ochrana všech skel', 8),
  ('Keramická ochrana kol - sealant',    (SELECT id FROM public.service_category WHERE name = 'DETAILING'), 'Ochrana kol sealant', 9),
  ('Keramická ochrana kol - 2 roky',     (SELECT id FROM public.service_category WHERE name = 'DETAILING'), 'Ochrana kol 2 roky', 10),
  ('Impregnace textilní střechy',        (SELECT id FROM public.service_category WHERE name = 'DETAILING'), 'Ochrana textilní střechy', 11),
  ('Keramická ochrana textilní střechy', (SELECT id FROM public.service_category WHERE name = 'DETAILING'), 'Keramika na textilní střechu', 12),
  ('Keramická ochrana podběhů',          (SELECT id FROM public.service_category WHERE name = 'DETAILING'), 'Ochrana podběhů', 13),
  ('Keramická ochrana třmenů',           (SELECT id FROM public.service_category WHERE name = 'DETAILING'), 'Ochrana brzdových třmenů', 14);

-- PODVOZKY
INSERT INTO public.service (name, category_id, description, sort_order) VALUES
  ('Mytí podvozku',             (SELECT id FROM public.service_category WHERE name = 'PODVOZKY'), 'Čištění spodku vozidla', 1),
  ('Ochranný nástřik podvozku', (SELECT id FROM public.service_category WHERE name = 'PODVOZKY'), 'Ochrana proti korozi', 2),
  ('Tryskání suchým ledem',     (SELECT id FROM public.service_category WHERE name = 'PODVOZKY'), 'Čištění suchým ledem', 3);

-- TÓNOVÁNÍ SKEL
INSERT INTO public.service (name, category_id, description, sort_order) VALUES
  ('Tónování zadních oken', (SELECT id FROM public.service_category WHERE name = 'TÓNOVÁNÍ SKEL'), 'Aplikace fólie na zadní okna', 1),
  ('Tónování komplet',      (SELECT id FROM public.service_category WHERE name = 'TÓNOVÁNÍ SKEL'), 'Úplné tónování vozidla', 2),
  ('Tónování čelního pruhu',(SELECT id FROM public.service_category WHERE name = 'TÓNOVÁNÍ SKEL'), 'Pruh na čelním okně', 3);

-- SERVIS
INSERT INTO public.service (name, category_id, description, sort_order) VALUES
  ('Servis', (SELECT id FROM public.service_category WHERE name = 'SERVIS'), 'Servisní práce na vozidle', 1);

-- TRANSPORT
INSERT INTO public.service (name, category_id, description, sort_order) VALUES
  ('Vyzvednutí vozidla', (SELECT id FROM public.service_category WHERE name = 'TRANSPORT'), 'Přijetí vozidla u klienta', 1),
  ('Odvoz vozidla',      (SELECT id FROM public.service_category WHERE name = 'TRANSPORT'), 'Vrácení vozidla klientovi', 2),
  ('Přesun vozidla',     (SELECT id FROM public.service_category WHERE name = 'TRANSPORT'), 'Přemístění mezi lokalitami', 3);

-- EXTERNÍ SLUŽBY
INSERT INTO public.service (name, category_id, description, sort_order) VALUES
  ('Renovace kol',              (SELECT id FROM public.service_category WHERE name = 'EXTERNÍ SLUŽBY'), 'Oprava a leštění kol', 1),
  ('Pneuservis',                (SELECT id FROM public.service_category WHERE name = 'EXTERNÍ SLUŽBY'), 'Výměna pneumatik', 2),
  ('Lakování',                  (SELECT id FROM public.service_category WHERE name = 'EXTERNÍ SLUŽBY'), 'Lakování dílů', 3),
  ('STK',                       (SELECT id FROM public.service_category WHERE name = 'EXTERNÍ SLUŽBY'), 'Technická kontrola', 4),
  ('PDR - Odstraňování vmětin', (SELECT id FROM public.service_category WHERE name = 'EXTERNÍ SLUŽBY'), 'Oprava vmětin a poklepů', 5);

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

GRANT ALL ON public.users TO authenticated;
GRANT ALL ON public.worker TO authenticated;
GRANT ALL ON public.service_category TO authenticated;
GRANT ALL ON public.service TO authenticated;
GRANT ALL ON public.customer TO authenticated;
GRANT ALL ON public.customer_vehicle TO authenticated;
GRANT ALL ON public."order" TO authenticated;
GRANT ALL ON public.order_service TO authenticated;
GRANT ALL ON public.order_worker TO authenticated;
GRANT ALL ON public.checklist_item TO authenticated;
GRANT ALL ON public.note TO authenticated;

GRANT EXECUTE ON FUNCTION update_timestamp() TO authenticated;