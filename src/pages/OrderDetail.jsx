import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getOrder, updateOrder, deleteOrder,
  getOrderServices, addOrderServices, removeOrderService,
  getOrderWorkers, addOrderWorker, removeOrderWorker, updateOrderWorker,
  getChecklistItems, addChecklistItem, updateChecklistItem, deleteChecklistItem, bulkUpdateChecklistItems,
  duplicateOrder,
  getStatusLabel, getStatusBadge, getOrderDisplayName,
  validateStatusChange, validatePaymentFields,
} from '@/lib/api/orders';
import { supabase } from '@/lib/supabase-client';
import { getWorkers } from '@/lib/api/workers';
import { getServiceCategories, getServices } from '@/lib/api/services';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { ArrowLeft, Pencil, Copy, Plus, Trash2, ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react';

const STATUS_OPTIONS = [
  { value: 'planned', label: 'Plánováno' },
  { value: 'confirmed', label: 'Potvrzeno' },
  { value: 'in_progress', label: 'Probíhá' },
  { value: 'completed', label: 'Dokončeno' },
  { value: 'archived', label: 'Archivováno' },
];

const PAYMENT_METHODS = {
  cash: 'Hotově',
  invoice: 'Faktura',
  account: 'Osobní účet',
  barter: 'Barter',
  other: 'Jiný',
};

export default function OrderDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [order, setOrder] = useState(null);
  const [orderServices, setOrderServices] = useState(/** @type {any[]} */ ([]));
  const [orderWorkers, setOrderWorkers] = useState(/** @type {any[]} */ ([]));
  const [checklistItems, setChecklistItems] = useState(/** @type {any[]} */ ([]));
  const [workers, setWorkers] = useState(/** @type {any[]} */ ([]));
  const [services, setServices] = useState([]);
  const [serviceCategories, setServiceCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isAssigningWorker, setIsAssigningWorker] = useState(false);
  const [isAddingChecklistItem, setIsAddingChecklistItem] = useState(false);
  const [error, setError] = useState(null);

  // Edit dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [orderNameDraft, setOrderNameDraft] = useState('');
  const [editForm, setEditForm] = useState({
    name: '',
    status: '',
    total_price: 0,
    is_paid: false,
    is_invoiced: false,
    customer_notes: '',
    internal_notes: '',
    scheduled_start: '',
    scheduled_end: '',
    payment_method: '',
  });

  // Worker assign / edit form
  const [assignWorkerForm, setAssignWorkerForm] = useState({ worker_id: '', service_id: '' });
  const [editWorker, setEditWorker] = useState(null); // { id, worker_id, service_id } when editing
  const [isRemovingWorker, setIsRemovingWorker] = useState(null); // id being removed

  // Checklist form
  const [checklistForm, setChecklistForm] = useState({ title: '', description: '', assigned_to: '', assigned_service_id: '', due_date: '' });
  const [editChecklistItem, setEditChecklistItem] = useState(/** @type {{ id: string, title: string, description: string, assigned_to: string, assigned_service_id: string, due_date: string } | null} */ (null));
  const [checklistSort, setChecklistSort] = useState('manual'); // 'manual' | 'deadline'
  const [bulkDialog, setBulkDialog] = useState({ open: false, action: 'done' });
  const [dateWarningDialog, setDateWarningDialog] = useState(/** @type {{ open: boolean, items: any[], newEndDate: string }} */ ({ open: false, items: [], newEndDate: '' }));

  // Service picker state
  const [expandedCategory, setExpandedCategory] = useState(null);
  const [customServiceName, setCustomServiceName] = useState('');
  const [customServicePrice, setCustomServicePrice] = useState('');

  // Copy dialog
  const [copyDialogOpen, setCopyDialogOpen] = useState(false);
  const [copyDate, setCopyDate] = useState('');
  const [copyEndDate, setCopyEndDate] = useState('');
  const [isCopying, setIsCopying] = useState(false);

  const loadData = async () => {
    setError(null);
    setIsLoading(true);
    try {
      const [orderData, workersData, servicesData, categoriesData] = await Promise.all([
        getOrder(id),
        getWorkers(),
        getServices(),
        getServiceCategories(),
      ]);

      setOrder(orderData);
      setWorkers(workersData);
      setServices(servicesData);
      setServiceCategories(categoriesData);
      setEditForm({
        name: orderData.name || '',
        status: orderData.status || 'planned',
        total_price: orderData.total_price || 0,
        is_paid: orderData.is_paid || false,
        is_invoiced: orderData.is_invoiced || false,
        customer_notes: orderData.customer_notes || '',
        internal_notes: orderData.internal_notes || '',
        scheduled_start: orderData.scheduled_start ? orderData.scheduled_start.slice(0, 10) : '',
        scheduled_end: orderData.scheduled_end ? orderData.scheduled_end.slice(0, 10) : '',
        payment_method: orderData.payment_method || '',
      });
      setOrderNameDraft(getOrderDisplayName(orderData));

      const [orderServicesData, orderWorkersData, checklistData] = await Promise.all([
        getOrderServices(id),
        getOrderWorkers(id),
        getChecklistItems(id),
      ]);

      setOrderServices(orderServicesData);
      setOrderWorkers(orderWorkersData);
      setChecklistItems(checklistData);
    } catch (err) {
      console.error('Load order error', err);
      const msg = 'Nepodařilo se načíst data zakázky.';
      setError(msg);
      toast({ variant: 'destructive', title: 'Chyba', description: msg });
    } finally {
      setIsLoading(false);
    }
  };

  const refreshRelations = async () => {
    if (!id) return;
    try {
      const [svcData, workerData, clData] = await Promise.all([
        getOrderServices(id),
        getOrderWorkers(id),
        getChecklistItems(id),
      ]);
      setOrderServices(svcData);
      setOrderWorkers(workerData);
      setChecklistItems(clData);
    } catch (err) {
      console.error('Refresh relations error', err);
    }
  };

  useEffect(() => {
    if (id) loadData();
  }, [id]);

  // ─── Auto-prefill checklist due_date for single-day orders ──────────────────
  useEffect(() => {
    if (!order) return;
    const o = /** @type {any} */ (order);
    const start = o.scheduled_start?.slice(0, 10) ?? '';
    const end   = o.scheduled_end?.slice(0, 10)   ?? '';
    if (start && end && start === end) {
      setChecklistForm((prev) => prev.due_date ? prev : { ...prev, due_date: start });
    }
  }, [order]);

  // ─── Auto-recalculate total price whenever services change ───────────────────
  const computedTotal = orderServices.reduce((sum, s) => {
    return sum + (Number(s.price) || 0) * (Number(s.quantity) || 1);
  }, 0);

  // Sync computed total to DB when it changes (after initial load)
  useEffect(() => {
    if (!order) return;
    if (computedTotal === Number(order.total_price)) return;
    updateOrder(id, { total_price: computedTotal }).then((updated) => {
      setOrder(updated);
    }).catch(() => {});
  }, [computedTotal]);

  // ─── Quick status change ──────────────────────────────────────────────────────
  const handleQuickStatus = async (newStatus) => {
    const statusError = validateStatusChange(newStatus, orderServices.length);
    if (statusError) {
      toast({ variant: 'destructive', title: 'Nelze dokončit', description: statusError });
      return;
    }
    try {
      const updated = await updateOrder(id, { status: newStatus });
      setOrder(updated);
      setEditForm((prev) => ({ ...prev, status: newStatus }));
      toast({ title: 'Status změněn', description: getStatusLabel(newStatus) });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Chyba', description: 'Změna statusu selhala.' });
    }
  };

  // ─── Edit dialog submit ───────────────────────────────────────────────────────
  const handleUpdate = async (evt) => {
    evt.preventDefault();
    const statusError = validateStatusChange(editForm.status, orderServices.length);
    if (statusError) {
      toast({ variant: 'destructive', title: 'Nelze dokončit', description: statusError });
      return;
    }
    const paymentError = validatePaymentFields(editForm.is_paid, editForm.payment_method);
    if (paymentError) {
      toast({ variant: 'destructive', title: 'Způsob platby', description: paymentError });
      setEditForm((prev) => ({ ...prev, is_paid: false }));
      return;
    }
    const prevEndDate = /** @type {any} */ (order).scheduled_end?.slice(0, 10) ?? '';
    setIsSaving(true);
    setError(null);
    try {
      const updated = await updateOrder(id, {
        name: editForm.name,
        status: editForm.status,
        total_price: editForm.total_price,
        is_paid: editForm.is_paid,
        is_invoiced: editForm.is_invoiced,
        customer_notes: editForm.customer_notes,
        internal_notes: editForm.internal_notes,
        scheduled_start: editForm.scheduled_start || null,
        scheduled_end: editForm.scheduled_end || null,
        payment_method: editForm.payment_method || null,
      });
      setOrder(updated);
      setOrderNameDraft(updated.name || '');
      // Check if end date was shortened — warn about out-of-range checklist items
      const newEndDate = editForm.scheduled_end;
      if (newEndDate && prevEndDate && newEndDate < prevEndDate) {
        const outOfRange = checklistItems.filter(
          (ci) => !ci.is_completed && ci.due_date && ci.due_date > newEndDate,
        );
        if (outOfRange.length > 0) {
          setDateWarningDialog({ open: true, items: outOfRange, newEndDate });
        }
      }
      setEditDialogOpen(false);
      toast({ title: 'Úspěch', description: 'Zakázka byla upravena' });
    } catch (err) {
      const msg = 'Úprava zakázky selhala.';
      setError(msg);
      toast({ variant: 'destructive', title: 'Chyba', description: msg });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveOrderName = async () => {
    if (!order) return;
    if (orderNameDraft === (order.name || '')) return;

    setIsSaving(true);
    setError(null);
    try {
      const updated = await updateOrder(id, { name: orderNameDraft.trim() });
      setOrder(updated);
      setOrderNameDraft(updated.name || '');
      setEditForm((prev) => ({ ...prev, name: updated.name || '' }));
      toast({ title: 'Úspěch', description: 'Název zakázky byl uložen' });
    } catch (err) {
      const msg = 'Uložení názvu zakázky selhalo.';
      setError(msg);
      toast({ variant: 'destructive', title: 'Chyba', description: msg });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsSaving(true);
    setError(null);
    try {
      await deleteOrder(id, true);
      toast({ title: 'Úspěch', description: 'Zakázka byla smazána' });
      navigate('/orders');
    } catch (err) {
      console.error('Delete order error', err);
      const msg = 'Smazání zakázky selhalo.';
      setError(msg);
      toast({ variant: 'destructive', title: 'Chyba', description: msg });
    } finally {
      setIsSaving(false);
    }
  };

  // ─── Service management ───────────────────────────────────────────────────────
  const getServiceName = (item) => item.custom_service_name || item.service?.name || 'Neznámá služba';

  const getCategoryForService = (item) => {
    const catId = item.service?.category_id;
    return serviceCategories.find((c) => c.id === catId) || null;
  };

  const handleAddPredefinedService = async (service) => {
    const tempSvcId = `temp-svc-${Date.now()}`;
    const tempClId = `temp-cl-${Date.now()}`;
    // Optimistic: add service row
    setOrderServices((prev) => [
      ...prev,
      {
        id: tempSvcId,
        service_id: service.id,
        service: { id: service.id, name: service.name, default_price: service.default_price, category_id: service.category_id },
        custom_service_name: null,
        custom_description: null,
        price: service.default_price ?? null,
        quantity: 1,
      },
    ]);
    // Optimistic: add checklist item
    setChecklistItems((prev) => [
      ...prev,
      {
        id: tempClId,
        order_id: id,
        title: service.name,
        description: null,
        is_completed: false,
        assigned_to: null,
        assigned_service_id: service.id,
        completed_at: null,
        assigned_worker: null,
        assigned_service: { id: service.id, name: service.name },
      },
    ]);
    try {
      const [insertedSvc] = await addOrderServices(id, [{
        service_id: service.id,
        price: service.default_price ?? null,
        quantity: 1,
      }]);
      setOrderServices((prev) => prev.map((s) => s.id === tempSvcId ? insertedSvc : s));

      const insertedCl = await addChecklistItem(id, {
        title: service.name,
        assigned_service_id: service.id,
      });
      setChecklistItems((prev) => prev.map((c) => c.id === tempClId ? insertedCl : c));
    } catch (err) {
      setOrderServices((prev) => prev.filter((s) => s.id !== tempSvcId));
      setChecklistItems((prev) => prev.filter((c) => c.id !== tempClId));
      toast({ variant: 'destructive', title: 'Chyba', description: 'Přidání služby selhalo.' });
    }
  };

  const handleAddCustomService = async (evt) => {
    evt.preventDefault();
    if (!customServiceName.trim()) return;
    const name = customServiceName.trim();
    const price = customServicePrice ? parseFloat(customServicePrice) : null;
    const tempId = `temp-${Date.now()}`;
    setOrderServices((prev) => [
      ...prev,
      { id: tempId, service_id: null, service: null, custom_service_name: name, custom_description: null, price, quantity: 1 },
    ]);
    setCustomServiceName('');
    setCustomServicePrice('');
    try {
      const [inserted] = await addOrderServices(id, [{
        custom_service_name: name,
        price,
        quantity: 1,
      }]);
      setOrderServices((prev) => prev.map((s) => s.id === tempId ? inserted : s));
    } catch (err) {
      setOrderServices((prev) => prev.filter((s) => s.id !== tempId));
      setCustomServiceName(name);
      toast({ variant: 'destructive', title: 'Chyba', description: 'Přidání vlastní služby selhalo.' });
    }
  };

  const handleRemoveService = async (orderServiceId) => {
    const svc = orderServices.find((s) => s.id === orderServiceId);
    const linkedServiceId = svc?.service_id || null;

    // Find linked checklist items and worker assignments
    const removedClIds = linkedServiceId
      ? checklistItems.filter((c) => c.assigned_service_id === linkedServiceId).map((c) => c.id)
      : [];
    const removedWorkerIds = linkedServiceId
      ? orderWorkers.filter((w) => w.service_id === linkedServiceId).map((w) => w.id)
      : [];

    // Optimistic remove all three
    setOrderServices((prev) => prev.filter((s) => s.id !== orderServiceId));
    if (removedClIds.length > 0) setChecklistItems((prev) => prev.filter((c) => !removedClIds.includes(c.id)));
    if (removedWorkerIds.length > 0) setOrderWorkers((prev) => prev.filter((w) => !removedWorkerIds.includes(w.id)));

    try {
      await removeOrderService(orderServiceId);
      await Promise.all([
        ...removedClIds.filter((cid) => !String(cid).startsWith('temp')).map(deleteChecklistItem),
        ...removedWorkerIds.filter((wid) => !String(wid).startsWith('temp')).map(removeOrderWorker),
      ]);
    } catch (err) {
      // Rollback
      await refreshRelations();
      toast({ variant: 'destructive', title: 'Chyba', description: 'Odebrání služby selhalo.' });
    }
  };

  const handleServicePriceChange = async (orderServiceId, newPrice) => {
    try {
      const { error } = await supabase
        .from('order_service')
        .update({ price: newPrice })
        .eq('id', orderServiceId);
      if (error) throw error;
      await refreshRelations();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Chyba', description: 'Úprava ceny selhala.' });
    }
  };

  // ─── Worker assignment ────────────────────────────────────────────────────────
  const handleAssignWorker = async (evt) => {
    evt.preventDefault();
    if (!assignWorkerForm.worker_id) return;
    setIsAssigningWorker(true);
    try {
      const assignment = await addOrderWorker(id, assignWorkerForm.worker_id, assignWorkerForm.service_id || null);
      setOrderWorkers((prev) => [...prev, assignment]);

      // Assign worker to matching checklist item for this service
      if (assignWorkerForm.service_id) {
        const clItem = checklistItems.find(
          (c) => c.assigned_service_id === assignWorkerForm.service_id && !c.assigned_to
        );
        if (clItem) {
          const updatedCl = await updateChecklistItem(clItem.id, { assigned_to: assignWorkerForm.worker_id });
          setChecklistItems((prev) => prev.map((c) => c.id === clItem.id ? updatedCl : c));
        }
      }

      setAssignWorkerForm({ worker_id: '', service_id: '' });
      toast({ title: 'Zaměstnanec přiřazen.' });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Chyba', description: 'Přiřazení zaměstnance selhalo.' });
    } finally {
      setIsAssigningWorker(false);
    }
  };

  const handleRemoveWorker = async (assignmentId) => {
    setIsRemovingWorker(assignmentId);
    const assignment = orderWorkers.find((w) => w.id === assignmentId);
    setOrderWorkers((prev) => prev.filter((w) => w.id !== assignmentId));
    // Clear assigned_to in matching checklist item
    if (assignment?.service_id) {
      const clItem = checklistItems.find(
        (c) => c.assigned_service_id === assignment.service_id && c.assigned_to === assignment.worker_id
      );
      if (clItem) {
        const updatedCl = await updateChecklistItem(clItem.id, { assigned_to: null }).catch(() => null);
        if (updatedCl) setChecklistItems((prev) => prev.map((c) => c.id === clItem.id ? updatedCl : c));
      }
    }
    try {
      await removeOrderWorker(assignmentId);
    } catch (err) {
      // Rollback
      if (assignment) setOrderWorkers((prev) => [...prev, assignment]);
      toast({ variant: 'destructive', title: 'Chyba', description: 'Odebrání zaměstnance selhalo.' });
    } finally {
      setIsRemovingWorker(null);
    }
  };

  const handleUpdateWorker = async (assignmentId, workerId, serviceId) => {
    const prev = orderWorkers.find((w) => w.id === assignmentId);
    // Optimistic update with new worker/service names
    const newWorker = workers.find((w) => w.id === workerId);
    const newSvcEntry = orderServices.find((s) => (s.service_id || s.id) === serviceId);
    setOrderWorkers((list) => list.map((w) => w.id === assignmentId ? {
      ...w,
      worker_id: workerId,
      service_id: serviceId || null,
      worker: newWorker ? { id: newWorker.id, name: newWorker.name, role: newWorker.role } : w.worker,
      service: serviceId && newSvcEntry?.service ? { id: newSvcEntry.service.id, name: newSvcEntry.service.name } : null,
    } : w));
    setEditWorker(null);
    try {
      const updated = await updateOrderWorker(assignmentId, { worker_id: workerId, service_id: serviceId || null });
      setOrderWorkers((list) => list.map((w) => w.id === assignmentId ? updated : w));
      // Sync checklist: clear old, set new
      if (prev?.service_id) {
        const oldCl = checklistItems.find((c) => c.assigned_service_id === prev.service_id && c.assigned_to === prev.worker_id);
        if (oldCl) {
          const u = await updateChecklistItem(oldCl.id, { assigned_to: null }).catch(() => null);
          if (u) setChecklistItems((list) => list.map((c) => c.id === oldCl.id ? u : c));
        }
      }
      if (serviceId) {
        const newCl = checklistItems.find((c) => c.assigned_service_id === serviceId && !c.assigned_to);
        if (newCl) {
          const u = await updateChecklistItem(newCl.id, { assigned_to: workerId }).catch(() => null);
          if (u) setChecklistItems((list) => list.map((c) => c.id === newCl.id ? u : c));
        }
      }
    } catch (err) {
      if (prev) setOrderWorkers((list) => list.map((w) => w.id === assignmentId ? prev : w));
      toast({ variant: 'destructive', title: 'Chyba', description: 'Úprava přiřazení selhala.' });
    }
  };

  // ─── Checklist ────────────────────────────────────────────────────────────────
  const handleAddChecklistItem = async (evt) => {
    evt.preventDefault();
    if (!checklistForm.title.trim()) return;
    setIsAddingChecklistItem(true);
    try {
      await addChecklistItem(id, {
        title: checklistForm.title.trim(),
        description: checklistForm.description.trim() || null,
        assigned_to: checklistForm.assigned_to || null,
        assigned_service_id: checklistForm.assigned_service_id || null,
        due_date: checklistForm.due_date || null,
      });
      await refreshRelations();
      setChecklistForm({ title: '', description: '', assigned_to: '', assigned_service_id: '', due_date: '' });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Chyba', description: 'Přidání položky selhalo.' });
    } finally {
      setIsAddingChecklistItem(false);
    }
  };

  const toggleChecklistItem = async (item) => {
    try {
      const updated = await updateChecklistItem(item.id, {
        is_completed: !item.is_completed,
        completed_at: !item.is_completed ? new Date().toISOString() : null,
      });
      setChecklistItems((prev) => prev.map((ex) => ex.id === updated.id ? updated : ex));
    } catch (err) {
      toast({ variant: 'destructive', title: 'Chyba', description: 'Aktualizace položky selhala.' });
    }
  };

  const handleDeleteChecklistItem = async (itemId) => {
    try {
      await deleteChecklistItem(itemId);
      setChecklistItems((prev) => prev.filter((i) => i.id !== itemId));
    } catch (err) {
      toast({ variant: 'destructive', title: 'Chyba', description: 'Smazání položky selhalo.' });
    }
  };

  const handleUpdateChecklistItem = async () => {
    if (!editChecklistItem || !editChecklistItem.title.trim()) return;
    try {
      const updated = await updateChecklistItem(editChecklistItem.id, {
        title: editChecklistItem.title.trim(),
        description: editChecklistItem.description || null,
        assigned_to: editChecklistItem.assigned_to || null,
        assigned_service_id: editChecklistItem.assigned_service_id || null,
        due_date: editChecklistItem.due_date || null,
      });
      setChecklistItems((prev) => prev.map((i) => i.id === updated.id ? updated : i));
      setEditChecklistItem(null);
    } catch (err) {
      toast({ variant: 'destructive', title: 'Chyba', description: 'Úprava položky selhala.' });
    }
  };

  // ─── Bulk checklist actions ───────────────────────────────────────────────────
  /** @param {boolean} isDone */
  const handleBulkAction = async (isDone) => {
    setBulkDialog({ open: false, action: isDone ? 'done' : 'undone' });
    try {
      await bulkUpdateChecklistItems(id ?? '', isDone);
      await refreshRelations();
      toast({ title: isDone ? 'Všechny položky označeny jako hotové' : 'Všechny položky odznačeny' });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Chyba', description: 'Hromadná akce selhala.' });
    }
  };

  const handleDateWarningConfirm = async () => {
    const { items, newEndDate } = dateWarningDialog;
    setDateWarningDialog({ open: false, items: [], newEndDate: '' });
    try {
      await Promise.all(items.map((ci) => updateChecklistItem(ci.id, { due_date: newEndDate })));
      await refreshRelations();
      const [ey, em, ed] = newEndDate.split('-').map(Number);
      const fmtDate = new Date(ey, em - 1, ed).toLocaleDateString('cs-CZ');
      toast({ title: 'Deadliny upraveny', description: `${items.length} položek aktualizováno na ${fmtDate}.` });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Chyba', description: 'Úprava deadlinů selhala.' });
    }
  };

  // ─── Copy order ───────────────────────────────────────────────────────────────
  const handleCopyOrder = async (evt) => {
    evt.preventDefault();
    if (!copyDate) return;
    setIsCopying(true);
    try {
      const newOrder = await duplicateOrder(
        id,
        `${copyDate}T08:00:00Z`,
        copyEndDate ? `${copyEndDate}T17:00:00Z` : null,
      );
      toast({ title: 'Zakázka zkopírována', description: `Nová zakázka: ${newOrder.name || newOrder.order_number}` });
      setCopyDialogOpen(false);
      navigate(`/orders/${newOrder.id}`);
    } catch (err) {
      toast({ variant: 'destructive', title: 'Chyba', description: 'Kopírování zakázky selhalo.' });
    } finally {
      setIsCopying(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────────
  if (isLoading) return <div className="p-8 text-center">Načítání...</div>;

  if (!order) {
    return (
      <div className="p-8 text-center">
        <p className="text-slate-600 mb-4">Zakázka nenalezena</p>
        <Button onClick={() => navigate('/orders')}>Zpět na seznam</Button>
      </div>
    );
  }

  const servicesByCategory = serviceCategories.map((cat) => ({
    ...cat,
    services: services.filter((s) => s.category_id === cat.id),
  }));

  const completedCount = checklistItems.filter((i) => i.is_completed).length;

  // ─── Computed: readonly + order date range ────────────────────────────────────
  const o = /** @type {any} */ (order);
  const isReadonly = o.status === 'completed' || o.status === 'archived';
  const orderStartDate = o.scheduled_start?.slice(0, 10) ?? '';
  const orderEndDate   = o.scheduled_end?.slice(0, 10)   ?? '';

  // ─── Computed: sorted checklist ───────────────────────────────────────────────
  const sortedChecklistItems = checklistSort === 'deadline'
    ? [...checklistItems].sort((a, b) => {
        if (!a.due_date && !b.due_date) return 0;
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return a.due_date < b.due_date ? -1 : a.due_date > b.due_date ? 1 : 0;
      })
    : checklistItems;

  // ─── Helper: deadline badge ────────────────────────────────────────────────────
  /** @param {any} item @returns {{ colorClass: string, label: string } | null} */
  const deadlineBadge = (item) => {
    if (!item.due_date) return null;
    const [y, m, d] = item.due_date.split('-').map(Number);
    const dueLocal = new Date(y, m - 1, d);
    const ddmm = dueLocal.toLocaleDateString('cs-CZ', { day: '2-digit', month: '2-digit' });
    if (item.is_completed) return { colorClass: 'bg-slate-100 text-slate-400', label: ddmm };
    const today = new Date(new Date().toDateString());
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
    if (dueLocal < today) return { colorClass: 'bg-red-100 text-red-700 font-semibold', label: `Prošlá · ${ddmm}` };
    if (dueLocal.getTime() === tomorrow.getTime()) return { colorClass: 'bg-yellow-100 text-yellow-700 font-semibold', label: `Zítra · ${ddmm}` };
    return { colorClass: 'bg-green-100 text-green-700', label: dueLocal.toLocaleDateString('cs-CZ') };
  };

  // ─── Helper: validate deadline against order date range ───────────────────────
  /** @param {string} dateStr @returns {string|null} */
  const validateDeadline = (dateStr) => {
    if (!dateStr) return null;
    if (!orderEndDate) return 'Nejprve nastavte termín zakázky';
    if (orderStartDate && dateStr < orderStartDate) {
      const [y, m, d] = orderStartDate.split('-').map(Number);
      return `Deadline nemůže být před začátkem zakázky (${new Date(y, m - 1, d).toLocaleDateString('cs-CZ')})`;
    }
    if (dateStr > orderEndDate) {
      const [y, m, d] = orderEndDate.split('-').map(Number);
      return `Deadline nemůže být po konci zakázky (${new Date(y, m - 1, d).toLocaleDateString('cs-CZ')})`;
    }
    return null;
  };

  return (
    <div className="p-4 md:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-4xl mx-auto">

        {/* ── Header ── */}
        <div className="flex items-start gap-3 mb-5">
          <Button variant="ghost" size="sm" onClick={() => navigate('/orders')} className="min-h-[44px] min-w-[44px] shrink-0">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl md:text-2xl font-bold text-slate-900 truncate">{getOrderDisplayName(order)}</h1>
              <span className={`inline-block px-2.5 py-1 rounded text-xs font-semibold shrink-0 ${getStatusBadge(order.status)}`}>
                {getStatusLabel(order.status)}
              </span>
            </div>
            {(() => {
              const parts = [
                order.customer?.name,
                order.vehicle ? `${order.vehicle.brand || ''} ${order.vehicle.model || ''}`.trim() : '',
                order.scheduled_end || order.scheduled_start
                  ? new Date(order.scheduled_end || order.scheduled_start).toLocaleDateString('cs-CZ')
                  : '',
              ].filter(Boolean);
              return parts.length > 1 ? (
                <p className="text-sm text-slate-600 mt-0.5 truncate">{parts.join(' – ')}</p>
              ) : null;
            })()}
            {/* Quick status buttons */}
            <div className="flex gap-1.5 mt-2 flex-wrap">
              {STATUS_OPTIONS.filter((s) => s.value !== order.status).map((s) => (
                <button
                  key={s.value}
                  onClick={() => handleQuickStatus(s.value)}
                  className="text-xs px-2 py-1.5 rounded border border-slate-300 bg-white text-slate-600 hover:bg-slate-100 min-h-[36px]"
                >
                  → {s.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-1.5 shrink-0">
            <Button size="sm" variant="outline" onClick={() => { setCopyDate(''); setCopyEndDate(''); setCopyDialogOpen(true); }} className="min-h-[44px]">
              <Copy className="w-4 h-4 md:mr-1" />
              <span className="hidden md:inline">Kopírovat</span>
            </Button>
            <Button size="sm" variant="outline" onClick={() => setDeleteDialogOpen(true)} className="text-red-600 hover:text-red-700 hover:bg-red-50 min-h-[44px]">
              <Trash2 className="w-4 h-4 md:mr-1" />
              <span className="hidden md:inline">Smazat</span>
            </Button>
            <Button size="sm" onClick={() => setEditDialogOpen(true)} className="min-h-[44px]">
              <Pencil className="w-4 h-4 md:mr-1" />
              <span className="hidden md:inline">Upravit</span>
            </Button>
          </div>
        </div>

        {error && (
          <div role="alert" className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* ── Basic Info ── */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Základní informace</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-500">Název zakázky</Label>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Input
                  value={orderNameDraft}
                  onChange={(e) => setOrderNameDraft(e.target.value)}
                  placeholder="Napište název zakázky"
                  disabled={isSaving}
                  className="min-w-0"
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={handleSaveOrderName}
                  disabled={isSaving || orderNameDraft === (order.name || '')}
                >
                  Uložit
                </Button>
              </div>
              <p className="text-xs text-slate-500">
                {order.name
                  ? ''
                  : 'Nechte prázdné pro automatické zobrazení čísla zakázky.'}
              </p>
            </div>
            <div>
              <Label className="text-sm font-medium text-slate-500">Klient</Label>
              <p className="text-lg font-semibold text-slate-900">{order.customer?.name || '–'}</p>
              {order.customer?.phone && (
                <a href={`tel:${order.customer.phone}`} className="text-sm text-blue-600 hover:underline block">{order.customer.phone}</a>
              )}
              {order.customer?.email && (
                <a href={`mailto:${order.customer.email}`} className="text-sm text-slate-500 hover:underline block">{order.customer.email}</a>
              )}
            </div>
            <div>
              <Label className="text-sm font-medium text-slate-500">Vozidlo</Label>
              <p className="text-lg text-slate-900 font-mono">
                {order.vehicle?.spz ? `${order.vehicle.spz} (${order.vehicle.brand} ${order.vehicle.model})` : '–'}
              </p>
            </div>
            <div>
              <Label className="text-sm font-medium text-slate-500">Termín</Label>
              <p className="text-slate-900">
                {order.scheduled_start ? new Date(order.scheduled_start).toLocaleDateString('cs-CZ') : '–'}
                {order.scheduled_end ? ` – ${new Date(order.scheduled_end).toLocaleDateString('cs-CZ')}` : ''}
              </p>
            </div>
            <div>
              <Label className="text-sm font-medium text-slate-500">Způsob platby</Label>
              <p className="text-slate-900">{PAYMENT_METHODS[order.payment_method] || order.payment_method || '–'}</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-slate-500">Celková cena</Label>
              <p className="text-xl font-bold text-slate-900">
                {computedTotal.toLocaleString('cs-CZ')} Kč
              </p>
            </div>
            <div className="flex gap-6 items-center">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={order.is_paid}
                  onChange={async (e) => {
                    const val = e.target.checked;
                    setOrder((prev) => ({ ...prev, is_paid: val }));
                    try { await updateOrder(id, { is_paid: val }); }
                    catch { setOrder((prev) => ({ ...prev, is_paid: !val })); }
                  }}
                  className="w-4 h-4 cursor-pointer"
                />
                <span className="text-sm text-slate-600">Zaplaceno</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={order.is_invoiced}
                  onChange={async (e) => {
                    const val = e.target.checked;
                    setOrder((prev) => ({ ...prev, is_invoiced: val }));
                    try { await updateOrder(id, { is_invoiced: val }); }
                    catch { setOrder((prev) => ({ ...prev, is_invoiced: !val })); }
                  }}
                  className="w-4 h-4 cursor-pointer"
                />
                <span className="text-sm text-slate-600">Fakturováno</span>
              </label>
            </div>
            {order.customer_notes && (
              <div className="md:col-span-2">
                <Label className="text-sm font-medium text-slate-500">Poznámka klienta</Label>
                <p className="text-slate-700 mt-1 whitespace-pre-wrap">{order.customer_notes}</p>
              </div>
            )}
            {order.internal_notes && (
              <div className="md:col-span-2">
                <Label className="text-sm font-medium text-slate-500">Interní poznámka</Label>
                <p className="text-slate-700 mt-1 whitespace-pre-wrap">{order.internal_notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Services ── */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>
              Služby
              {orderServices.length > 0 && (
                <span className="ml-2 text-base font-normal text-slate-500">
                  ({orderServices.length} položek · {computedTotal.toLocaleString('cs-CZ')} Kč)
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Added services list */}
            {orderServices.length > 0 ? (
              <div className="space-y-2">
                {orderServices.map((item) => {
                  const cat = getCategoryForService(item);
                  return (
                    <div key={item.id} className="rounded-lg border border-slate-200 bg-white p-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-slate-900">{getServiceName(item)}</span>
                          {cat && (
                            <span className={`text-xs px-2 py-0.5 rounded font-medium ${cat.color_class}`}>
                              {cat.name}
                            </span>
                          )}
                          {!item.service_id && (
                            <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-500">vlastní</span>
                          )}
                        </div>
                        {item.custom_description && (
                          <p className="text-sm text-slate-500 mt-0.5">{item.custom_description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-sm text-slate-500">{item.quantity}×</span>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          defaultValue={item.price ?? ''}
                          onBlur={(e) => {
                            const val = e.target.value === '' ? null : parseFloat(e.target.value);
                            if (val !== item.price) handleServicePriceChange(item.id, val);
                          }}
                          className="w-24 px-2 py-1 border border-slate-300 rounded text-sm text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
                          placeholder="cena"
                        />
                        <span className="text-sm text-slate-500">Kč</span>
                        <button
                          onClick={() => handleRemoveService(item.id)}
                          className="text-slate-400 hover:text-red-500 p-1"
                          title="Odebrat"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-slate-500 text-sm">Zatím žádné služby. Přidejte níže.</p>
            )}

            {/* Category picker */}
            <div className="border-t pt-4 space-y-2">
              <p className="text-sm font-medium text-slate-700 mb-2">Přidat službu:</p>
              {servicesByCategory.map((cat) => {
                const addedServiceIds = new Set(orderServices.map((s) => s.service_id).filter(Boolean));
                const availableServices = cat.services.filter((svc) => !addedServiceIds.has(svc.id));
                const allAdded = cat.services.length > 0 && availableServices.length === 0;
                return (
                <div key={cat.id}>
                  <button
                    type="button"
                    onClick={() => !allAdded && setExpandedCategory(expandedCategory === cat.id ? null : cat.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-semibold ${cat.color_class} transition-opacity ${allAdded ? 'opacity-40 cursor-default' : 'hover:opacity-90'}`}
                  >
                    <span>{cat.name}</span>
                    {allAdded
                      ? <span className="text-xs font-normal opacity-70">vše přidáno</span>
                      : expandedCategory === cat.id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>
                  {expandedCategory === cat.id && !allAdded && (
                    <div className="mt-1 ml-3 space-y-1">
                      {availableServices.length === 0 ? (
                        <p className="text-xs text-slate-400 px-2">Žádné služby v kategorii</p>
                      ) : (
                        availableServices.map((svc) => (
                          <button
                            key={svc.id}
                            type="button"
                            onClick={() => handleAddPredefinedService(svc)}
                            className="w-full flex items-center justify-between px-3 py-2 rounded bg-white border border-slate-200 hover:bg-slate-50 text-sm text-left"
                          >
                            <span>{svc.name}</span>
                            <span className="text-slate-500 text-xs">
                              {svc.default_price ? `${Number(svc.default_price).toLocaleString('cs-CZ')} Kč` : ''}
                              <Plus className="w-3 h-3 inline ml-1" />
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
                );
              })}
            </div>

            {/* Custom service */}
            <div className="border-t pt-4">
              <p className="text-sm font-medium text-slate-700 mb-2">Vlastní / nestandardní služba:</p>
              <form onSubmit={handleAddCustomService} className="flex gap-2 flex-wrap">
                <Input
                  placeholder="Název služby"
                  value={customServiceName}
                  onChange={(e) => setCustomServiceName(e.target.value)}
                  className="flex-1 min-w-40"
                />
                <Input
                  type="number"
                  placeholder="Cena (Kč)"
                  value={customServicePrice}
                  onChange={(e) => setCustomServicePrice(e.target.value)}
                  className="w-32"
                  min="0"
                  step="1"
                />
                <Button type="submit" disabled={!customServiceName.trim()} size="sm">
                  <Plus className="w-4 h-4 mr-1" /> Přidat
                </Button>
              </form>
            </div>
          </CardContent>
        </Card>

        {/* ── Workers ── */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Přiřazení zaměstnanců</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {orderWorkers.length > 0 ? (
              <div className="space-y-2">
                {orderWorkers.map((assignment) => {
                  const isEditing = editWorker?.id === assignment.id;
                  return (
                    <div key={assignment.id} className="rounded-lg border border-slate-200 bg-white p-3">
                      {isEditing ? (
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          <select
                            value={editWorker.worker_id}
                            onChange={(e) => setEditWorker((p) => ({ ...p, worker_id: e.target.value }))}
                            className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                          >
                            <option value="">Vyberte zaměstnance</option>
                            {workers.map((w) => (
                              <option key={w.id} value={w.id}>{w.name}</option>
                            ))}
                          </select>
                          <select
                            value={editWorker.service_id}
                            onChange={(e) => setEditWorker((p) => ({ ...p, service_id: e.target.value }))}
                            className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                          >
                            <option value="">Bez přiřazení ke službě</option>
                            {orderServices.map((s) => (
                              <option key={s.id} value={s.service_id || s.id}>
                                {s.custom_service_name || s.service?.name || '–'}
                              </option>
                            ))}
                          </select>
                          <div className="flex gap-2 sm:col-span-2">
                            <Button
                              size="sm"
                              disabled={!editWorker.worker_id}
                              onClick={() => handleUpdateWorker(editWorker.id, editWorker.worker_id, editWorker.service_id)}
                            >
                              Uložit
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setEditWorker(null)}>
                              Zrušit
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex justify-between items-center gap-2">
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900">{assignment.worker?.name || 'Neznámý zaměstnanec'}</p>
                            <p className="text-sm text-slate-500">
                              {assignment.service ? assignment.service.name : 'Bez přiřazení ke službě'}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {assignment.assigned_at && (
                              <p className="text-xs text-slate-400 mr-2">
                                {new Date(assignment.assigned_at).toLocaleDateString('cs-CZ')}
                              </p>
                            )}
                            <button
                              onClick={() => setEditWorker({ id: assignment.id, worker_id: assignment.worker_id, service_id: assignment.service_id || '' })}
                              className="text-slate-400 hover:text-blue-500 p-1"
                              title="Upravit"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleRemoveWorker(assignment.id)}
                              className="text-slate-400 hover:text-red-500 p-1"
                              title="Odebrat"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-slate-500 text-sm">Zatím není přiřazen žádný zaměstnanec.</p>
            )}

            <form onSubmit={handleAssignWorker} className="grid grid-cols-1 gap-3 sm:grid-cols-3 border-t pt-4">
              <div>
                <Label>Zaměstnanec</Label>
                <select
                  value={assignWorkerForm.worker_id}
                  onChange={(e) => setAssignWorkerForm((p) => ({ ...p, worker_id: e.target.value }))}
                  className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  disabled={isAssigningWorker}
                >
                  <option value="">Vyberte zaměstnance</option>
                  {workers.map((w) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Služba na zakázce</Label>
                <select
                  value={assignWorkerForm.service_id}
                  onChange={(e) => setAssignWorkerForm((p) => ({ ...p, service_id: e.target.value }))}
                  className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  disabled={isAssigningWorker}
                >
                  <option value="">Bez přiřazení ke službě</option>
                  {orderServices.map((s) => (
                    <option key={s.id} value={s.service_id || s.id}>
                      {s.custom_service_name || s.service?.name || '–'}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <Button type="submit" disabled={isAssigningWorker || !assignWorkerForm.worker_id} className="w-full">
                  {isAssigningWorker ? 'Přiřazování…' : 'Přiřadit'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* ── Checklist ── */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle>
                Checklist
                {checklistItems.length > 0 && (
                  <span className="ml-2 text-base font-normal text-slate-500">
                    {completedCount}/{checklistItems.length} dokončeno
                  </span>
                )}
              </CardTitle>
              <div className="flex items-center gap-1 text-sm">
                <span className="text-slate-500 mr-1">Řadit:</span>
                <button type="button" onClick={() => setChecklistSort('manual')}
                  className={`px-2 py-1 rounded ${checklistSort === 'manual' ? 'bg-slate-200 font-semibold text-slate-800' : 'text-slate-500 hover:bg-slate-100'}`}>
                  Ručně
                </button>
                <button type="button" onClick={() => setChecklistSort('deadline')}
                  className={`px-2 py-1 rounded ${checklistSort === 'deadline' ? 'bg-slate-200 font-semibold text-slate-800' : 'text-slate-500 hover:bg-slate-100'}`}>
                  Podle deadline
                </button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Readonly banner */}
            {isReadonly && (
              <div className="rounded-md bg-slate-100 border border-slate-300 px-4 py-2 text-sm text-slate-600">
                Zakázka je dokončena — checklist je pouze pro čtení
              </div>
            )}
            {/* Bulk actions */}
            {checklistItems.length > 0 && !isReadonly && (
              <div className="flex gap-2 flex-wrap">
                <button type="button" onClick={() => setBulkDialog({ open: true, action: 'done' })}
                  className="text-xs px-3 py-1.5 rounded border border-slate-300 bg-white text-slate-600 hover:bg-slate-50">
                  Označit vše jako hotové
                </button>
                <button type="button" onClick={() => setBulkDialog({ open: true, action: 'undone' })}
                  className="text-xs px-3 py-1.5 rounded border border-slate-300 bg-white text-slate-600 hover:bg-slate-50">
                  Odznačit vše
                </button>
              </div>
            )}
            {checklistItems.length > 0 ? (
              <div className="space-y-2">
                {sortedChecklistItems.map((item) => {
                  const isEditing = editChecklistItem?.id === item.id;
                  const editDeadlineError = isEditing ? validateDeadline(editChecklistItem?.due_date ?? '') : null;
                  const isOutOfRange = item.due_date && !item.is_completed && orderEndDate && (
                    (orderStartDate && item.due_date < orderStartDate) || item.due_date > orderEndDate
                  );
                  return (
                    <div key={item.id} className="rounded-lg border border-slate-200 bg-white p-3">
                      {isEditing ? (
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={editChecklistItem.title}
                            onChange={(e) => setEditChecklistItem((p) => p ? { ...p, title: e.target.value } : p)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Název položky"
                          />
                          <textarea
                            value={editChecklistItem.description}
                            onChange={(e) => setEditChecklistItem((p) => p ? { ...p, description: e.target.value } : p)}
                            rows={2}
                            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Popis (volitelný)"
                          />
                          <div className="grid gap-2 sm:grid-cols-2">
                            <select
                              value={editChecklistItem.assigned_to}
                              onChange={(e) => setEditChecklistItem((p) => p ? { ...p, assigned_to: e.target.value } : p)}
                              className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="">Bez zaměstnance</option>
                              {workers.map((w) => (
                                <option key={w.id} value={w.id}>{w.name}</option>
                              ))}
                            </select>
                            <select
                              value={editChecklistItem.assigned_service_id}
                              onChange={(e) => setEditChecklistItem((p) => p ? { ...p, assigned_service_id: e.target.value } : p)}
                              className="w-full px-3 py-2 border border-slate-300 rounded-md bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="">Bez služby</option>
                              {orderServices.map((s) => (
                                <option key={s.id} value={s.service_id || s.id}>
                                  {s.custom_service_name || s.service?.name || '–'}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="text-xs text-slate-500 mb-1 block">Deadline</label>
                            <input
                              type="date"
                              value={editChecklistItem?.due_date ?? ''}
                              onChange={(e) => setEditChecklistItem((p) => p ? { ...p, due_date: e.target.value } : p)}
                              min={orderStartDate || undefined}
                              max={orderEndDate || undefined}
                              disabled={!orderEndDate}
                              className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${editDeadlineError ? 'border-red-400' : 'border-slate-300'} ${!orderEndDate ? 'bg-slate-50 text-slate-400' : ''}`}
                            />
                            {editDeadlineError && <p className="text-xs text-red-600 mt-1">{editDeadlineError}</p>}
                            {!orderEndDate && <p className="text-xs text-amber-600 mt-1">Nejprve nastavte termín zakázky</p>}
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" disabled={!editChecklistItem.title.trim() || !!editDeadlineError} onClick={handleUpdateChecklistItem}>
                              Uložit
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setEditChecklistItem(null)}>
                              Zrušit
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={item.is_completed}
                            onChange={isReadonly ? undefined : () => toggleChecklistItem(item)}
                            disabled={isReadonly}
                            className={`mt-1 h-4 w-4 shrink-0 ${isReadonly ? 'cursor-default opacity-60' : 'cursor-pointer'}`}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className={`font-semibold ${item.is_completed ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
                                {item.title}
                              </p>
                              {item.assigned_service?.category && (
                                <span className={`text-xs px-2 py-0.5 rounded font-medium ${item.assigned_service.category.color_class || 'bg-slate-100 text-slate-600'}`}>
                                  {item.assigned_service.category.name}
                                </span>
                              )}
                              {(() => {
                                const badge = deadlineBadge(item);
                                return badge ? (
                                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${badge.colorClass}`}>
                                    {badge.label}
                                    {isOutOfRange && <AlertTriangle className="w-3 h-3 ml-0.5" aria-label="Deadline mimo termín zakázky" />}
                                  </span>
                                ) : isOutOfRange ? (
                                  <span aria-label="Deadline mimo termín zakázky" className="text-amber-500">
                                    <AlertTriangle className="w-3.5 h-3.5 inline" />
                                  </span>
                                ) : null;
                              })()}
                            </div>
                            {item.description && <p className="text-sm text-slate-500">{item.description}</p>}
                            <div className="text-xs text-slate-400 mt-1 flex gap-3 flex-wrap">
                              {item.assigned_worker && <span>Zaměstnanec: {item.assigned_worker.name}</span>}
                              {item.assigned_service && <span>Služba: {item.assigned_service.name}</span>}
                              {item.completed_at && <span>Dokončeno: {new Date(item.completed_at).toLocaleDateString('cs-CZ')}</span>}
                            </div>
                          </div>
                          {!isReadonly && (
                            <div className="flex gap-1 shrink-0">
                              <button
                                onClick={() => setEditChecklistItem({
                                  id: item.id,
                                  title: item.title,
                                  description: item.description || '',
                                  assigned_to: item.assigned_to || '',
                                  assigned_service_id: item.assigned_service_id || '',
                                  due_date: item.due_date || '',
                                })}
                                className="text-slate-400 hover:text-blue-500 p-1"
                                title="Upravit"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteChecklistItem(item.id)}
                                className="text-slate-400 hover:text-red-500 p-1"
                                title="Smazat"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-slate-500 text-sm">Zatím žádné položky. Přidejte níže.</p>
            )}

            {!isReadonly && (
              <form onSubmit={handleAddChecklistItem} className="grid grid-cols-1 gap-3 border-t pt-4">
                <div>
                  <label className="text-sm font-medium leading-none">Název položky</label>
                  <Input
                    value={checklistForm.title}
                    onChange={(e) => setChecklistForm((p) => ({ ...p, title: e.target.value }))}
                    placeholder="Např. Dekontaminace laku"
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium leading-none">Popis (volitelný)</label>
                  <textarea
                    value={checklistForm.description}
                    onChange={(e) => setChecklistForm((p) => ({ ...p, description: e.target.value }))}
                    rows={2}
                    className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium leading-none">Přiřadit zaměstnance</label>
                    <select
                      value={checklistForm.assigned_to}
                      onChange={(e) => setChecklistForm((p) => ({ ...p, assigned_to: e.target.value }))}
                      className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-md bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Bez přiřazení</option>
                      {workers.map((w) => (
                        <option key={w.id} value={w.id}>{w.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium leading-none">Přiřadit ke službě zakázky</label>
                    <select
                      value={checklistForm.assigned_service_id}
                      onChange={(e) => setChecklistForm((p) => ({ ...p, assigned_service_id: e.target.value }))}
                      className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-md bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Bez přiřazení ke službě</option>
                      {orderServices.map((s) => (
                        <option key={s.id} value={s.service_id || s.id}>
                          {s.custom_service_name || s.service?.name || '–'}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium leading-none">Deadline položky</label>
                  {!orderEndDate && (
                    <p className="text-xs text-amber-600 mt-0.5">Nejprve nastavte termín zakázky pro nastavení deadline.</p>
                  )}
                  <input
                    type="date"
                    value={checklistForm.due_date}
                    onChange={(e) => setChecklistForm((p) => ({ ...p, due_date: e.target.value }))}
                    min={orderStartDate || undefined}
                    max={orderEndDate || undefined}
                    disabled={!orderEndDate}
                    className={`w-full mt-1 px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${validateDeadline(checklistForm.due_date) ? 'border-red-400' : 'border-slate-300'} ${!orderEndDate ? 'bg-slate-50' : ''}`}
                  />
                  {validateDeadline(checklistForm.due_date) && (
                    <p className="text-xs text-red-600 mt-1">{validateDeadline(checklistForm.due_date)}</p>
                  )}
                </div>
                <div className="flex justify-end">
                  <Button type="submit" disabled={isAddingChecklistItem || !checklistForm.title.trim() || !!validateDeadline(checklistForm.due_date)}>
                    {isAddingChecklistItem ? 'Přidávání…' : 'Přidat položku'}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Edit Dialog ── */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Upravit zakázku</DialogTitle></DialogHeader>
          <form onSubmit={handleUpdate} className="space-y-4 mt-4 max-h-[80vh] overflow-y-auto">
            <div>
              <Label>Název zakázky</Label>
              <Input
                value={editForm.name}
                onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Název zakázky"
                disabled={isSaving}
              />
            </div>
            <div>
              <Label>Status</Label>
              <select
                value={editForm.status}
                onChange={(e) => setEditForm((p) => ({ ...p, status: e.target.value }))}
                className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isSaving}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Termín začátek</Label>
                <input
                  type="date"
                  value={editForm.scheduled_start}
                  onChange={(e) => setEditForm((p) => ({ ...p, scheduled_start: e.target.value }))}
                  className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  disabled={isSaving}
                />
              </div>
              <div>
                <Label>Termín konec</Label>
                <input
                  type="date"
                  value={editForm.scheduled_end}
                  onChange={(e) => setEditForm((p) => ({ ...p, scheduled_end: e.target.value }))}
                  className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  disabled={isSaving}
                />
              </div>
            </div>
            <div>
              <Label>Způsob platby</Label>
              <select
                value={editForm.payment_method}
                onChange={(e) => setEditForm((p) => ({ ...p, payment_method: e.target.value }))}
                className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isSaving}
              >
                <option value="">– nevybráno –</option>
                {Object.entries(PAYMENT_METHODS).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_paid"
                  checked={editForm.is_paid}
                  onChange={(e) => setEditForm((p) => ({ ...p, is_paid: e.target.checked }))}
                  className="w-4 h-4"
                  disabled={isSaving}
                />
                <Label htmlFor="is_paid">Zaplaceno</Label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_invoiced"
                  checked={editForm.is_invoiced}
                  onChange={(e) => setEditForm((p) => ({ ...p, is_invoiced: e.target.checked }))}
                  className="w-4 h-4"
                  disabled={isSaving}
                />
                <Label htmlFor="is_invoiced">Fakturováno</Label>
              </div>
            </div>
            <div>
              <Label>Poznámka klienta</Label>
              <textarea
                value={editForm.customer_notes}
                onChange={(e) => setEditForm((p) => ({ ...p, customer_notes: e.target.value }))}
                rows={2}
                className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isSaving}
              />
            </div>
            <div>
              <Label>Interní poznámka</Label>
              <textarea
                value={editForm.internal_notes}
                onChange={(e) => setEditForm((p) => ({ ...p, internal_notes: e.target.value }))}
                rows={2}
                className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isSaving}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)} disabled={isSaving}>Zrušit</Button>
              <Button type="submit" disabled={isSaving}>{isSaving ? 'Ukládá se...' : 'Uložit'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Copy Dialog ── */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Smazat zakázku</DialogTitle></DialogHeader>
          <p className="text-sm text-slate-600 mb-4">
            Opravdu chcete smazat zakázku <strong>{getOrderDisplayName(order)}</strong>? Tuto akci nelze vrátit zpět.
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={isSaving}>
              Zrušit
            </Button>
            <Button type="button" onClick={handleDelete} disabled={isSaving}>
              {isSaving ? 'Maže se...' : 'Smazat'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={copyDialogOpen} onOpenChange={setCopyDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Kopírovat zakázku na nový termín</DialogTitle></DialogHeader>
          <form onSubmit={handleCopyOrder} className="space-y-4 mt-4">
            <p className="text-sm text-slate-600">
              Vytvoří novou zakázku se stejným zákazníkem, vozidlem, službami a checklistem.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Nový začátek *</Label>
                <Input
                  type="date"
                  value={copyDate}
                  onChange={(e) => setCopyDate(e.target.value)}
                  required
                  disabled={isCopying}
                />
              </div>
              <div>
                <Label>Nový konec</Label>
                <Input
                  type="date"
                  value={copyEndDate}
                  onChange={(e) => setCopyEndDate(e.target.value)}
                  disabled={isCopying}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCopyDialogOpen(false)} disabled={isCopying}>Zrušit</Button>
              <Button type="submit" disabled={isCopying || !copyDate}>
                {isCopying ? 'Kopírování…' : 'Zkopírovat'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Bulk Action Dialog ── */}
      <Dialog open={bulkDialog.open} onOpenChange={(open) => setBulkDialog((p) => ({ ...p, open }))}>
        <DialogContent>
          <DialogHeader>
            <h2 className="text-lg font-semibold leading-none tracking-tight">
              {bulkDialog.action === 'done' ? 'Označit vše jako hotové' : 'Odznačit vše'}
            </h2>
          </DialogHeader>
          <p className="text-sm text-slate-600">
            Opravdu {bulkDialog.action === 'done' ? 'označit' : 'odznačit'} všech{' '}
            <strong>{checklistItems.length}</strong>{' '}
            {checklistItems.length === 1 ? 'položku' : checklistItems.length < 5 ? 'položky' : 'položek'} jako{' '}
            {bulkDialog.action === 'done' ? 'hotové' : 'nehotové'}?
          </p>
          <div className="flex justify-end gap-2 mt-4">
            <button
              type="button"
              className="px-4 py-2 text-sm font-medium border border-slate-300 rounded-md hover:bg-slate-50"
              onClick={() => setBulkDialog((p) => ({ ...p, open: false }))}
            >Zrušit</button>
            <button
              type="button"
              className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700"
              onClick={() => handleBulkAction(bulkDialog.action === 'done')}
            >
              {bulkDialog.action === 'done' ? 'Označit vše' : 'Odznačit vše'}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Date Warning Dialog ── */}
      <Dialog open={dateWarningDialog.open} onOpenChange={(open) => setDateWarningDialog((p) => ({ ...p, open }))}>
        <DialogContent>
          <DialogHeader>
            <h2 className="text-lg font-semibold leading-none tracking-tight">Deadline mimo nový termín zakázky</h2>
          </DialogHeader>
          <p className="text-sm text-slate-600">
            <strong>{dateWarningDialog.items.length}</strong>{' '}
            {dateWarningDialog.items.length === 1 ? 'položka checklistu má' : dateWarningDialog.items.length < 5 ? 'položky checklistu mají' : 'položek checklistu má'}{' '}
            deadline mimo nový termín zakázky
            {dateWarningDialog.newEndDate && (() => {
              const [y, m, d] = dateWarningDialog.newEndDate.split('-').map(Number);
              return ` (${new Date(y, m - 1, d).toLocaleDateString('cs-CZ')})`;
            })()}. Chcete je nastavit automaticky?
          </p>
          <div className="flex justify-end gap-2 mt-4">
            <button
              type="button"
              className="px-4 py-2 text-sm font-medium border border-slate-300 rounded-md hover:bg-slate-50"
              onClick={() => setDateWarningDialog({ open: false, items: [], newEndDate: '' })}
            >Ponechat</button>
            <button
              type="button"
              className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700"
              onClick={handleDateWarningConfirm}
            >Upravit automaticky</button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
