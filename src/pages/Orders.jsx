import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getOrders, createOrder, deleteOrder, updateOrder, getChecklistItems, updateChecklistItem, getOrderServices, getStatusColor, getStatusBadge, getStatusLabel, getOrderDisplayName, validateStatusChange, validatePaymentFields } from '@/lib/api/orders';
import { getCustomers, createCustomer, deleteCustomer } from '@/lib/api/customers';
import { getVehiclesByCustomer, createVehicle, deleteVehicle, getTkStatus } from '@/lib/api/vehicles';
import { getServiceCategories } from '@/lib/api/services';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { Plus, Search, Trash2, ChevronDown, ChevronUp, ArrowUpDown } from 'lucide-react';

const statusOptions = [
  { value: 'planned', label: 'Plánováno' },
  { value: 'confirmed', label: 'Potvrzeno' },
  { value: 'in_progress', label: 'Probíhá' },
  { value: 'completed', label: 'Dokončeno' },
  { value: 'archived', label: 'Archivováno' },
];

const paymentMethods = [
  { value: 'cash', label: 'Hotově' },
  { value: 'invoice', label: 'Faktura' },
  { value: 'account', label: 'Osobní účet' },
  { value: 'barter', label: 'Barter' },
  { value: 'other', label: 'Jiný' },
];

const emptyNewCustomer = {
  name: '',
  phone: '',
  email: '',
  ico: '',
  note: '',
};

const emptyNewVehicle = {
  brand: '',
  model: '',
  spz: '',
  specification: '',
  color: '',
  vin: '',
  year: '',
  tk_expiry: '',
  note: '',
};

const emptyForm = {
  order_type: 'existing_customer', // 'existing_customer' | 'new_customer'
  // existing customer
  customer_id: '',
  vehicle_id: '',
  // new customer
  newCustomer: emptyNewCustomer,
  newVehicle: emptyNewVehicle,
  saveToDb: true,
  // order
  name: '',
  scheduled_start: '',
  scheduled_end: '',
  payment_method: 'invoice',
  customer_notes: '',
  internal_notes: '',
};

export default function OrdersPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const [orders, setOrders] = useState(/** @type {any[]} */([]));
  const [customers, setCustomers] = useState(/** @type {any[]} */([]));
  const [customerVehicles, setCustomerVehicles] = useState(/** @type {any[]} */([]));
  const [vehiclesLoading, setVehiclesLoading] = useState(false);

  const [serviceCategories, setServiceCategories] = useState(/** @type {any[]} */([]));
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(/** @type {string|null} */(null));

  const [selectedStatus, setSelectedStatus] = useState('');
  const [searchText, setSearchText] = useState('');
  const [sortDir, setSortDir] = useState('asc'); // sort by deadline asc/desc

  // Checklist per-card state (lazy loaded)
  const [expandedChecklists, setExpandedChecklists] = useState(new Set());
  const [orderChecklists, setOrderChecklists] = useState({}); // { [orderId]: items[] }
  const [orderServicesCache, setOrderServicesCache] = useState(/** @type {Object.<string, any[]>} */ ({})); // { [orderId]: items[] }
  const [loadingChecklist, setLoadingChecklist] = useState(new Set());

  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, orderId: null, orderName: '' });
  const [form, setForm] = useState(emptyForm);
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [nameManuallyEdited, setNameManuallyEdited] = useState(false);

  const loadData = async () => {
    setError(null);
    setIsLoading(true);
    try {
      const [ordersData, customersData, categoriesData] = await Promise.all([
        getOrders(selectedStatus ? { status: selectedStatus } : undefined),
        getCustomers(),
        getServiceCategories(),
      ]);
      setOrders(ordersData);
      setCustomers(customersData.filter((c) => c.status !== 'one_time'));
      setServiceCategories(categoriesData);
    } catch (err) {
      console.error('Load data error', err);
      const msg = 'Nepodařilo se načíst data.';
      setError(msg);
      toast({ variant: 'destructive', title: 'Chyba', description: msg });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedStatus]);

  // Open create dialog when navigated from Dashboard "Nová zakázka"
  useEffect(() => {
    if (location.state?.openCreate) {
      setForm(emptyForm);
      setDialogOpen(true);
      window.history.replaceState({}, '');
    }
  }, []);

  // Load vehicles when existing customer is selected
  useEffect(() => {
    if (form.order_type !== 'existing_customer' || !form.customer_id) {
      setCustomerVehicles([]);
      setVehiclesLoading(false);
      return;
    }
    setVehiclesLoading(true);
    (async () => {
      try {
        const vehicles = await getVehiclesByCustomer(form.customer_id);
        setCustomerVehicles(vehicles);
        if (form.vehicle_id && !vehicles.find((v) => v.id === form.vehicle_id)) {
          setForm((prev) => ({ ...prev, vehicle_id: '' }));
        } else if (!form.vehicle_id && vehicles.length === 1) {
          // Rule 11: auto-select the only vehicle
          setForm((prev) => ({ ...prev, vehicle_id: vehicles[0].id }));
        }
      } catch (err) {
        console.error('Load vehicles error', err);
      } finally {
        setVehiclesLoading(false);
      }
    })();
  }, [form.customer_id, form.order_type]);

  // Auto-fill order name — only when user hasn't manually edited it
  useEffect(() => {
    if (nameManuallyEdited) return;

    let customerName = '';
    let vehicleName = '';

    if (form.order_type === 'existing_customer') {
      const cust = customers.find((c) => c.id === form.customer_id);
      const veh = customerVehicles.find((v) => v.id === form.vehicle_id);
      customerName = cust?.name || '';
      vehicleName = veh ? `${veh.brand || ''} ${veh.model || ''}`.trim() : '';
    } else {
      customerName = form.newCustomer.name.trim();
      vehicleName = [form.newVehicle.brand, form.newVehicle.model].filter(Boolean).join(' ');
    }

    const dateStr = form.scheduled_end || form.scheduled_start;
    const datePart = dateStr
      ? new Date(dateStr).toLocaleDateString('cs-CZ', { day: '2-digit', month: '2-digit', year: 'numeric' })
      : '';

    const generated = [customerName, vehicleName, datePart].filter(Boolean).join(' – ');
    setForm((prev) => ({ ...prev, name: generated }));
  }, [
    nameManuallyEdited,
    form.order_type,
    form.customer_id,
    form.vehicle_id,
    form.newCustomer.name,
    form.newVehicle.brand,
    form.newVehicle.model,
    form.scheduled_start,
    form.scheduled_end,
    customers,
    customerVehicles,
  ]);

  const filteredOrders = orders.filter((order) => {
    if (!searchText) return true;
    const text = searchText.toLowerCase();
    const orderDisplayName = getOrderDisplayName(order).toLowerCase();
    return (
      orderDisplayName.includes(text) ||
      order.customer?.name?.toLowerCase().includes(text) ||
      order.vehicle?.spz?.toLowerCase().includes(text)
    );
  });

  const sortedOrders = [...filteredOrders].sort((a, b) => {
    const aDate = a.scheduled_end ? new Date(a.scheduled_end) : null;
    const bDate = b.scheduled_end ? new Date(b.scheduled_end) : null;
    if (!aDate && !bDate) return 0;
    if (!aDate) return 1;
    if (!bDate) return -1;
    return sortDir === 'asc' ? aDate.getTime() - bDate.getTime() : bDate.getTime() - aDate.getTime();
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const isOverdue = (order) => {
    if (!order.scheduled_end) return false;
    if (['completed', 'archived'].includes(order.status)) return false;
    return new Date(order.scheduled_end) < today;
  };

  const toggleChecklist = async (e, orderId) => {
    e.stopPropagation();
    const next = new Set(expandedChecklists);
    if (next.has(orderId)) {
      next.delete(orderId);
      setExpandedChecklists(next);
      return;
    }
    next.add(orderId);
    setExpandedChecklists(next);
    if (!orderChecklists[orderId]) {
      setLoadingChecklist((prev) => new Set(prev).add(orderId));
      try {
        const items = await getChecklistItems(orderId);
        setOrderChecklists((prev) => ({ ...prev, [orderId]: items }));
      } finally {
        setLoadingChecklist((prev) => { const s = new Set(prev); s.delete(orderId); return s; });
      }
    }
  };

  const toggleOrderChecklistItem = async (e, orderId, item) => {
    e.stopPropagation();
    const newVal = !item.is_completed;
    setOrderChecklists((prev) => ({
      ...prev,
      [orderId]: prev[orderId].map((i) => i.id === item.id ? { ...i, is_completed: newVal } : i),
    }));
    try {
      await updateChecklistItem(item.id, { is_completed: newVal, completed_at: newVal ? new Date().toISOString() : null });
    } catch {
      setOrderChecklists((prev) => ({
        ...prev,
        [orderId]: prev[orderId].map((i) => i.id === item.id ? item : i),
      }));
    }
  };

  const handleQuickStatus = async (e, orderId, newStatus) => {
    e.stopPropagation();
    if (newStatus === 'completed') {
      let services = orderServicesCache[orderId];
      if (!services) {
        services = await getOrderServices(orderId);
        setOrderServicesCache((prev) => ({ ...prev, [orderId]: services }));
      }
      const statusError = validateStatusChange(newStatus, services.length);
      if (statusError) {
        toast({ variant: 'destructive', title: 'Nelze dokončit', description: statusError });
        return;
      }
    }
    const original = orders.find((o) => o.id === orderId)?.status;
    setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, status: newStatus } : o));
    try {
      await updateOrder(orderId, { status: newStatus });
    } catch {
      setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, status: original } : o));
      toast({ variant: 'destructive', title: 'Chyba', description: 'Změna statusu selhala.' });
    }
  };

  const setNewCustomer = (field, value) =>
    setForm((prev) => ({ ...prev, newCustomer: { ...prev.newCustomer, [field]: value } }));

  const setNewVehicle = (field, value) =>
    setForm((prev) => ({ ...prev, newVehicle: { ...prev.newVehicle, [field]: value } }));

  const handleSubmit = async (evt) => {
    evt.preventDefault();
    setFormSubmitted(true);

    // ── Existing customer validations ──
    if (form.order_type === 'existing_customer') {
      if (!form.customer_id) {
        toast({ variant: 'destructive', title: 'Chyba', description: 'Vyberte klienta' });
        return;
      }
      if (customerVehicles.length === 0) {
        toast({ variant: 'destructive', title: 'Chyba', description: 'Klient nemá žádný vůz. Nejdříve přidejte vozidlo.' });
        return;
      }
      if (!form.vehicle_id) {
        toast({ variant: 'destructive', title: 'Chyba', description: 'Vyberte vozidlo' });
        return;
      }
    }

    // ── New customer validations ──
    if (form.order_type === 'new_customer') {
      const nc = form.newCustomer;
      const nv = form.newVehicle;
      if (!nc.name.trim()) {
        toast({ variant: 'destructive', title: 'Chyba', description: 'Zadejte jméno klienta.' });
        return;
      }
      if (!nc.phone.trim()) {
        toast({ variant: 'destructive', title: 'Chyba', description: 'Zadejte telefon klienta.' });
        return;
      }
      if (!/^\+?[\d\s\-]{9,}$/.test(nc.phone.trim())) {
        toast({ variant: 'destructive', title: 'Chyba', description: 'Telefon musí obsahovat alespoň 9 číslic.' });
        return;
      }
      if (!nc.email.trim()) {
        toast({ variant: 'destructive', title: 'Chyba', description: 'Zadejte e-mail klienta.' });
        return;
      }
      if (!nv.brand.trim()) {
        toast({ variant: 'destructive', title: 'Chyba', description: 'Zadejte značku vozidla.' });
        return;
      }
      if (!nv.model.trim()) {
        toast({ variant: 'destructive', title: 'Chyba', description: 'Zadejte model vozidla.' });
        return;
      }
      const yearNum = nv.year ? parseInt(nv.year) : null;
      if (yearNum !== null && (yearNum < 1900 || yearNum > 2099)) {
        toast({ variant: 'destructive', title: 'Chyba', description: 'Rok výroby musí být mezi 1900 a 2099.' });
        return;
      }
    }

    // ── Date validations (both modes) ──
    if (!form.scheduled_start) {
      toast({ variant: 'destructive', title: 'Chyba', description: 'Zadejte datum začátku zakázky' });
      return;
    }
    if (!form.scheduled_end) {
      toast({ variant: 'destructive', title: 'Chyba', description: 'Zadejte datum konce zakázky' });
      return;
    }
    if (form.scheduled_end < form.scheduled_start) {
      toast({ variant: 'destructive', title: 'Chyba', description: 'Datum konce nemůže být před datem začátku.' });
      return;
    }

    setIsSaving(true);
    setError(null);

    // Track what was created so we can rollback on failure
    let createdCustomerId = /** @type {string|null} */(null);
    let createdVehicleId = /** @type {string|null} */(null);

    try {
      let customerId = form.customer_id || undefined;
      let vehicleId = form.vehicle_id || undefined;

      if (form.order_type === 'new_customer') {
        const customerStatus = form.saveToDb ? 'active' : 'one_time';
        const newCust = await createCustomer({
          name: form.newCustomer.name.trim(),
          phone: form.newCustomer.phone.trim() || undefined,
          email: form.newCustomer.email.trim() || undefined,
          ico: form.newCustomer.ico.trim() || undefined,
          note: form.newCustomer.note.trim() || undefined,
          status: customerStatus,
        });
        customerId = newCust.id;
        createdCustomerId = newCust.id;

        const v = form.newVehicle;
        const hasVehicle = v.brand || v.model || v.spz || v.vin;
        if (hasVehicle) {
          const newVeh = await createVehicle(customerId, {
            brand: v.brand.trim() || undefined,
            model: v.model.trim() || undefined,
            spz: v.spz.trim() || undefined,
            specification: v.specification.trim() || undefined,
            color: v.color.trim() || undefined,
            vin: v.vin.trim() || undefined,
            year: v.year ? parseInt(v.year) : undefined,
            tk_expiry: v.tk_expiry || undefined,
            note: v.note.trim() || undefined,
          });
          vehicleId = newVeh.id;
          createdVehicleId = newVeh.id;
        }
      }

      const newOrder = await createOrder({
        customer_id: customerId,
        vehicle_id: vehicleId,
        name: form.name.trim() || undefined,
        scheduled_start: form.scheduled_start ? `${form.scheduled_start}T08:00:00Z` : undefined,
        scheduled_end: form.scheduled_end ? `${form.scheduled_end}T17:00:00Z` : undefined,
        payment_method: form.payment_method,
        customer_notes: form.customer_notes,
        internal_notes: form.internal_notes,
      });

      toast({ title: 'Úspěch', description: `Zakázka ${newOrder.name || newOrder.order_number} vytvořena.` });
      setDialogOpen(false);
      setForm(emptyForm);
      setFormSubmitted(false);
      navigate(`/orders/${newOrder.id}`);
    } catch (err) {
      console.error('Create order error', err);

      // Rollback: clean up any records already created in this transaction
      if (createdVehicleId) {
        try { await deleteVehicle(createdVehicleId); } catch (e) { console.error('Rollback vehicle failed', e); }
      }
      if (createdCustomerId) {
        try { await deleteCustomer(createdCustomerId); } catch (e) { console.error('Rollback customer failed', e); }
      }

      const errDetail = /** @type {any} */(err)?.message || /** @type {any} */(err)?.error_description || String(err);
      const msg = createdCustomerId
        ? 'Vytvoření zakázky selhalo. Rozepsaný klient a vozidlo byly odstraněny — zkuste to znovu.'
        : 'Vytvoření zakázky selhalo.';
      setError(`${msg} (${errDetail})`);
      toast({ variant: 'destructive', title: 'Chyba', description: `${msg} Chyba: ${errDetail}` });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteOrder = async () => {
    if (!deleteConfirm.orderId) return;

    setIsSaving(true);
    setError(null);
    const previousOrders = orders;
    setOrders((prev) => prev.filter((order) => order.id !== deleteConfirm.orderId));
    setDeleteConfirm({ open: false, orderId: null, orderName: '' });

    try {
      await deleteOrder(deleteConfirm.orderId, true);
      toast({ title: 'Úspěch', description: 'Zakázka byla smazána.' });
    } catch (err) {
      console.error('Delete order error', err);
      setOrders(previousOrders);
      const msg = 'Smazání zakázky selhalo.';
      setError(msg);
      toast({ variant: 'destructive', title: 'Chyba', description: msg });
    } finally {
      setIsSaving(false);
    }
  };

  const openDeleteConfirm = (orderId, orderName) => {
    setDeleteConfirm({ open: true, orderId, orderName: orderName || '' });
  };

  const closeDeleteConfirm = () => {
    setDeleteConfirm({ open: false, orderId: null, orderName: '' });
  };

  // Rule 8: pre-compute STK warning for selected vehicle
  const selectedVehicleObj = customerVehicles.find((v) => v.id === form.vehicle_id) || null;
  const selectedVehicleTkStatus = selectedVehicleObj && selectedVehicleObj.tk_expiry
    ? getTkStatus(selectedVehicleObj.tk_expiry)
    : null;

  if (isLoading) {
    return <div className="p-8 text-center">Načítání...</div>;
  }

  return (
    <div className="p-4 md:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 mb-5">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900">Zakázky</h1>
            <p className="text-sm text-slate-600">Správa zakázek</p>
          </div>
          <Button onClick={() => { setForm(emptyForm); setDialogOpen(true); }} className="bg-blue-600 hover:bg-blue-700 min-h-[44px]">
            <Plus className="w-4 h-4 md:mr-2" />
            <span className="hidden md:inline">Nová zakázka</span>
          </Button>
        </div>

        {error && (
          <div role="alert" className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Status filter chips */}
        <div className="mb-4 flex gap-2 flex-wrap">
          {statusOptions.map((status) => (
            <Button
              key={status.value}
              variant={selectedStatus === status.value ? 'default' : 'outline'}
              size="sm"
              className="min-h-[36px]"
              onClick={() => setSelectedStatus(selectedStatus === status.value ? '' : status.value)}
            >
              {status.label}
            </Button>
          ))}
        </div>

        {/* Search + sort */}
        <div className="mb-5 flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Hledat dle názvu, klienta nebo SPZ"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="pl-10 min-h-[44px]"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSortDir((d) => d === 'asc' ? 'desc' : 'asc')}
            className="shrink-0 gap-1 min-h-[44px]"
          >
            <ArrowUpDown className="w-4 h-4" />
            <span className="hidden sm:inline">Deadline {sortDir === 'asc' ? '↑' : '↓'}</span>
          </Button>
        </div>

        {/* Orders list */}
        {sortedOrders.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-slate-500">Žádné zakázky</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sortedOrders.map((order) => {
              const overdue = isOverdue(order);
              const clItems = orderChecklists[order.id] || [];
              const clExpanded = expandedChecklists.has(order.id);
              const clLoading = loadingChecklist.has(order.id);
              const clDone = clItems.filter((i) => i.is_completed).length;
              return (
              <Card
                key={order.id}
                className={`cursor-pointer transition-shadow hover:shadow-md ${getStatusColor(order.status)}`}
                onClick={() => navigate(`/orders/${order.id}`)}
              >
              <CardContent className="p-4">
                {/* Row 1: name + badges + delete */}
                <div className="flex items-center justify-between gap-2 flex-wrap min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-lg text-slate-900 truncate">{getOrderDisplayName(order)}</span>
                    <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${getStatusBadge(order.status)}`}>
                      {getStatusLabel(order.status)}
                    </span>
                    {order.is_paid
                      ? <span className="inline-block px-2 py-1 rounded text-xs font-semibold bg-green-100 text-green-700">Zaplaceno</span>
                      : <span className="inline-block px-2 py-1 rounded text-xs font-semibold bg-red-100 text-red-600">Nezaplaceno</span>
                    }
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      openDeleteConfirm(order.id, getOrderDisplayName(order));
                    }}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>

                {/* Row 2: quick status change */}
                <div className="flex gap-1 mt-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
                  {statusOptions.filter((s) => s.value !== order.status).map((s) => (
                    <button
                      key={s.value}
                      onClick={(e) => handleQuickStatus(e, order.id, s.value)}
                      className="text-xs px-2 py-1 rounded border border-slate-300 bg-white text-slate-600 hover:bg-slate-100"
                    >
                      → {s.label}
                    </button>
                  ))}
                </div>

                {/* Row 3: info grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 text-sm">
                  <div>
                    <p className="text-slate-600">Klient</p>
                    <p className="font-semibold text-slate-900">{order.customer?.name || '–'}</p>
                  </div>
                  <div>
                    <p className="text-slate-600">SPZ / Vozidlo</p>
                    <p className="font-mono text-slate-900">
                      {order.vehicle?.spz ? `${order.vehicle.spz} (${order.vehicle.brand} ${order.vehicle.model})` : '–'}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-600">Deadline</p>
                    <p className={`font-semibold ${overdue ? 'text-red-600' : 'text-slate-900'}`}>
                      {order.scheduled_end
                        ? new Date(order.scheduled_end).toLocaleDateString('cs-CZ')
                        : '–'}
                      {overdue && <span className="ml-1 text-xs font-normal">po termínu</span>}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-600">Cena</p>
                    <p className="font-bold text-slate-900">
                      {order.total_price ? `${Number(order.total_price).toLocaleString('cs-CZ')} Kč` : '–'}
                    </p>
                  </div>
                </div>

                {/* Row 4: Checklist toggle */}
                <div
                  className="mt-3 border-t pt-3"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
                    onClick={(e) => toggleChecklist(e, order.id)}
                  >
                    {clExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    {clLoading
                      ? 'Načítám checklist…'
                      : clItems.length > 0
                        ? `Checklist ${clDone}/${clItems.length}`
                        : 'Checklist'}
                  </button>
                  {clExpanded && !clLoading && (
                    <div className="mt-2 space-y-1">
                      {clItems.length === 0 ? (
                        <p className="text-xs text-slate-400">Žádné položky</p>
                      ) : clItems.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-start gap-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={item.is_completed}
                            onChange={(e) => toggleOrderChecklistItem(e, order.id, item)}
                            className="mt-0.5 h-4 w-4 cursor-pointer shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className={`text-sm font-medium ${item.is_completed ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                                {item.title}
                              </p>
                              {item.assigned_service?.category && (
                                <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${item.assigned_service.category.color_class || 'bg-slate-100 text-slate-600'}`}>
                                  {item.assigned_service.category.name}
                                </span>
                              )}
                            </div>
                            {item.description && (
                              <p className="text-xs text-slate-500">{item.description}</p>
                            )}
                            <div className="flex gap-3 flex-wrap mt-0.5">
                              {item.assigned_worker && (
                                <span className="text-xs text-slate-400">👤 {item.assigned_worker.name}</span>
                              )}
                              {item.due_date && (() => {
                                const [y, m, d] = item.due_date.split('-').map(Number);
                                const dueLocal = new Date(y, m - 1, d);
                                const today = new Date(new Date().toDateString());
                                const overdue = !item.is_completed && dueLocal < today;
                                return (
                                  <span className={`text-xs ${overdue ? 'text-red-500 font-medium' : 'text-slate-400'}`}>
                                    📅 {dueLocal.toLocaleDateString('cs-CZ')}{overdue ? ' ⚠' : ''}
                                  </span>
                                );
                              })()}
                              {item.completed_at && (
                                <span className="text-xs text-slate-400">✓ {new Date(item.completed_at).toLocaleDateString('cs-CZ')}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
              </Card>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={deleteConfirm.open} onOpenChange={closeDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Smazat zakázku</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600 mb-4">
            Opravdu chcete smazat zakázku <strong>{deleteConfirm.orderName || deleteConfirm.orderId}</strong>? Tuto akci nelze vrátit zpět.
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeDeleteConfirm} disabled={isSaving}>
              Zrušit
            </Button>
            <Button type="button" onClick={handleDeleteOrder} disabled={isSaving}>
              {isSaving ? 'Maže se...' : 'Smazat'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Order Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) { setForm(emptyForm); setFormSubmitted(false); setNameManuallyEdited(false); } }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nová zakázka</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-5 mt-2 max-h-[82vh] overflow-y-auto pr-1">

            {/* Order type */}
            <div>
              <Label className="text-sm font-semibold">Typ klienta</Label>
              <div className="flex gap-6 mt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="order_type"
                    value="existing_customer"
                    checked={form.order_type === 'existing_customer'}
                    onChange={(e) => setForm((prev) => ({ ...prev, order_type: e.target.value, customer_id: '', vehicle_id: '', newCustomer: emptyNewCustomer, newVehicle: emptyNewVehicle }))}
                    disabled={isSaving}
                  />
                  <span className="text-sm font-medium">Stávající klient</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="order_type"
                    value="new_customer"
                    checked={form.order_type === 'new_customer'}
                    onChange={(e) => setForm((prev) => ({ ...prev, order_type: e.target.value, customer_id: '', vehicle_id: '', newCustomer: emptyNewCustomer, newVehicle: emptyNewVehicle }))}
                    disabled={isSaving}
                  />
                  <span className="text-sm font-medium">Nový klient</span>
                </label>
              </div>
            </div>

            {/* ── EXISTING CUSTOMER ── */}
            {form.order_type === 'existing_customer' && (
              <div className="space-y-4">
                <div>
                  <Label>Klient *</Label>
                  <select
                    value={form.customer_id}
                    onChange={(e) => setForm((prev) => ({ ...prev, customer_id: e.target.value, vehicle_id: '' }))}
                    className={`w-full mt-1 px-3 py-2 border rounded-md bg-white focus:outline-none focus:ring-2 text-sm ${formSubmitted && !form.customer_id ? 'border-red-500 focus:ring-red-500' : 'border-slate-300 focus:ring-blue-500'}`}
                    disabled={isSaving}
                  >
                    <option value="">-- Vyberte klienta --</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}{c.phone ? ` (${c.phone})` : ''}
                      </option>
                    ))}
                  </select>
                  {formSubmitted && !form.customer_id && <p className="text-xs text-red-500 mt-1">Povinné pole</p>}
                </div>

                {/* Vehicles loading indicator */}
                {form.customer_id && vehiclesLoading && (
                  <p className="text-xs text-slate-400 animate-pulse">Načítám vozidla…</p>
                )}

                {/* Rule 1: customer selected but has no vehicles — hard block */}
                {form.customer_id && !vehiclesLoading && customerVehicles.length === 0 && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    <p className="font-semibold">Klient nemá žádný vůz.</p>
                    <p className="mt-0.5">
                      Zakázku nelze vytvořit bez vozidla.{' '}
                      <a
                        href={`/customers/${form.customer_id}`}
                        className="underline font-medium"
                        onClick={(e) => { e.preventDefault(); setDialogOpen(false); navigate(`/customers/${form.customer_id}`); }}
                      >
                        Přidat vůz klientovi →
                      </a>
                    </p>
                  </div>
                )}

                {form.customer_id && !vehiclesLoading && customerVehicles.length > 0 && (
                  <div>
                    <Label>Vozidlo *</Label>
                    <select
                      value={form.vehicle_id}
                      onChange={(e) => setForm((prev) => ({ ...prev, vehicle_id: e.target.value }))}
                      className={`w-full mt-1 px-3 py-2 border rounded-md bg-white focus:outline-none focus:ring-2 text-sm ${formSubmitted && !form.vehicle_id ? 'border-red-500 focus:ring-red-500' : 'border-slate-300 focus:ring-blue-500'}`}
                      disabled={isSaving}
                    >
                      <option value="">-- Vyberte vozidlo --</option>
                      {customerVehicles.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.spz} ({v.brand} {v.model})
                        </option>
                      ))}
                    </select>
                    {formSubmitted && !form.vehicle_id && <p className="text-xs text-red-500 mt-1">Povinné pole</p>}

                    {/* Rule 8: selected vehicle has expired/critical STK */}
                    {selectedVehicleTkStatus === 'expired' && (
                      <p className="mt-1.5 text-xs text-red-600 font-medium">
                        🔴 STK tohoto vozu propadla {selectedVehicleObj.tk_expiry} — upozorněte klienta.
                      </p>
                    )}
                    {selectedVehicleTkStatus === 'critical' && (
                      <p className="mt-1.5 text-xs text-orange-600 font-medium">
                        🟠 STK vyprší do 30 dní ({selectedVehicleObj.tk_expiry}) — připomeňte klientovi.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── NEW CUSTOMER ── */}
            {form.order_type === 'new_customer' && (
              <div className="space-y-4">
                {/* Customer fields */}
                <div>
                  <p className="text-sm font-semibold text-slate-700 mb-3 border-b pb-1">Údaje klienta</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label>Jméno / Firma *</Label>
                      <Input
                        value={form.newCustomer.name}
                        onChange={(e) => setNewCustomer('name', e.target.value)}
                        placeholder="Jan Novák"
                        disabled={isSaving}
                        className={formSubmitted && !form.newCustomer.name.trim() ? 'border-red-500 focus-visible:ring-red-500' : ''}
                      />
                      {formSubmitted && !form.newCustomer.name.trim() && <p className="text-xs text-red-500 mt-1">Povinné pole</p>}
                    </div>
                    <div>
                      <Label>Telefon *</Label>
                      <Input
                        value={form.newCustomer.phone}
                        onChange={(e) => setNewCustomer('phone', e.target.value)}
                        placeholder="+420 777 123 456"
                        disabled={isSaving}
                        className={
                          formSubmitted && (!form.newCustomer.phone.trim() || !/^\+?[\d\s\-]{9,}$/.test(form.newCustomer.phone.trim()))
                            ? 'border-red-500 focus-visible:ring-red-500' : ''
                        }
                      />
                      {formSubmitted && !form.newCustomer.phone.trim() && <p className="text-xs text-red-500 mt-1">Povinné pole</p>}
                      {formSubmitted && form.newCustomer.phone.trim() && !/^\+?[\d\s\-]{9,}$/.test(form.newCustomer.phone.trim()) && (
                        <p className="text-xs text-red-500 mt-1">Zadejte platné telefonní číslo (min. 9 číslic)</p>
                      )}
                    </div>
                    <div>
                      <Label>E-mail *</Label>
                      <Input
                        type="email"
                        value={form.newCustomer.email}
                        onChange={(e) => setNewCustomer('email', e.target.value)}
                        placeholder="jan@novak.cz"
                        disabled={isSaving}
                        className={formSubmitted && !form.newCustomer.email.trim() ? 'border-red-500 focus-visible:ring-red-500' : ''}
                      />
                      {formSubmitted && !form.newCustomer.email.trim() && <p className="text-xs text-red-500 mt-1">Povinné pole</p>}
                    </div>
                    <div>
                      <Label>IČ</Label>
                      <Input
                        value={form.newCustomer.ico}
                        onChange={(e) => setNewCustomer('ico', e.target.value)}
                        placeholder="12345678"
                        disabled={isSaving}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label>Poznámka ke klientovi</Label>
                      <textarea
                        value={form.newCustomer.note}
                        onChange={(e) => setNewCustomer('note', e.target.value)}
                        rows={2}
                        className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={isSaving}
                      />
                    </div>
                  </div>
                </div>

                {/* Vehicle fields */}
                <div>
                  <p className="text-sm font-semibold text-slate-700 mb-3 border-b pb-1">Údaje vozidla</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label>Značka *</Label>
                      <Input
                        value={form.newVehicle.brand}
                        onChange={(e) => setNewVehicle('brand', e.target.value)}
                        placeholder="BMW"
                        disabled={isSaving}
                        className={formSubmitted && !form.newVehicle.brand.trim() ? 'border-red-500 focus-visible:ring-red-500' : ''}
                      />
                      {formSubmitted && !form.newVehicle.brand.trim() && <p className="text-xs text-red-500 mt-1">Povinné pole</p>}
                    </div>
                    <div>
                      <Label>Model *</Label>
                      <Input
                        value={form.newVehicle.model}
                        onChange={(e) => setNewVehicle('model', e.target.value)}
                        placeholder="M3"
                        disabled={isSaving}
                        className={formSubmitted && !form.newVehicle.model.trim() ? 'border-red-500 focus-visible:ring-red-500' : ''}
                      />
                      {formSubmitted && !form.newVehicle.model.trim() && <p className="text-xs text-red-500 mt-1">Povinné pole</p>}
                    </div>
                    <div>
                      <Label>SPZ</Label>
                      <Input
                        value={form.newVehicle.spz}
                        onChange={(e) => setNewVehicle('spz', e.target.value.toUpperCase())}
                        placeholder="1AB 2345"
                        disabled={isSaving}
                      />
                    </div>
                    <div>
                      <Label>Barva</Label>
                      <Input
                        value={form.newVehicle.color}
                        onChange={(e) => setNewVehicle('color', e.target.value)}
                        placeholder="Černá metalíza"
                        disabled={isSaving}
                      />
                    </div>
                    <div>
                      <Label>Rok výroby</Label>
                      <Input
                        type="number"
                        value={form.newVehicle.year}
                        onChange={(e) => setNewVehicle('year', e.target.value)}
                        placeholder="2022"
                        min="1900"
                        max="2099"
                        disabled={isSaving}
                        className={
                          formSubmitted && form.newVehicle.year &&
                          (parseInt(form.newVehicle.year) < 1900 || parseInt(form.newVehicle.year) > 2099)
                            ? 'border-red-500 focus-visible:ring-red-500' : ''
                        }
                      />
                      {formSubmitted && form.newVehicle.year &&
                        (parseInt(form.newVehicle.year) < 1900 || parseInt(form.newVehicle.year) > 2099) && (
                        <p className="text-xs text-red-500 mt-1">Neplatný rok</p>
                      )}
                    </div>
                    <div>
                      <Label>VIN</Label>
                      <Input
                        value={form.newVehicle.vin}
                        onChange={(e) => setNewVehicle('vin', e.target.value.toUpperCase())}
                        placeholder="WBA..."
                        disabled={isSaving}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label>Specifikace</Label>
                      <Input
                        value={form.newVehicle.specification}
                        onChange={(e) => setNewVehicle('specification', e.target.value)}
                        placeholder="xDrive 3.0d, panorama, karbonový paket"
                        disabled={isSaving}
                      />
                    </div>
                    <div>
                      <Label>Platnost TK</Label>
                      <Input
                        type="date"
                        value={form.newVehicle.tk_expiry}
                        onChange={(e) => setNewVehicle('tk_expiry', e.target.value)}
                        disabled={isSaving}
                      />
                      {form.newVehicle.tk_expiry && form.newVehicle.tk_expiry < new Date().toISOString().slice(0, 10) && (
                        <p className="text-xs text-amber-600 mt-1">⚠ Datum STK je v minulosti — upozorněte klienta</p>
                      )}
                    </div>
                    <div>
                      <Label>Poznámka k vozidlu</Label>
                      <Input
                        value={form.newVehicle.note}
                        onChange={(e) => setNewVehicle('note', e.target.value)}
                        disabled={isSaving}
                      />
                    </div>
                  </div>
                </div>

                {/* Save to DB checkbox */}
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.saveToDb}
                      onChange={(e) => setForm((prev) => ({ ...prev, saveToDb: e.target.checked }))}
                      className="mt-0.5 h-4 w-4"
                      disabled={isSaving}
                    />
                    <div>
                      <p className="text-sm font-medium text-slate-800">Uložit klienta do adresáře</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {form.saveToDb
                          ? 'Klient a vozidlo budou přidány do adresáře klientů a půjde je znovu vybrat při dalších zakázkách.'
                          : 'Klient bude evidován pouze na této zakázce, v adresáři klientů se neobjeví.'}
                      </p>
                    </div>
                  </label>
                </div>
              </div>
            )}

            {/* ── ORDER FIELDS ── */}
            <div className="border-t pt-4 space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label>Název zakázky</Label>
                  {nameManuallyEdited && (
                    <button
                      type="button"
                      className="text-xs text-blue-500 hover:underline"
                      onClick={() => setNameManuallyEdited(false)}
                    >
                      ↺ Obnovit automatický název
                    </button>
                  )}
                </div>
                <Input
                  value={form.name}
                  onChange={(e) => {
                    setNameManuallyEdited(true);
                    setForm((prev) => ({ ...prev, name: e.target.value }));
                  }}
                  placeholder="Automaticky se vyplní z klienta, vozu a data"
                  disabled={isSaving}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Začátek *</Label>
                  <Input
                    type="date"
                    value={form.scheduled_start}
                    onChange={(e) => setForm((prev) => ({ ...prev, scheduled_start: e.target.value }))}
                    disabled={isSaving}
                    className={formSubmitted && !form.scheduled_start ? 'border-red-500 focus-visible:ring-red-500' : ''}
                  />
                  {formSubmitted && !form.scheduled_start && <p className="text-xs text-red-500 mt-1">Povinné pole</p>}
                </div>
                <div>
                  <Label>Konec *</Label>
                  <Input
                    type="date"
                    value={form.scheduled_end}
                    onChange={(e) => setForm((prev) => ({ ...prev, scheduled_end: e.target.value }))}
                    disabled={isSaving}
                    className={
                      (formSubmitted && !form.scheduled_end) ||
                      (form.scheduled_end && form.scheduled_start && form.scheduled_end < form.scheduled_start)
                        ? 'border-red-500 focus-visible:ring-red-500' : ''
                    }
                  />
                  {formSubmitted && !form.scheduled_end && <p className="text-xs text-red-500 mt-1">Povinné pole</p>}
                  {form.scheduled_end && form.scheduled_start && form.scheduled_end < form.scheduled_start && (
                    <p className="text-xs text-red-500 mt-1">Konec nemůže být před začátkem</p>
                  )}
                </div>
              </div>

              <div>
                <Label>Způsob platby</Label>
                <select
                  value={form.payment_method}
                  onChange={(e) => setForm((prev) => ({ ...prev, payment_method: e.target.value }))}
                  className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  disabled={isSaving}
                >
                  {paymentMethods.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <Label>Poznámka klienta</Label>
                <textarea
                  value={form.customer_notes}
                  onChange={(e) => setForm((prev) => ({ ...prev, customer_notes: e.target.value }))}
                  rows={2}
                  className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={isSaving}
                />
              </div>

              <div>
                <Label>Interní poznámka</Label>
                <textarea
                  value={form.internal_notes}
                  onChange={(e) => setForm((prev) => ({ ...prev, internal_notes: e.target.value }))}
                  rows={2}
                  className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={isSaving}
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={isSaving}>
                Zrušit
              </Button>
              <Button type="submit" disabled={isSaving || vehiclesLoading}>
                {isSaving ? 'Vytváří se...' : vehiclesLoading ? 'Načítám vozidla…' : 'Vytvořit zakázku'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
