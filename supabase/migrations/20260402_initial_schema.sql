-- =============================================================================
-- MUZICEK — Systém správy zakázek
-- Auto detailing / péče o vozy, Praha
-- =============================================================================
-- Migrace: 20260402_initial_schema.sql
-- Autor:   Generated for Muzicek
-- Popis:   Kompletní počáteční schéma pro správu zakázek, CRM (klienti + vozy),
--          sledování realizace a reportingu obratu podle kategorií služeb.
--
-- Fáze 1 (obsažena):
--   - users               – uživatelé (Supabase Auth)
--   - service_categories  – kategorie služeb (PPF, Mytí, Detailing, …)
--   - services            – konkrétní služby (předdefinované + vlastní)
--   - contacts            – klienti / zákazníci
--   - vehicles            – vozidla zákazníků
--   - orders              – zakázky (hlavní entita)
--   - order_services      – výčet služeb na zakázce (ceny, stav)
--   - order_assignments   – přiřazení zaměstnanců k zakázce / konkrétní službě
--   - order_checklist_items – checklist průběhu zakázky
--   - notes               – globální poznámky (k zakázce nebo obecné)
--
-- Fáze 2 (základ připraven):
--   - attendance          – docházka zaměstnanců
--   - bonuses             – bonusy a srážky
--   - costs               – náklady zakázky
--   - quotes              – cenové nabídky
--   - client_messages     – komunikace/zpětná vazba klientů
--   - long_term_projects  – zastřešující projekt pro více zakázek
-- =============================================================================


-- -----------------------------------------------------------------------------
-- EXTENSIONS
-- -----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- pro fulltextové vyhledávání v adresáři


-- =============================================================================
-- 1. USERS
-- Tabulka uživatelů propojená se Supabase Auth (auth.users).
-- Každý uživatel má roli: 'admin' | 'manager' | 'worker'
-- =============================================================================
CREATE TABLE IF NOT EXISTS users (
    id                  uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),

    email               text        UNIQUE,
    full_name           text,
    phone               text,
    photo_url           text,

    -- Aplikační role: admin = majitel/manažer plný přístup,
    --                 manager = vedoucí, worker = řadový zaměstnanec
    app_role            text        NOT NULL DEFAULT 'worker'
                                    CHECK (app_role IN ('admin', 'manager', 'worker')),

    -- Kategorie, ve kterých zaměstnanec pracuje (pro filtrování notifikací / WA skupin)
    -- Pole UUID odkazujících na service_categories.id
    category_ids        uuid[]      NOT NULL DEFAULT '{}',

    is_active           boolean     NOT NULL DEFAULT true,
    notes               text
);

COMMENT ON TABLE users IS
    'Uživatelé aplikace – zaměstnanci Muzicek. Propojeno se Supabase Auth.';
COMMENT ON COLUMN users.app_role IS
    'Aplikační role: admin = plný přístup, manager = vedoucí, worker = řadový zaměstnanec';
COMMENT ON COLUMN users.category_ids IS
    'Pole ID kategorií služeb, ve kterých zaměstnanec pracuje (určuje viditelnost zakázek / notifikace)';

CREATE INDEX idx_users_app_role      ON users(app_role);
CREATE INDEX idx_users_is_active     ON users(is_active);
CREATE INDEX idx_users_email         ON users(email);


-- =============================================================================
-- 2. SERVICE_CATEGORIES
-- Hlavní kategorie služeb – barevně odlišené v UI.
-- PPF a Wrap, Mytí a Čištění, Detailing, Podvozky, Tónování, Servis, Transport, Externí
-- =============================================================================
CREATE TABLE IF NOT EXISTS service_categories (
    id          uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),

    name        text        NOT NULL,       -- např. "PPF a Wrap"
    name_short  text,                       -- zkratka, např. "PPF"
    color_hex   text        NOT NULL,       -- barva pro UI, např. "#E74C3C"
    sort_order  integer     NOT NULL DEFAULT 0,
    is_active   boolean     NOT NULL DEFAULT true,
    description text
);

COMMENT ON TABLE service_categories IS
    'Hlavní kategorie služeb (PPF a Wrap, Mytí a Čištění, Detailing, …). '
    'Každá kategorie je barevně odlišena v UI pro rychlý přehled zakázky.';

CREATE INDEX idx_service_categories_sort ON service_categories(sort_order);

-- Seed: základní kategorie (barvy jako v Google Calendar)
INSERT INTO service_categories (id, name, name_short, color_hex, sort_order) VALUES
    ('00000000-0000-0000-0000-000000000001', 'PPF a Wrap',       'PPF',      '#E74C3C', 1),
    ('00000000-0000-0000-0000-000000000002', 'Mytí a Čištění',   'MYTÍ',     '#3498DB', 2),
    ('00000000-0000-0000-0000-000000000003', 'Detailing',        'DETAIL',   '#9B59B6', 3),
    ('00000000-0000-0000-0000-000000000004', 'Podvozky',         'PODVOZEK', '#E67E22', 4),
    ('00000000-0000-0000-0000-000000000005', 'Tónování skel',    'TÓNO',     '#1ABC9C', 5),
    ('00000000-0000-0000-0000-000000000006', 'Servis',           'SERVIS',   '#F39C12', 6),
    ('00000000-0000-0000-0000-000000000007', 'Transport',        'TRANS',    '#2ECC71', 7),
    ('00000000-0000-0000-0000-000000000008', 'Externí služby',   'EXTERN',   '#95A5A6', 8);


-- =============================================================================
-- 3. SERVICES
-- Konkrétní předdefinované služby (lze jen "vyklikat").
-- Vlastní/individuální služby se zakládají přímo na zakázce (order_services).
-- =============================================================================
CREATE TABLE IF NOT EXISTS services (
    id              uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),

    category_id     uuid        NOT NULL REFERENCES service_categories(id) ON DELETE RESTRICT,
    name            text        NOT NULL,
    description     text,

    -- Výchozí cena (orientační, lze přepsat na zakázce)
    default_price   numeric(10,2),

    sort_order      integer     NOT NULL DEFAULT 0,
    is_active       boolean     NOT NULL DEFAULT true,

    -- Příznak: služba se opakuje u většiny zakázek (pro rychlé kliknutí v UI)
    is_common       boolean     NOT NULL DEFAULT false
);

COMMENT ON TABLE services IS
    'Předdefinované služby Muzicek. Opakující se (is_common=true) se zobrazují jako '
    'rychlé tlačítko; specifické lze přidat ručně. Každá patří do jedné kategorie.';

COMMENT ON COLUMN services.is_common IS
    'Pokud true, zobrazuje se jako rychlé "klikací" tlačítko při zakládání zakázky.';

CREATE INDEX idx_services_category  ON services(category_id);
CREATE INDEX idx_services_active    ON services(is_active);
CREATE INDEX idx_services_sort      ON services(sort_order);

-- Seed: předdefinované služby dle požadavků
INSERT INTO services (category_id, name, is_common, sort_order) VALUES
    -- PPF a Wrap
    ('00000000-0000-0000-0000-000000000001', 'PPF Standard',          false, 10),
    ('00000000-0000-0000-0000-000000000001', 'PPF Front+',             false, 20),
    ('00000000-0000-0000-0000-000000000001', 'PPF Full',               false, 30),
    ('00000000-0000-0000-0000-000000000001', 'PPF Individuální',       false, 40),
    ('00000000-0000-0000-0000-000000000001', 'Wrap Full',              false, 50),
    ('00000000-0000-0000-0000-000000000001', 'Wrap Individuální',      false, 60),
    -- Mytí a Čištění
    ('00000000-0000-0000-0000-000000000002', 'Udržovačka',            true,  10),
    ('00000000-0000-0000-0000-000000000002', 'Mytí základní',         true,  20),
    ('00000000-0000-0000-0000-000000000002', 'Mytí detailní',         false, 30),
    ('00000000-0000-0000-0000-000000000002', 'Dekontaminace laku',    true,  40),
    ('00000000-0000-0000-0000-000000000002', 'Čištění interiéru základní', true, 50),
    ('00000000-0000-0000-0000-000000000002', 'Čištění interiéru detailní', false, 60),
    ('00000000-0000-0000-0000-000000000002', 'Mytí motoru',           false, 70),
    ('00000000-0000-0000-0000-000000000002', 'Keramický vosk',        false, 80),
    -- Detailing
    ('00000000-0000-0000-0000-000000000003', 'Leštění jednokrokové',         false, 10),
    ('00000000-0000-0000-0000-000000000003', 'Leštění vícekrokové',          false, 20),
    ('00000000-0000-0000-0000-000000000003', 'Retušování laku',              false, 30),
    ('00000000-0000-0000-0000-000000000003', 'Keramický sealant',            false, 40),
    ('00000000-0000-0000-0000-000000000003', 'Keramická ochrana 2 roky',     false, 50),
    ('00000000-0000-0000-0000-000000000003', 'Keramická ochrana 3 roky',     false, 60),
    ('00000000-0000-0000-0000-000000000003', 'Keramická ochrana čelního okna', false, 70),
    ('00000000-0000-0000-0000-000000000003', 'Keramická ochrana skel',       false, 80),
    ('00000000-0000-0000-0000-000000000003', 'Keramická ochrana kol (sealant)', false, 90),
    ('00000000-0000-0000-0000-000000000003', 'Keramická ochrana kol (2 roky)',  false, 100),
    ('00000000-0000-0000-0000-000000000003', 'Impregnace textilní střechy',  false, 110),
    ('00000000-0000-0000-0000-000000000003', 'Keramická ochrana textilní střechy', false, 120),
    ('00000000-0000-0000-0000-000000000003', 'Keramická ochrana podběhů',    false, 130),
    ('00000000-0000-0000-0000-000000000003', 'Keramická ochrana třmenů',     false, 140),
    -- Podvozky
    ('00000000-0000-0000-0000-000000000004', 'Mytí podvozku',                false, 10),
    ('00000000-0000-0000-0000-000000000004', 'Ochranný nástřik podvozku a dutin', false, 20),
    ('00000000-0000-0000-0000-000000000004', 'Tryskání suchým ledem',        false, 30),
    -- Tónování skel
    ('00000000-0000-0000-0000-000000000005', 'Tónování – zadní okna',        false, 10),
    ('00000000-0000-0000-0000-000000000005', 'Tónování – komplet',           false, 20),
    ('00000000-0000-0000-0000-000000000005', 'Tónování – čelní pruh',        false, 30),
    -- Servis
    ('00000000-0000-0000-0000-000000000006', 'Servis / demontáž',            false, 10),
    -- Transport
    ('00000000-0000-0000-0000-000000000007', 'Transport / vyzvednutí',       false, 10),
    ('00000000-0000-0000-0000-000000000007', 'Transport / odvoz',            false, 20),
    ('00000000-0000-0000-0000-000000000007', 'Transport odtahový vůz',       false, 30),
    -- Externí služby
    ('00000000-0000-0000-0000-000000000008', 'Renovace kol',                 false, 10),
    ('00000000-0000-0000-0000-000000000008', 'Pneuservis',                   false, 20),
    ('00000000-0000-0000-0000-000000000008', 'Lakování',                     false, 30),
    ('00000000-0000-0000-0000-000000000008', 'STK',                          false, 40),
    ('00000000-0000-0000-0000-000000000008', 'PDR',                          false, 50);


-- =============================================================================
-- 4. CONTACTS
-- CRM – zákazníci / klienti.
-- Fyzické osoby i firmy. Napojeno na vozy a zakázky.
-- =============================================================================
CREATE TABLE IF NOT EXISTS contacts (
    id              uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),

    -- Základní identifikace
    full_name       text        NOT NULL,
    company_name    text,                   -- pokud je to firemní zákazník
    ico             text,                   -- IČO
    dic             text,                   -- DIČ

    -- Kontaktní údaje
    phone           text,
    email           text,
    address         text,

    -- Metadata
    notes           text,
    is_active       boolean     NOT NULL DEFAULT true,

    -- Výpočtové pole (denormalizováno pro rychlý přehled), aktualizováno triggerem/app
    total_spent     numeric(12,2) NOT NULL DEFAULT 0,
    last_order_at   timestamptz
);

COMMENT ON TABLE contacts IS
    'Adresář klientů / zákazníků Muzicek. Fyzické osoby i firmy. '
    'Každý kontakt může mít více vozidel a historii zakázek.';
COMMENT ON COLUMN contacts.total_spent IS
    'Celková útrata klienta – aktualizuje se při změně stavu zakázky (zaplaceno).';

CREATE INDEX idx_contacts_full_name  ON contacts USING gin(full_name gin_trgm_ops);
CREATE INDEX idx_contacts_phone      ON contacts(phone);
CREATE INDEX idx_contacts_email      ON contacts(email);
CREATE INDEX idx_contacts_is_active  ON contacts(is_active);


-- =============================================================================
-- 5. VEHICLES
-- Vozidla zákazníků. Každé vozidlo patří kontaktu (majiteli).
-- Obsahuje informace pro STK připomínky a historii služeb.
-- =============================================================================
CREATE TABLE IF NOT EXISTS vehicles (
    id              uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),

    contact_id      uuid        NOT NULL REFERENCES contacts(id) ON DELETE RESTRICT,

    -- Identifikace vozu
    brand           text        NOT NULL,   -- Značka (BMW, Škoda, …)
    model           text        NOT NULL,   -- Model (X5, Octavia, …)
    license_plate   text,                   -- SPZ
    vin             text,                   -- VIN
    year            integer,                -- Rok výroby
    color           text,                   -- Barva
    specification   text,                   -- Podrobnosti (motor, paket výbavy, …)

    -- Dokumenty / platnosti
    stk_expiry      date,                   -- Platnost STK (technická kontrola)

    -- Stav
    is_sold         boolean     NOT NULL DEFAULT false,  -- Auto prodáno (archivní)
    notes           text
);

COMMENT ON TABLE vehicles IS
    'Vozidla zákazníků. Každé vozidlo je svázáno s kontaktem (majitelem). '
    'Pole stk_expiry slouží pro přehled blížících se expirací → oslovení klientů.';
COMMENT ON COLUMN vehicles.is_sold IS
    'Pokud true, vozidlo je archivní (prodáno), ale zachovává historii zakázek.';

CREATE INDEX idx_vehicles_contact      ON vehicles(contact_id);
CREATE INDEX idx_vehicles_license      ON vehicles(license_plate);
CREATE INDEX idx_vehicles_stk_expiry   ON vehicles(stk_expiry) WHERE stk_expiry IS NOT NULL;
CREATE INDEX idx_vehicles_is_sold      ON vehicles(is_sold);


-- =============================================================================
-- 6. ORDERS
-- Zakázky – hlavní entita systému.
-- Každá zakázka je svázána s kontaktem a vozidlem, má stav, termín, cenu a platební údaje.
-- =============================================================================
CREATE TABLE IF NOT EXISTS orders (
    id              uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),

    -- Číslo zakázky (generováno aplikací, např. "MZ-2026-0042")
    order_number    text        UNIQUE,

    -- Zákazník a vozidlo
    contact_id      uuid        REFERENCES contacts(id) ON DELETE SET NULL,
    vehicle_id      uuid        REFERENCES vehicles(id) ON DELETE SET NULL,

    -- Termín realizace
    scheduled_start timestamptz,
    scheduled_end   timestamptz,
    actual_start    timestamptz,
    actual_end      timestamptz,

    -- Stav zakázky
    status          text        NOT NULL DEFAULT 'planned'
                                CHECK (status IN (
                                    'draft',       -- rozepsaná / nepotvrzená (z nabídky)
                                    'planned',     -- potvrzená, naplánovaná
                                    'in_progress', -- probíhá
                                    'done',        -- dokončená (čeká na platbu / archivaci)
                                    'archived'     -- archivovaná
                                )),

    -- Finanční přehled
    total_price     numeric(10,2) NOT NULL DEFAULT 0,  -- součet order_services.price
    payment_method  text        CHECK (payment_method IN (
                                    'cash',         -- hotově
                                    'invoice',      -- faktura
                                    'personal_account', -- osobní účet
                                    'barter',       -- barter
                                    'other'         -- jiný
                                )),
    is_paid         boolean     NOT NULL DEFAULT false,
    is_invoiced     boolean     NOT NULL DEFAULT false,
    paid_at         timestamptz,

    -- Informace
    client_requirements text,   -- nadstandardní požadavky klienta
    internal_notes      text,   -- interní poznámky

    -- Odkaz na zdrojovou zakázku (při kopírování)
    copied_from_order_id uuid   REFERENCES orders(id) ON DELETE SET NULL,

    -- Odkaz na cenovou nabídku (Phase 2)
    -- quote_id          uuid   REFERENCES quotes(id) ON DELETE SET NULL,

    -- Odkaz na dlouhodobý projekt (Phase 2)
    -- long_term_project_id uuid REFERENCES long_term_projects(id) ON DELETE SET NULL,

    created_by_user_id  uuid    REFERENCES users(id) ON DELETE SET NULL
);

COMMENT ON TABLE orders IS
    'Zakázky – hlavní entita systému Muzicek. Každá zakázka má termín, stav, '
    'zákazníka, vozidlo, výpis služeb (order_services), checklist a přiřazené zaměstnance.';
COMMENT ON COLUMN orders.status IS
    'draft = nepotvrzená nabídka | planned = potvrzena | in_progress = probíhá | '
    'done = dokončena | archived = archivována';
COMMENT ON COLUMN orders.order_number IS
    'Lidsky čitelné číslo zakázky, generuje aplikace, např. MZ-2026-0042.';

CREATE INDEX idx_orders_contact        ON orders(contact_id);
CREATE INDEX idx_orders_vehicle        ON orders(vehicle_id);
CREATE INDEX idx_orders_status         ON orders(status);
CREATE INDEX idx_orders_scheduled_start ON orders(scheduled_start);
CREATE INDEX idx_orders_is_paid        ON orders(is_paid);
CREATE INDEX idx_orders_created_by     ON orders(created_by_user_id);
CREATE INDEX idx_orders_order_number   ON orders(order_number);


-- =============================================================================
-- 7. ORDER_SERVICES
-- Výčet konkrétních služeb přiřazených k zakázce.
-- Buď odkaz na předdefinovanou službu (service_id) nebo vlastní popis (custom_name).
-- =============================================================================
CREATE TABLE IF NOT EXISTS order_services (
    id              uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),

    order_id        uuid        NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    category_id     uuid        NOT NULL REFERENCES service_categories(id) ON DELETE RESTRICT,

    -- Předdefinovaná služba (NULL = vlastní/volná položka)
    service_id      uuid        REFERENCES services(id) ON DELETE SET NULL,

    -- Pro vlastní (volné) služby nebo přepsání názvu
    custom_name     text,

    -- Cena za tuto konkrétní položku na zakázce
    price           numeric(10,2) NOT NULL DEFAULT 0,

    sort_order      integer     NOT NULL DEFAULT 0,
    notes           text,

    CONSTRAINT order_services_must_have_name
        CHECK (service_id IS NOT NULL OR (custom_name IS NOT NULL AND custom_name <> ''))
);

COMMENT ON TABLE order_services IS
    'Položky služeb přiřazené ke konkrétní zakázce. Může jít o předdefinovanou '
    'službu (service_id) nebo volně zapsanou (custom_name). Základ pro výpočet '
    'obratu dle kategorií (service_categories).';
COMMENT ON COLUMN order_services.custom_name IS
    'Používá se pro individuální / nestandartní služby, které nejsou v číselníku.';

CREATE INDEX idx_order_services_order    ON order_services(order_id);
CREATE INDEX idx_order_services_category ON order_services(category_id);
CREATE INDEX idx_order_services_service  ON order_services(service_id);


-- =============================================================================
-- 8. ORDER_ASSIGNMENTS
-- Přiřazení zaměstnanců k zakázce.
-- Zaměstnanec může být přiřazen k celé zakázce nebo ke konkrétní službě.
-- =============================================================================
CREATE TABLE IF NOT EXISTS order_assignments (
    id                  uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),

    order_id            uuid        NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    user_id             uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Volitelné přiřazení ke konkrétní kategorii / službě zakázky
    order_service_id    uuid        REFERENCES order_services(id) ON DELETE SET NULL,

    role                text,       -- volitelný popis role na zakázce

    UNIQUE (order_id, user_id, order_service_id)
);

COMMENT ON TABLE order_assignments IS
    'Přiřazení zaměstnanců k zakázce nebo ke konkrétní službě v rámci zakázky. '
    'Základ pro odesílání notifikací relevantním zaměstnancům při změně.';

CREATE INDEX idx_order_assignments_order   ON order_assignments(order_id);
CREATE INDEX idx_order_assignments_user    ON order_assignments(user_id);
CREATE INDEX idx_order_assignments_service ON order_assignments(order_service_id);


-- =============================================================================
-- 9. ORDER_CHECKLIST_ITEMS
-- Checklist průběhu zakázky – každá položka = jeden krok / úkon.
-- Umožňuje sledování stavu v průběhu dne, řízení práce zaměstnanců.
-- =============================================================================
CREATE TABLE IF NOT EXISTS order_checklist_items (
    id              uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),

    order_id        uuid        NOT NULL REFERENCES orders(id) ON DELETE CASCADE,

    -- Volitelná vazba na konkrétní službu v rámci zakázky
    order_service_id uuid       REFERENCES order_services(id) ON DELETE SET NULL,

    title           text        NOT NULL,
    is_done         boolean     NOT NULL DEFAULT false,
    done_at         timestamptz,

    -- Zaměstnanec zodpovědný za tento krok
    assigned_to_user_id uuid    REFERENCES users(id) ON DELETE SET NULL,

    sort_order      integer     NOT NULL DEFAULT 0,
    notes           text
);

COMMENT ON TABLE order_checklist_items IS
    'Checklist kroků / úkonů zakázky. Slouží ke sledování průběhu během dne '
    'a řízení práce zaměstnanců. Položky mohou být svázány s konkrétní službou '
    'a přiřazeny konkrétnímu zaměstnanci.';

CREATE INDEX idx_checklist_order   ON order_checklist_items(order_id);
CREATE INDEX idx_checklist_service ON order_checklist_items(order_service_id);
CREATE INDEX idx_checklist_user    ON order_checklist_items(assigned_to_user_id);
CREATE INDEX idx_checklist_is_done ON order_checklist_items(is_done);


-- =============================================================================
-- 10. NOTES
-- Globální poznámky – centrální deník pro rychlé záznamy.
-- Poznámka může být přiřazena k zakázce nebo zůstat obecná.
-- =============================================================================
CREATE TABLE IF NOT EXISTS notes (
    id              uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),

    created_by_user_id uuid     REFERENCES users(id) ON DELETE SET NULL,

    content         text        NOT NULL,

    -- Volitelná vazba na zakázku, kontakt nebo vozidlo
    order_id        uuid        REFERENCES orders(id) ON DELETE SET NULL,
    contact_id      uuid        REFERENCES contacts(id) ON DELETE SET NULL,
    vehicle_id      uuid        REFERENCES vehicles(id) ON DELETE SET NULL,

    -- Stav poznámky
    status          text        NOT NULL DEFAULT 'active'
                                CHECK (status IN (
                                    'active',    -- čeká na řešení / volně visí
                                    'linked',    -- přiřazena k zakázce / entitě
                                    'archived'   -- vyřešena / archivována
                                ))
);

COMMENT ON TABLE notes IS
    'Centrální deník poznámek. Rychlé záznamy během dne – mohou být přiřazeny '
    'k zakázce, kontaktu nebo vozidlu, nebo zůstat obecné. '
    'Status: active = čeká | linked = přiřazena entitě | archived = vyřešena.';

CREATE INDEX idx_notes_created_by ON notes(created_by_user_id);
CREATE INDEX idx_notes_order      ON notes(order_id);
CREATE INDEX idx_notes_contact    ON notes(contact_id);
CREATE INDEX idx_notes_status     ON notes(status);


-- =============================================================================
-- PHASE 2 TABLES (stubs – struktury připraveny, zatím bez RLS politik)
-- =============================================================================

-- 11. ATTENDANCE – Docházka zaměstnanců
-- Každý záznam = jeden den / směna zaměstnance.
CREATE TABLE IF NOT EXISTS attendance (
    id              uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),

    user_id         uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date            date        NOT NULL,
    check_in        timestamptz,
    check_out       timestamptz,
    hours_worked    numeric(5,2),

    status          text        NOT NULL DEFAULT 'present'
                                CHECK (status IN ('present', 'absent', 'vacation', 'sick', 'holiday')),
    notes           text,

    UNIQUE (user_id, date)
);
COMMENT ON TABLE attendance IS
    '[Fáze 2] Docházka zaměstnanců – denní záznamy příchodů a odchodů.';
CREATE INDEX idx_attendance_user ON attendance(user_id);
CREATE INDEX idx_attendance_date ON attendance(date);


-- 12. BONUSES – Bonusy a srážky (fuck-upy)
CREATE TABLE IF NOT EXISTS bonuses (
    id              uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),

    user_id         uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    order_id        uuid        REFERENCES orders(id) ON DELETE SET NULL,
    date            date        NOT NULL,

    type            text        NOT NULL CHECK (type IN ('bonus', 'penalty')),
    amount          numeric(10,2) NOT NULL,
    reason          text        NOT NULL,

    created_by_user_id uuid     REFERENCES users(id) ON DELETE SET NULL
);
COMMENT ON TABLE bonuses IS
    '[Fáze 2] Bonusy a srážky zaměstnanců (tzv. "fuck-upy"). Napojeno na zakázky.';
CREATE INDEX idx_bonuses_user ON bonuses(user_id);
CREATE INDEX idx_bonuses_date ON bonuses(date);


-- 13. COSTS – Náklady zakázky / provozní náklady
CREATE TABLE IF NOT EXISTS costs (
    id              uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),

    order_id        uuid        REFERENCES orders(id) ON DELETE SET NULL,
    date            date        NOT NULL,
    category        text        NOT NULL,  -- materiál, subdodavatel, doprava, …
    description     text,
    amount          numeric(10,2) NOT NULL,
    currency        text        NOT NULL DEFAULT 'CZK',
    supplier        text,
    receipt_url     text,

    created_by_user_id uuid     REFERENCES users(id) ON DELETE SET NULL
);
COMMENT ON TABLE costs IS
    '[Fáze 2] Náklady na zakázky a provoz. Základ pro výpočet marže.';
CREATE INDEX idx_costs_order ON costs(order_id);
CREATE INDEX idx_costs_date  ON costs(date);


-- 14. QUOTES – Cenové nabídky
CREATE TABLE IF NOT EXISTS quotes (
    id              uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),

    quote_number    text        UNIQUE,
    contact_id      uuid        REFERENCES contacts(id) ON DELETE SET NULL,
    vehicle_id      uuid        REFERENCES vehicles(id) ON DELETE SET NULL,

    proposed_date   date,
    valid_until     date,
    total_price     numeric(10,2) NOT NULL DEFAULT 0,

    status          text        NOT NULL DEFAULT 'draft'
                                CHECK (status IN ('draft', 'sent', 'accepted', 'rejected', 'expired')),

    items           jsonb       NOT NULL DEFAULT '[]',  -- snapshot položek nabídky
    notes           text,

    -- Po přijetí nabídky → zakázka
    converted_to_order_id uuid  REFERENCES orders(id) ON DELETE SET NULL,

    created_by_user_id uuid     REFERENCES users(id) ON DELETE SET NULL
);
COMMENT ON TABLE quotes IS
    '[Fáze 2] Cenové nabídky. Po přijetí klientem se konvertují na zakázku. '
    'Nepotvrzené nabídky (status=sent) jsou viditelné v kalendáři jako draft termín.';
CREATE INDEX idx_quotes_contact ON quotes(contact_id);
CREATE INDEX idx_quotes_status  ON quotes(status);


-- 15. CLIENT_MESSAGES – Komunikace s klienty / zpětná vazba
CREATE TABLE IF NOT EXISTS client_messages (
    id              uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),

    order_id        uuid        REFERENCES orders(id) ON DELETE SET NULL,
    contact_id      uuid        REFERENCES contacts(id) ON DELETE SET NULL,

    type            text        NOT NULL CHECK (type IN ('reminder', 'feedback_request', 'custom')),
    channel         text        NOT NULL DEFAULT 'whatsapp'
                                CHECK (channel IN ('whatsapp', 'email', 'sms')),
    content         text        NOT NULL,

    scheduled_at    timestamptz,
    sent_at         timestamptz,
    status          text        NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),

    created_by_user_id uuid     REFERENCES users(id) ON DELETE SET NULL
);
COMMENT ON TABLE client_messages IS
    '[Fáze 2] Komunikace s klienty – připomínky den před zakázkou (WhatsApp), '
    'žádosti o zpětnou vazbu, apod.';
CREATE INDEX idx_client_messages_order   ON client_messages(order_id);
CREATE INDEX idx_client_messages_contact ON client_messages(contact_id);
CREATE INDEX idx_client_messages_status  ON client_messages(status);
CREATE INDEX idx_client_messages_sched   ON client_messages(scheduled_at);


-- 16. LONG_TERM_PROJECTS – Zastřešující projekt pro více zakázek
CREATE TABLE IF NOT EXISTS long_term_projects (
    id              uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),

    name            text        NOT NULL,
    contact_id      uuid        REFERENCES contacts(id) ON DELETE SET NULL,
    vehicle_id      uuid        REFERENCES vehicles(id) ON DELETE SET NULL,

    start_date      date,
    end_date        date,
    description     text,

    status          text        NOT NULL DEFAULT 'active'
                                CHECK (status IN ('active', 'on_hold', 'completed', 'cancelled')),

    notes           text,
    created_by_user_id uuid     REFERENCES users(id) ON DELETE SET NULL
);
COMMENT ON TABLE long_term_projects IS
    '[Fáze 2] Zastřešující dlouhodobé projekty (trvající týdny/měsíce). '
    'Jeden projekt sdružuje více zakázek. Orders.long_term_project_id na ně odkazuje.';

-- Přidání vazby na dlouhodobý projekt do orders (připraveno jako komentář)
-- ALTER TABLE orders ADD COLUMN long_term_project_id uuid REFERENCES long_term_projects(id) ON DELETE SET NULL;
-- ALTER TABLE orders ADD COLUMN quote_id uuid REFERENCES quotes(id) ON DELETE SET NULL;


-- =============================================================================
-- TRIGGERS – automatická aktualizace updated_at
-- =============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
    tbl text;
BEGIN
    FOREACH tbl IN ARRAY ARRAY[
        'users', 'service_categories', 'services', 'contacts', 'vehicles',
        'orders', 'order_services', 'order_assignments', 'order_checklist_items',
        'notes', 'attendance', 'bonuses', 'costs', 'quotes',
        'client_messages', 'long_term_projects'
    ]
    LOOP
        EXECUTE format('
            CREATE TRIGGER trg_%I_updated_at
            BEFORE UPDATE ON %I
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        ', tbl, tbl);
    END LOOP;
END;
$$;


-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

-- Pomocná funkce: vrátí app_role aktuálního uživatele
CREATE OR REPLACE FUNCTION get_my_app_role()
RETURNS text AS $$
    SELECT app_role FROM users WHERE id = auth.uid()
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Pomocná funkce: vrátí ID aktuálního uživatele
CREATE OR REPLACE FUNCTION get_my_id()
RETURNS uuid AS $$
    SELECT auth.uid()
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Pomocná funkce: je aktuální uživatel admin nebo manager?
CREATE OR REPLACE FUNCTION is_admin_or_manager()
RETURNS boolean AS $$
    SELECT get_my_app_role() IN ('admin', 'manager')
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Zapnutí RLS na všech tabulkách
ALTER TABLE users                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_categories      ENABLE ROW LEVEL SECURITY;
ALTER TABLE services                ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts                ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles                ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_services          ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_assignments       ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_checklist_items   ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance              ENABLE ROW LEVEL SECURITY;
ALTER TABLE bonuses                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE costs                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_messages         ENABLE ROW LEVEL SECURITY;
ALTER TABLE long_term_projects      ENABLE ROW LEVEL SECURITY;


-- -------------------------------------------------------
-- USERS
-- -------------------------------------------------------
CREATE POLICY users_select_own
    ON users FOR SELECT
    USING (id = auth.uid() OR is_admin_or_manager());

CREATE POLICY users_update_own
    ON users FOR UPDATE
    USING (id = auth.uid() OR is_admin_or_manager());

CREATE POLICY users_insert_admin
    ON users FOR INSERT
    WITH CHECK (is_admin_or_manager());

CREATE POLICY users_delete_admin
    ON users FOR DELETE
    USING (get_my_app_role() = 'admin');


-- -------------------------------------------------------
-- SERVICE_CATEGORIES & SERVICES (číselníky – čtení pro všechny, zápis jen admin)
-- -------------------------------------------------------
CREATE POLICY sc_select_all
    ON service_categories FOR SELECT
    USING (auth.uid() IS NOT NULL);

CREATE POLICY sc_write_admin
    ON service_categories FOR ALL
    USING (get_my_app_role() = 'admin')
    WITH CHECK (get_my_app_role() = 'admin');

CREATE POLICY svc_select_all
    ON services FOR SELECT
    USING (auth.uid() IS NOT NULL);

CREATE POLICY svc_write_admin
    ON services FOR ALL
    USING (get_my_app_role() = 'admin')
    WITH CHECK (get_my_app_role() = 'admin');


-- -------------------------------------------------------
-- CONTACTS – čtení a zápis pro všechny přihlášené,
--            mazání jen admin/manager
-- -------------------------------------------------------
CREATE POLICY contacts_select
    ON contacts FOR SELECT
    USING (auth.uid() IS NOT NULL);

CREATE POLICY contacts_insert
    ON contacts FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY contacts_update
    ON contacts FOR UPDATE
    USING (auth.uid() IS NOT NULL);

CREATE POLICY contacts_delete
    ON contacts FOR DELETE
    USING (is_admin_or_manager());


-- -------------------------------------------------------
-- VEHICLES – stejné jako contacts
-- -------------------------------------------------------
CREATE POLICY vehicles_select
    ON vehicles FOR SELECT
    USING (auth.uid() IS NOT NULL);

CREATE POLICY vehicles_insert
    ON vehicles FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY vehicles_update
    ON vehicles FOR UPDATE
    USING (auth.uid() IS NOT NULL);

CREATE POLICY vehicles_delete
    ON vehicles FOR DELETE
    USING (is_admin_or_manager());


-- -------------------------------------------------------
-- ORDERS
-- Worker vidí pouze zakázky, ke kterým je přiřazen.
-- Admin/manager vidí vše.
-- -------------------------------------------------------
CREATE POLICY orders_select_admin
    ON orders FOR SELECT
    USING (
        is_admin_or_manager()
        OR EXISTS (
            SELECT 1 FROM order_assignments oa
            WHERE oa.order_id = orders.id AND oa.user_id = auth.uid()
        )
    );

CREATE POLICY orders_insert
    ON orders FOR INSERT
    WITH CHECK (is_admin_or_manager());

CREATE POLICY orders_update
    ON orders FOR UPDATE
    USING (is_admin_or_manager());

CREATE POLICY orders_delete
    ON orders FOR DELETE
    USING (get_my_app_role() = 'admin');


-- -------------------------------------------------------
-- ORDER_SERVICES, ORDER_CHECKLIST_ITEMS – dědí přístup z orders
-- -------------------------------------------------------
CREATE POLICY order_services_select
    ON order_services FOR SELECT
    USING (
        is_admin_or_manager()
        OR EXISTS (
            SELECT 1 FROM order_assignments oa
            WHERE oa.order_id = order_services.order_id AND oa.user_id = auth.uid()
        )
    );

CREATE POLICY order_services_write
    ON order_services FOR ALL
    USING (is_admin_or_manager())
    WITH CHECK (is_admin_or_manager());

CREATE POLICY checklist_select
    ON order_checklist_items FOR SELECT
    USING (
        is_admin_or_manager()
        OR assigned_to_user_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM order_assignments oa
            WHERE oa.order_id = order_checklist_items.order_id AND oa.user_id = auth.uid()
        )
    );

CREATE POLICY checklist_update_assigned
    ON order_checklist_items FOR UPDATE
    USING (
        is_admin_or_manager()
        OR assigned_to_user_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM order_assignments oa
            WHERE oa.order_id = order_checklist_items.order_id AND oa.user_id = auth.uid()
        )
    );

CREATE POLICY checklist_insert_delete
    ON order_checklist_items FOR INSERT
    WITH CHECK (is_admin_or_manager());

CREATE POLICY checklist_delete_policy
    ON order_checklist_items FOR DELETE
    USING (is_admin_or_manager());


-- -------------------------------------------------------
-- ORDER_ASSIGNMENTS – admin/manager spravuje, worker vidí svá
-- -------------------------------------------------------
CREATE POLICY assignments_select
    ON order_assignments FOR SELECT
    USING (
        is_admin_or_manager()
        OR user_id = auth.uid()
    );

CREATE POLICY assignments_write
    ON order_assignments FOR ALL
    USING (is_admin_or_manager())
    WITH CHECK (is_admin_or_manager());


-- -------------------------------------------------------
-- NOTES – každý vidí své poznámky + admin/manager vidí vše
-- -------------------------------------------------------
CREATE POLICY notes_select
    ON notes FOR SELECT
    USING (
        is_admin_or_manager()
        OR created_by_user_id = auth.uid()
    );

CREATE POLICY notes_insert
    ON notes FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY notes_update
    ON notes FOR UPDATE
    USING (is_admin_or_manager() OR created_by_user_id = auth.uid());

CREATE POLICY notes_delete
    ON notes FOR DELETE
    USING (is_admin_or_manager() OR created_by_user_id = auth.uid());


-- -------------------------------------------------------
-- PHASE 2 TABLES – základní RLS (admin/manager plný přístup,
--                  worker vidí jen vlastní záznamy)
-- -------------------------------------------------------

-- ATTENDANCE
CREATE POLICY attendance_select
    ON attendance FOR SELECT
    USING (is_admin_or_manager() OR user_id = auth.uid());

CREATE POLICY attendance_write
    ON attendance FOR ALL
    USING (is_admin_or_manager())
    WITH CHECK (is_admin_or_manager());

-- BONUSES
CREATE POLICY bonuses_select
    ON bonuses FOR SELECT
    USING (is_admin_or_manager() OR user_id = auth.uid());

CREATE POLICY bonuses_write
    ON bonuses FOR ALL
    USING (is_admin_or_manager())
    WITH CHECK (is_admin_or_manager());

-- COSTS
CREATE POLICY costs_select
    ON costs FOR SELECT
    USING (is_admin_or_manager());

CREATE POLICY costs_write
    ON costs FOR ALL
    USING (is_admin_or_manager())
    WITH CHECK (is_admin_or_manager());

-- QUOTES
CREATE POLICY quotes_select
    ON quotes FOR SELECT
    USING (is_admin_or_manager());

CREATE POLICY quotes_write
    ON quotes FOR ALL
    USING (is_admin_or_manager())
    WITH CHECK (is_admin_or_manager());

-- CLIENT_MESSAGES
CREATE POLICY client_messages_select
    ON client_messages FOR SELECT
    USING (is_admin_or_manager());

CREATE POLICY client_messages_write
    ON client_messages FOR ALL
    USING (is_admin_or_manager())
    WITH CHECK (is_admin_or_manager());

-- LONG_TERM_PROJECTS
CREATE POLICY ltp_select
    ON long_term_projects FOR SELECT
    USING (is_admin_or_manager());

CREATE POLICY ltp_write
    ON long_term_projects FOR ALL
    USING (is_admin_or_manager())
    WITH CHECK (is_admin_or_manager());


-- =============================================================================
-- APP_ERROR_LOG (přeneseno z Kevelyn – genericky užitečné)
-- =============================================================================
CREATE TABLE IF NOT EXISTS app_error_log (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at      timestamptz DEFAULT now(),
    error_type      text,
    error_message   text,
    error_stack     text,
    component_stack text,
    page_url        text,
    user_email      text,
    last_clicks     jsonb,
    extra           jsonb,
    context         text,
    status          text,
    user_id         uuid        REFERENCES users(id) ON DELETE SET NULL,
    user_agent      text
);
COMMENT ON TABLE app_error_log IS
    'Logy aplikačních chyb – pro debugging a monitoring.';

ALTER TABLE app_error_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY error_log_admin
    ON app_error_log FOR ALL
    USING (get_my_app_role() = 'admin')
    WITH CHECK (get_my_app_role() = 'admin');

CREATE POLICY error_log_insert_any
    ON app_error_log FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);


-- =============================================================================
-- KONEC MIGRACE
-- =============================================================================
