# MUŽÍČEK – Plán vývoje aplikace
## Instrukce pro Claude Code – postupné fáze

---

## KONTEXT A STACK

- **Frontend:** React + Vite + TypeScript + Tailwind CSS
- **Backend/DB:** Supabase (PostgreSQL + Auth + RLS)
- **Deployment:** Vercel
- **Repo:** GitHub → Vercel auto-deploy na každý push do `main`

---

## DATOVÝ MODEL (přehled vztahů)

Než začneš kódovat, musíš rozumět jak tabulky fungují dohromady:

```
service_category → service          (1 kategorie má N služeb)
customer → customer_vehicle          (1 klient má N vozidel)
customer → order                     (1 klient má N zakázek)
customer_vehicle → order             (1 vozidlo má N zakázek)
order → order_service                (M:N – zakázka obsahuje N služeb)
order → order_worker                 (M:N – na zakázce pracuje N zaměstnanců)
order → checklist_item               (1 zakázka má N položek checklistu)
order → note                         (poznámky navázané na zakázku)
worker → order_worker                (zaměstnanec je přiřazen na N zakázek)
worker → checklist_item              (zaměstnanec zodpovídá za N úkolů)
```

**Klíčová pravidla:**
- `order_service` může obsahovat buď `service_id` (předdefinovaná služba) NEBO `custom_service_name` (volná položka) – nikdy ne obojí najednou
- `order.status` může být: `planned` | `confirmed` | `in_progress` | `completed` | `archived`
- `order.total_price` se vždy počítá jako součet `order_service.price * quantity`
- `note.status` může být: `active` | `assigned` | `archived`

---

## FÁZE 0 – Databáze a základní konfigurace
**Cíl:** Funkční Supabase projekt se správnou strukturou

### Zadání pro Claude Code:
```
Spusť v Supabase SQL Editoru migration script muzicek_migration_v2.sql.
Ověř, že všechny tabulky byly vytvořeny správně.
```

### Testování:
- [ ] V Supabase Table Editoru vidíš 11 tabulek: `users`, `worker`, `service_category`, `service`, `customer`, `customer_vehicle`, `order`, `order_service`, `order_worker`, `checklist_item`, `note`
- [ ] Tabulka `service_category` obsahuje 8 kategorií (PPF A WRAP, MYTÍ A ČIŠTĚNÍ, atd.)
- [ ] Tabulka `service` obsahuje ~40 předdefinovaných služeb
- [ ] Žádné chyby v SQL Editoru

---

## FÁZE 1 – Inicializace projektu a Supabase připojení
**Cíl:** Spustit aplikaci lokálně, připojit Supabase, ověřit komunikaci s DB

### Zadání pro Claude Code:
```
V projektu na C:\Work\project_management_muzicek\production_application proveď:

1. Zkontroluj package.json a ujisti se, že jsou nainstalované závislosti:
   - @supabase/supabase-js
   - react-router-dom
   - Pokud chybí, přidej je přes npm install

2. Vytvoř soubor src/lib/supabase.ts:
   - inicializace Supabase klienta přes env proměnné VITE_SUPABASE_URL a VITE_SUPABASE_ANON_KEY

3. Vytvoř soubor .env.local s hodnotami z Supabase projektu

4. Uprav src/App.tsx – prozatím jen jednoduché "Hello Mužíček" s testem připojení k Supabase
   (načti seznam service_category a vypiš na stránku)
```

### Testování:
- [ ] `npm run dev` běží bez chyb
- [ ] Na `localhost:5173` se zobrazí stránka
- [ ] Na stránce vidíš vypis 8 kategorií služeb načtených ze Supabase
- [ ] V konzoli prohlížeče nejsou žádné chyby

---

## FÁZE 2 – Layout a navigace
**Cíl:** Základní shell aplikace – sidebar, routing, prázdné stránky

### Zadání pro Claude Code:
```
Vytvoř základní layout aplikace:

1. Hlavní layout (src/components/Layout.tsx):
   - Sidebar vlevo s navigací
   - Hlavní obsahová oblast vpravo

2. Navigační položky v sidebaru:
   - Zakázky (/)
   - Kalendář (/calendar)
   - Klienti (/customers)
   - Zaměstnanci (/workers)
   - Poznámky (/notes)
   - Nastavení (/settings)

3. Pro každou stránku vytvoř prázdný placeholder komponent v src/pages/

4. Nastav react-router-dom routing v App.tsx

5. Design: tmavý sidebar (#1a1a2e nebo podobná), světlý obsah,
   čistý profesionální vzhled. Tailwind CSS.
```

### Testování:
- [ ] Klikání na položky sidebaru mění URL a obsah stránky
- [ ] Na každé stránce se zobrazí alespoň nadpis stránky
- [ ] Layout je responzivní a nezobrazuje se chybně

---

## FÁZE 3 – Správa zaměstnanců
**Cíl:** CRUD pro tabulku `worker` – nejjednodušší entita, ideální pro ověření patterns

### Zadání pro Claude Code:
```
Vytvoř stránku Zaměstnanci (/workers):

Tabulka worker obsahuje: id, name, phone, email, role, categories (TEXT[]), is_active

1. Seznam zaměstnanců – tabulka s: jméno, telefon, role, aktivní/neaktivní
2. Tlačítko "Přidat zaměstnance" → modal/formulář
3. Formulář obsahuje: jméno*, telefon, e-mail, role, je aktivní (toggle)
4. Inline editace záznamu (kliknutí na řádek → editační modal)
5. Deaktivace zaměstnance (soft delete – is_active = false, nezmazat)

Vytvoř src/lib/api/workers.ts se funkcemi:
- getWorkers()
- createWorker(data)
- updateWorker(id, data)
- deactivateWorker(id)
```

### Testování:
- [ ] Vidíš seznam zaměstnanců (ze Supabase)
- [ ] Lze přidat nového zaměstnance
- [ ] Lze editovat existujícího zaměstnance
- [ ] Lze zaměstnance deaktivovat (zmizí ze seznamu nebo je označen)
- [ ] Změny přetrvávají po reload stránky

---

## FÁZE 4 – CRM: Klienti a vozidla
**Cíl:** Správa klientů a jejich vozidel

### Zadání pro Claude Code:
```
Vytvoř stránku Klienti (/customers):

Tabulky: customer, customer_vehicle (customer_vehicle.customer_id → customer.id)

1. Seznam klientů – vyhledávání podle jméno/telefon/SPZ
2. Detail klienta (kliknutí na řádek nebo /customers/:id):
   - Základní info: jméno, telefon, email, IČ, poznámka
   - Seznam jeho vozidel (aktivní i neaktivní)
   - Tlačítko pro přidání nového vozidla

3. Formulář pro klienta: jméno*, telefon, e-mail, IČ, poznámka
4. Formulář pro vozidlo: značka, model, SPZ*, VIN, barva, rok, specifikace,
   platnost TK (datum), poznámka, je_aktivní

5. Platnost TK: pokud je méně než 30 dní, zobraz červeně
   Pokud je méně než 60 dní, zobraz oranžově

Vytvoř src/lib/api/customers.ts a src/lib/api/vehicles.ts
```

### Testování:
- [ ] Lze vytvořit klienta
- [ ] Klientovi lze přidat vozidlo
- [ ] Detail klienta zobrazuje jeho vozidla
- [ ] TK expirace je barevně odlišena
- [ ] Vyhledávání funguje

---

## FÁZE 5 – Zakázky: Základní CRUD
**Cíl:** Vytvořit a zobrazit zakázku se základními daty (bez služeb a checklistu)

### Zadání pro Claude Code:
```
Vytvoř stránku Zakázky (/) – seznam a tvorba zakázky:

Tabulka order: id, order_number, customer_id, vehicle_id, scheduled_start,
scheduled_end, status, total_price, payment_method, is_paid, is_invoiced,
customer_notes, internal_notes

1. Seznam zakázek:
   - Karta nebo řádek pro každou zakázku
   - Zobrazit: číslo zakázky, klient, SPZ vozidla, datum, status, celková cena
   - Filtrovat podle statusu (planned/confirmed/in_progress/completed/archived)
   - Status je barevně odlišen:
     planned = šedá, confirmed = modrá, in_progress = oranžová,
     completed = zelená, archived = tmavá

2. Tlačítko "Nová zakázka" → formulář (nová stránka nebo modal):
   - Výběr klienta z existujících (autocomplete/select) NEBO přidání nového
   - Po výběru klienta: výběr jeho vozidla
   - Datum od–do
   - Poznámky klienta, interní poznámky
   - Způsob platby: hotově / faktura / osobní účet / barter / jiný
   - Číslo zakázky se generuje automaticky (např. Z-2024-001)

3. Detail zakázky (/orders/:id) – prozatím zobraz jen základní info

Vytvoř src/lib/api/orders.ts s funkcemi:
- getOrders(filters?)
- getOrder(id)
- createOrder(data)
- updateOrder(id, data)
- generateOrderNumber() – vrátí další číslo v řadě
```

### Testování:
- [ ] Lze vytvořit zakázku s klientem a vozidlem
- [ ] Zakázka se zobrazí v seznamu
- [ ] Filtrování podle statusu funguje
- [ ] Detail zakázky zobrazuje správná data
- [ ] Číslo zakázky se generuje automaticky

---

## FÁZE 6 – Zakázky: Přidávání služeb
**Cíl:** Na zakázce lze vybrat/přidat služby, počítat celkovou cenu

### Zadání pro Claude Code:
```
Rozšiř detail zakázky (/orders/:id) o sekci Služby:

Tabulky: order_service (order_id, service_id, custom_service_name,
custom_description, price, quantity), service, service_category

1. Zobrazení služeb na zakázce:
   - Seskupené podle kategorie (PPF A WRAP, MYTÍ A ČIŠTĚNÍ, atd.)
   - Každá kategorie má svoji barvu (z color_class v service_category)
   - U každé služby: název, cena, množství, mezisoučet

2. Přidání předdefinované služby:
   - Panel/modal se seznamem kategorií a jejich služeb
   - Lze zaškrtnout více služeb najednou ("vyklikání")
   - Po potvrzení se přidají do order_service

3. Přidání vlastní (volné) služby:
   - Textové pole pro název
   - Popis, cena, množství

4. Editace/odebrání služby ze zakázky

5. Celková cena zakázky:
   - Automatický součet (order_service.price * quantity)
   - Updatuj order.total_price při každé změně

6. Cenový rozpad: zobraz součet za každou kategorii zvlášť

Vytvoř src/lib/api/orderServices.ts
```

### Testování:
- [ ] Lze přidat předdefinovanou službu ze seznamu
- [ ] Lze přidat vlastní službu s popisem
- [ ] Celková cena se aktualizuje automaticky
- [ ] Služby jsou barevně seskupené podle kategorií
- [ ] Cenový rozpad podle kategorií je správný
- [ ] Lze odebrat službu ze zakázky

---

## FÁZE 7 – Zakázky: Checklist a zaměstnanci
**Cíl:** Sledování průběhu zakázky, přiřazení zaměstnanců

### Zadání pro Claude Code:
```
Rozšiř detail zakázky o sekci Checklist a Zaměstnanci:

Tabulka checklist_item: order_id, title, description, is_completed,
assigned_to (worker.id), assigned_service_id, sort_order

Tabulka order_worker: order_id, worker_id, service_id

1. Checklist:
   - Seznam položek s checkboxem (is_completed)
   - Přidat novou položku (title, volitelně: popis, přiřazený zaměstnanec)
   - Zaškrtnutí označí jako hotové (ukládá completed_at)
   - Drag & drop řazení (sort_order) – nebo tlačítka nahoru/dolů
   - Vizuální progress: "3 / 7 hotovo" + progress bar

2. Přiřazení zaměstnanců na zakázku:
   - Multi-select zaměstnanců ze seznamu aktivních workerů
   - Volitelně přiřadit zaměstnance ke konkrétní službě

3. Změna statusu zakázky:
   - Tlačítka pro přechod: Potvrdit → Zahájit → Dokončit → Archivovat
   - Každý přechod updatuje order.status

Vytvoř src/lib/api/checklist.ts a src/lib/api/orderWorkers.ts
```

### Testování:
- [ ] Lze přidat položku do checklistu
- [ ] Zaškrtnutí položky se uloží
- [ ] Progress bar odpovídá počtu hotových položek
- [ ] Lze přiřadit zaměstnance na zakázku
- [ ] Přechody stavu fungují správně

---

## FÁZE 8 – Poznámky
**Cíl:** Globální systém poznámek s možností přiřazení k zakázce

### Zadání pro Claude Code:
```
Vytvoř stránku Poznámky (/notes):

Tabulka note: title, content, order_id (nullable), customer_id (nullable),
status (active/assigned/archived), priority

1. Seznam aktivních poznámek (status = 'active'):
   - Rychlé přidání nové poznámky (jen content, bez formuláře)
   - Kliknutí rozbalí detail

2. Na každé poznámce akce:
   - "Přiřadit k zakázce" → select zakázky → status se změní na 'assigned',
     zmizí z hlavního seznamu, objeví se v detailu zakázky
   - "Archivovat" → status = 'archived'

3. Archiv – záložka s archivovaými poznámkami

4. V detailu zakázky: zobraz přiřazené poznámky (note.order_id = order.id)

Vytvoř src/lib/api/notes.ts
```

### Testování:
- [ ] Lze rychle přidat poznámku
- [ ] Přiřazení k zakázce funguje a poznámka zmizí ze seznamu
- [ ] Archivace funguje
- [ ] V detailu zakázky jsou vidět přiřazené poznámky

---

## FÁZE 9 – Kalendář zakázek
**Cíl:** Vizuální kalendář s přehledem zakázek

### Zadání pro Claude Code:
```
Vytvoř stránku Kalendář (/calendar):

1. Měsíční/týdenní pohled na zakázky podle scheduled_start a scheduled_end
   Doporučená knihovna: react-big-calendar nebo @fullcalendar/react

2. Každá zakázka je zobrazena jako blok:
   - Barva dle statusu (planned=šedá, confirmed=modrá, in_progress=oranžová, completed=zelená)
   - Název: klient + SPZ vozidla

3. Kliknutí na zakázku → přejde na detail zakázky

4. Nepotvrzené zakázky (status='planned') jsou zobrazeny průhledněji
   ale stále viditelně – je potřeba s nimi počítat při plánování

5. Tlačítko "Nová zakázka" přímo z kalendáře s předvyplněným datem
```

### Testování:
- [ ] Zakázky se zobrazují na správných datech
- [ ] Barevné odlišení dle statusu funguje
- [ ] Kliknutí přechází na detail zakázky
- [ ] Nepotvrzené zakázky jsou vizuálně odlišeny

---

## FÁZE 10 – Duplikace zakázky a drobné funkce
**Cíl:** Dokončit zbývající funkce pro plnohodnotné použití

### Zadání pro Claude Code:
```
Přidej tyto funkce:

1. Duplikace zakázky:
   - Tlačítko "Zkopírovat zakázku" v detailu
   - Vytvoří novou zakázku se stejnými službami, klientem, vozidlem
   - Datum = prázdné (uživatel vyplní nový termín)
   - Status = 'planned'
   - Přesměruje na novou zakázku

2. Dashboard widget – expirace TK:
   - Na hlavní stránce nebo v sekci Klienti
   - Seznam vozidel s expirací TK do 60 dní
   - Seřazeno od nejbližší expirace

3. Vyhledávání v seznamu zakázek:
   - Podle: jméno klienta, SPZ, číslo zakázky
   - Živé filtrování při psaní

4. Stránkování nebo infinite scroll v seznamu zakázek
   (zakázky se budou hromadit – 50-75 měsíčně)

5. Označení zakázky jako zaplacená / vyfakturovaná
   - Toggle přímo v seznamu nebo detailu zakázky
```

### Testování:
- [ ] Duplikace zakázky funguje a přesměruje na novou
- [ ] Widget expirace TK zobrazuje správná vozidla
- [ ] Vyhledávání zakázek funguje v reálném čase
- [ ] Označení zaplaceno/vyfakturováno se ukládá

---

## FÁZE 11 – Polish a deployment
**Cíl:** Finální úpravy, error handling, nasazení

### Zadání pro Claude Code:
```
1. Error handling:
   - Toast notifikace pro úspěch/chybu při každé operaci
   - Loading stavy při načítání dat
   - Prázdné stavy (empty states) když nejsou žádná data

2. Validace formulářů:
   - Povinná pole označit hvězdičkou
   - Zobrazit chybové hlášky pod polem

3. Nastavení (/settings):
   - Správa kategorií služeb (přidat/upravit barvu)
   - Správa předdefinovaných služeb

4. Deployment kontrola:
   - Ověř že .env.local hodnoty jsou nastavené jako env variables ve Vercel
   - Push do main větve a ověř auto-deploy
   - Ověř že produkční build funguje správně
```

### Testování:
- [ ] Všechny operace mají toast notifikaci
- [ ] Loading spinnery jsou zobrazeny při čekání na data
- [ ] Formuláře validují povinná pole
- [ ] Produkční URL na Vercelu funguje stejně jako lokálně

---

## SOUHRN FÁZÍ

| Fáze | Co se staví | Klíčová tabulka |
|------|-------------|-----------------|
| 0 | Databáze | migrace |
| 1 | Supabase připojení | service_category |
| 2 | Layout + routing | – |
| 3 | Zaměstnanci | worker |
| 4 | Klienti + vozidla | customer, customer_vehicle |
| 5 | Zakázky (základ) | order |
| 6 | Služby na zakázce | order_service |
| 7 | Checklist + zaměstnanci | checklist_item, order_worker |
| 8 | Poznámky | note |
| 9 | Kalendář | order (scheduled_start/end) |
| 10 | Duplikace + doplňky | vše |
| 11 | Polish + deployment | – |
