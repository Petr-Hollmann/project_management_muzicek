import { supabase } from '../supabase-client';

/**
 * Generates next order number in format: Z-YYYY-XXX
 * e.g. Z-2026-001, Z-2026-002, etc.
 */
export async function generateOrderNumber(): Promise<string> {
  try {
    const now = new Date();
    const year = now.getFullYear();
    const prefix = `Z-${year}-`;

    // Get the highest sequential number for this year
    const { data, error } = await supabase
      .from('order')
      .select('order_number', { count: 'exact' })
      .ilike('order_number', `${prefix}%`)
      .order('order_number', { ascending: false })
      .limit(1);

    if (error) throw error;

    let nextNumber = 1;
    if (data && data.length > 0) {
      const lastNumber = data[0].order_number;
      const parts = lastNumber.split('-');
      if (parts.length === 3 && !isNaN(parseInt(parts[2]))) {
        nextNumber = parseInt(parts[2]) + 1;
      }
    }

    return `${prefix}${String(nextNumber).padStart(3, '0')}`;
  } catch (error) {
    console.error('Generate order number error:', error);
    throw error;
  }
}

/**
 * Generates default order name in format: Customer - Vehicle - End Date
 */
export async function generateOrderName(customerId: string, vehicleId?: string, scheduledDate?: string): Promise<string> {
  try {
    // Fetch customer name
    const { data: customer, error: customerError } = await supabase
      .from('customer')
      .select('name')
      .eq('id', customerId)
      .single();

    if (customerError) throw customerError;

    let vehicleInfo = '';
    if (vehicleId) {
      const { data: vehicle, error: vehicleError } = await supabase
        .from('vehicle')
        .select('brand, model')
        .eq('id', vehicleId)
        .single();

      if (!vehicleError && vehicle) {
        vehicleInfo = `${vehicle.brand || ''} ${vehicle.model || ''}`.trim();
      }
    }

    let dateInfo = '';
    if (scheduledDate) {
      dateInfo = new Date(scheduledDate).toLocaleDateString('cs-CZ');
    }

    const parts = [customer.name, vehicleInfo, dateInfo].filter(Boolean);
    return parts.join(' - ');
  } catch (error) {
    console.error('Generate order name error:', error);
    // Fallback to order number if generation fails
    return await generateOrderNumber();
  }
}

/**
 * Returns a full display label for an order using customer, vehicle and date when needed.
 */
export function getOrderDisplayName(order: any): string {
  if (order?.name?.trim()) return order.name.trim();

  const customer = order?.customer?.name || '';
  const vehicle = order?.vehicle ? `${order.vehicle.brand || ''} ${order.vehicle.model || ''}`.trim() : '';
  const date = order?.scheduled_end || order?.scheduled_start
    ? new Date(order.scheduled_end || order.scheduled_start).toLocaleDateString('cs-CZ')
    : '';

  return [customer, vehicle, date].filter(Boolean).join(' – ') || order?.order_number || '';
}

const ACTIVE_STATUSES = ['planned', 'confirmed', 'in_progress'] as const;

export async function getActiveOrdersByCustomer(customerId: string): Promise<any[]> {
  const { data, error } = await supabase
    .from('order')
    .select('id, order_number, name, status, scheduled_start, scheduled_end, vehicle:vehicle_id(brand, model, spz)')
    .eq('customer_id', customerId)
    .in('status', ACTIVE_STATUSES)
    .order('scheduled_start', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function getActiveOrdersByVehicle(vehicleId: string): Promise<any[]> {
  const { data, error } = await supabase
    .from('order')
    .select('id, order_number, name, status, scheduled_start, scheduled_end')
    .eq('vehicle_id', vehicleId)
    .in('status', ACTIVE_STATUSES)
    .order('scheduled_start', { ascending: true });
  if (error) throw error;
  return data || [];
}

/**
 * Fetch all orders with optional filters
 */
export async function getOrders(filters?: {
  status?: string;
  customer_id?: string;
  limit?: number;
  offset?: number;
}): Promise<any[]> {
  try {
    let query = supabase.from('order').select(`
      id,
      order_number,
      name,
      customer_id,
      vehicle_id,
      scheduled_start,
      scheduled_end,
      actual_start,
      actual_end,
      status,
      total_price,
      payment_method,
      is_paid,
      is_invoiced,
      customer_notes,
      internal_notes,
      created_at,
      updated_at,
      customer:customer_id(id, name, phone, email),
      vehicle:vehicle_id(id, spz, brand, model, color)
    `);

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    if (filters?.customer_id) {
      query = query.eq('customer_id', filters.customer_id);
    }

    query = query.order('scheduled_start', { ascending: false });

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    if (filters?.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Get orders error:', error);
    throw error;
  }
}

/**
 * Fetch single order with all details
 */
export async function getOrder(id: string): Promise<any> {
  try {
    const { data, error } = await supabase
      .from('order')
      .select(`
        id,
        order_number,
        name,
        customer_id,
        vehicle_id,
        scheduled_start,
        scheduled_end,
        actual_start,
        actual_end,
        status,
        total_price,
        payment_method,
        is_paid,
        is_invoiced,
        customer_notes,
        internal_notes,
        created_at,
        updated_at,
        customer:customer_id(id, name, phone, email, ico),
        vehicle:vehicle_id(id, spz, brand, model, year, vin, color, tk_expiry)
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Get order error:', error);
    throw error;
  }
}

/**
 * Create new order
 */
export async function createOrder(data: {
  customer_id?: string;
  vehicle_id?: string;
  name?: string;
  scheduled_start?: string;
  scheduled_end?: string;
  status?: string;
  payment_method?: string;
  customer_notes?: string;
  internal_notes?: string;
  is_paid?: boolean;
  is_invoiced?: boolean;
}): Promise<any> {
  try {
    // Generate order number
    const orderNumber = await generateOrderNumber();

    // Generate name if not provided
    let orderName = data.name?.trim();
    if (!orderName && data.customer_id) {
      orderName = await generateOrderName(data.customer_id, data.vehicle_id, data.scheduled_end || data.scheduled_start);
    }

    const payload = {
      order_number: orderNumber,
      name: orderName,
      customer_id: data.customer_id,
      vehicle_id: data.vehicle_id || null,
      scheduled_start: data.scheduled_start || null,
      scheduled_end: data.scheduled_end || null,
      status: data.status || 'planned',
      payment_method: data.payment_method || null,
      customer_notes: data.customer_notes || null,
      internal_notes: data.internal_notes || null,
      total_price: 0,
      is_paid: data.is_paid ?? false,
      is_invoiced: data.is_invoiced ?? false,
    };

    const { data: created, error } = await supabase
      .from('order')
      .insert([payload])
      .select(`
        id,
        order_number,
        name,
        customer_id,
        vehicle_id,
        scheduled_start,
        scheduled_end,
        status,
        total_price,
        payment_method,
        is_paid,
        is_invoiced,
        customer_notes,
        internal_notes,
        created_at,
        updated_at,
        customer:customer_id(id, name, phone, email),
        vehicle:vehicle_id(id, spz, brand, model)
      `)
      .single();

    if (error) throw error;
    return created;
  } catch (error) {
    console.error('Create order error:', error);
    throw error;
  }
}

/**
 * Update order
 */
export async function updateOrder(id: string, data: {
  name?: string;
  vehicle_id?: string | null;
  scheduled_start?: string | null;
  scheduled_end?: string | null;
  status?: string;
  total_price?: number;
  payment_method?: string;
  is_paid?: boolean;
  is_invoiced?: boolean;
  customer_notes?: string;
  internal_notes?: string;
}): Promise<any> {
  try {
    const { data: updated, error } = await supabase
      .from('order')
      .update(data)
      .eq('id', id)
      .select(`
        id,
        order_number,
        name,
        customer_id,
        vehicle_id,
        scheduled_start,
        scheduled_end,
        status,
        total_price,
        payment_method,
        is_paid,
        is_invoiced,
        customer_notes,
        internal_notes,
        created_at,
        updated_at,
        customer:customer_id(id, name, phone, email),
        vehicle:vehicle_id(id, spz, brand, model)
      `)
      .single();

    if (error) throw error;
    return updated;
  } catch (error) {
    console.error('Update order error:', error);
    throw error;
  }
}

/**
 * Delete order (soft delete via status = archived or hard delete)
 */
export async function deleteOrder(id: string, hard = false): Promise<void> {
  try {
    if (hard) {
      // Hard delete
      const { error } = await supabase.from('order').delete().eq('id', id);
      if (error) throw error;
    } else {
      // Soft delete: set status to archived
      const { error } = await supabase
        .from('order')
        .update({ status: 'archived' })
        .eq('id', id);
      if (error) throw error;
    }
  } catch (error) {
    console.error('Delete order error:', error);
    throw error;
  }
}

export async function getOrderServices(orderId: string): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('order_service')
      .select('id, order_id, service_id, custom_service_name, custom_description, price, quantity, service:service_id(id, name, default_price, category_id)')
      .eq('order_id', orderId)
      .order('sort_order', { ascending: true });
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Get order services error:', error);
    throw error;
  }
}

export async function addOrderServices(orderId: string, items: Array<{
  service_id?: string | null;
  custom_service_name?: string | null;
  custom_description?: string | null;
  price?: number | null;
  quantity?: number;
}>): Promise<any[]> {
  try {
    const payload = items.map((item) => ({
      order_id: orderId,
      service_id: item.service_id || null,
      custom_service_name: item.custom_service_name || null,
      custom_description: item.custom_description || null,
      price: item.price ?? null,
      quantity: item.quantity ?? 1,
    }));

    const { data, error } = await supabase
      .from('order_service')
      .insert(payload)
      .select('id, order_id, service_id, custom_service_name, custom_description, price, quantity, service:service_id(id, name, default_price, category_id)');
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Add order services error:', error);
    throw error;
  }
}

export async function getOrderWorkers(orderId: string): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('order_worker')
      .select('id, order_id, worker_id, service_id, assigned_at, completed_at, worker:worker_id(id, name, role), service:service_id(id, name, category_id)')
      .eq('order_id', orderId);
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Get order workers error:', error);
    throw error;
  }
}

export async function addOrderWorker(orderId: string, workerId: string, serviceId?: string | null): Promise<any> {
  try {
    const { data, error } = await supabase
      .from('order_worker')
      .insert([{ order_id: orderId, worker_id: workerId, service_id: serviceId || null }])
      .select('id, order_id, worker_id, service_id, assigned_at, completed_at, worker:worker_id(id, name, role), service:service_id(id, name, category_id)')
      .single();
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Add order worker error:', error);
    throw error;
  }
}

export async function removeOrderWorker(orderWorkerId: string): Promise<void> {
  try {
    const { error } = await supabase.from('order_worker').delete().eq('id', orderWorkerId);
    if (error) throw error;
  } catch (error) {
    console.error('Remove order worker error:', error);
    throw error;
  }
}

export async function updateOrderWorker(orderWorkerId: string, data: { worker_id?: string; service_id?: string | null }): Promise<any> {
  try {
    const { data: updated, error } = await supabase
      .from('order_worker')
      .update(data)
      .eq('id', orderWorkerId)
      .select('id, order_id, worker_id, service_id, assigned_at, completed_at, worker:worker_id(id, name, role), service:service_id(id, name, category_id)')
      .single();
    if (error) throw error;
    return updated;
  } catch (error) {
    console.error('Update order worker error:', error);
    throw error;
  }
}

export async function getChecklistItems(orderId: string): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('checklist_item')
      .select('id, order_id, title, description, is_completed, assigned_to, assigned_service_id, due_date, completed_at, created_at, updated_at, assigned_worker:assigned_to(id, name), assigned_service:assigned_service_id(id, name, category_id, category:category_id(id, name, color_class))')
      .eq('order_id', orderId)
      .order('sort_order', { ascending: true });
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Get checklist items error:', error);
    throw error;
  }
}

export async function addChecklistItem(orderId: string, payload: {
  title: string;
  description?: string | null;
  assigned_to?: string | null;
  assigned_service_id?: string | null;
  due_date?: string | null;
}): Promise<any> {
  try {
    const { data, error } = await supabase
      .from('checklist_item')
      .insert([{ order_id: orderId, title: payload.title, description: payload.description || null, assigned_to: payload.assigned_to || null, assigned_service_id: payload.assigned_service_id || null, due_date: payload.due_date || null }])
      .select('id, order_id, title, description, is_completed, assigned_to, assigned_service_id, due_date, completed_at, created_at, updated_at, assigned_worker:assigned_to(id, name), assigned_service:assigned_service_id(id, name, category_id, category:category_id(id, name, color_class))')
      .single();
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Add checklist item error:', error);
    throw error;
  }
}

export async function updateChecklistItem(id: string, payload: {
  title?: string;
  description?: string | null;
  is_completed?: boolean;
  assigned_to?: string | null;
  assigned_service_id?: string | null;
  due_date?: string | null;
  completed_at?: string | null;
}): Promise<any> {
  try {
    const { data, error } = await supabase
      .from('checklist_item')
      .update(payload)
      .eq('id', id)
      .select('id, order_id, title, description, is_completed, assigned_to, assigned_service_id, due_date, completed_at, created_at, updated_at, assigned_worker:assigned_to(id, name), assigned_service:assigned_service_id(id, name, category_id, category:category_id(id, name, color_class))')
      .single();
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Update checklist item error:', error);
    throw error;
  }
}

export async function removeOrderService(orderServiceId: string): Promise<void> {
  try {
    const { error } = await supabase.from('order_service').delete().eq('id', orderServiceId);
    if (error) throw error;
  } catch (error) {
    console.error('Remove order service error:', error);
    throw error;
  }
}

export async function deleteChecklistItem(id: string): Promise<void> {
  try {
    const { error } = await supabase.from('checklist_item').delete().eq('id', id);
    if (error) throw error;
  } catch (error) {
    console.error('Delete checklist item error:', error);
    throw error;
  }
}

export async function bulkUpdateChecklistItems(orderId: string, isDone: boolean): Promise<void> {
  try {
    const { error } = await supabase
      .from('checklist_item')
      .update({ is_completed: isDone, completed_at: isDone ? new Date().toISOString() : null })
      .eq('order_id', orderId);
    if (error) throw error;
  } catch (error) {
    console.error('Bulk update checklist items error:', error);
    throw error;
  }
}

/**
 * Duplicate an order to a new date, copying services and checklist items (uncompleted).
 */
export async function duplicateOrder(sourceId: string, newStartDate: string, newEndDate?: string | null): Promise<any> {
  try {
    // Load source order with all relations
    const source = await getOrder(sourceId);
    const services = await getOrderServices(sourceId);
    const checklistItems = await getChecklistItems(sourceId);

    const orderNumber = await generateOrderNumber();

    const { data: newOrder, error: orderError } = await supabase
      .from('order')
      .insert([{
        order_number: orderNumber,
        customer_id: source.customer_id || null,
        vehicle_id: source.vehicle_id || null,
        scheduled_start: newStartDate,
        scheduled_end: newEndDate || null,
        status: 'planned',
        payment_method: source.payment_method || null,
        customer_notes: source.customer_notes || null,
        internal_notes: source.internal_notes || null,
        total_price: source.total_price || 0,
        is_paid: false,
        is_invoiced: false,
      }])
      .select('id, order_number')
      .single();

    if (orderError) throw orderError;

    // Copy services
    if (services.length > 0) {
      const servicePayload = services.map((s: any) => ({
        order_id: newOrder.id,
        service_id: s.service_id || null,
        custom_service_name: s.custom_service_name || null,
        custom_description: s.custom_description || null,
        price: s.price ?? null,
        quantity: s.quantity ?? 1,
      }));
      const { error: svcError } = await supabase.from('order_service').insert(servicePayload);
      if (svcError) throw svcError;
    }

    // Copy checklist items (reset completion, clear worker assignments)
    if (checklistItems.length > 0) {
      const checklistPayload = checklistItems.map((item: any) => ({
        order_id: newOrder.id,
        title: item.title,
        description: item.description || null,
        assigned_to: null,
        assigned_service_id: item.assigned_service_id || null,
        due_date: null,
        is_completed: false,
        completed_at: null,
      }));
      const { error: clError } = await supabase.from('checklist_item').insert(checklistPayload);
      if (clError) throw clError;
    }

    return newOrder;
  } catch (error) {
    console.error('Duplicate order error:', error);
    throw error;
  }
}

/**
 * Fetch orders overlapping a calendar month for the calendar view.
 * Includes nested order_service → service → category for color/filter logic.
 */
/**
 * Fetch orders overlapping a calendar month.
 * Uses two separate queries (orders + order_services) joined client-side —
 * avoids the unreliable reverse FK embed `order → order_service` in PostgREST.
 */
export async function getOrdersForCalendar(monthStart: string, monthEnd: string): Promise<any[]> {
  try {
    // 1. Orders in date range
    const { data: orders, error: orderErr } = await supabase
      .from('order')
      .select(`
        id, status, scheduled_start, scheduled_end, name, total_price, order_number,
        is_paid, is_invoiced,
        customer:customer_id(id, name),
        vehicle:vehicle_id(id, spz, brand, model)
      `)
      .lte('scheduled_start', monthEnd)
      .order('scheduled_start', { ascending: true });
    if (orderErr) throw orderErr;

    const filtered = (orders || []).filter((o: any) => {
      const effectiveEnd = o.scheduled_end || o.scheduled_start;
      return effectiveEnd >= monthStart;
    });
    if (filtered.length === 0) return [];

    const ids = filtered.map((o: any) => o.id);

    // 2. Raw order_service rows (just ids — no nested join for service)
    const { data: rawSvc, error: svcErr } = await supabase
      .from('order_service')
      .select('id, order_id, price, service_id, custom_service_name')
      .in('order_id', ids);
    if (svcErr) throw svcErr;

    // 3. service table → name + category_id
    const serviceIds = [...new Set(
      (rawSvc || []).filter((s: any) => s.service_id).map((s: any) => s.service_id)
    )];
    const serviceMap: Record<string, any> = {};
    if (serviceIds.length > 0) {
      const { data: svcs } = await supabase
        .from('service')
        .select('id, name, category_id')
        .in('id', serviceIds);
      for (const s of svcs || []) serviceMap[s.id] = s;
    }

    // 4. service_category table → color_class + name (direct query, never fails)
    const catIds = [...new Set(
      Object.values(serviceMap)
        .filter((s: any) => s.category_id)
        .map((s: any) => s.category_id)
    )];
    const catMap: Record<string, any> = {};
    if (catIds.length > 0) {
      const { data: cats } = await supabase
        .from('service_category')
        .select('id, name, color_class')
        .in('id', catIds);
      for (const c of cats || []) catMap[c.id] = c;
    }

    // 5. Merge everything — service.category embedded directly in each row
    const enriched = (rawSvc || []).map((os: any) => {
      const svc = os.service_id ? (serviceMap[os.service_id] ?? null) : null;
      const cat = svc?.category_id ? (catMap[svc.category_id] ?? null) : null;
      return {
        ...os,
        service: svc ? { ...svc, category: cat } : null,
      };
    });

    // 6. Group services by order_id
    const byOrder: Record<string, any[]> = {};
    for (const s of enriched) {
      if (!byOrder[s.order_id]) byOrder[s.order_id] = [];
      byOrder[s.order_id].push(s);
    }

    // 7. Checklist items for these orders
    const { data: rawChecklist } = await supabase
      .from('checklist_item')
      .select('id, order_id, title, description, due_date, is_completed, completed_at, assigned_to, assigned_service_id')
      .in('order_id', ids)
      .order('id', { ascending: true });

    // 8. Worker names for assigned_to UUIDs
    const workerIds = [...new Set(
      (rawChecklist || []).filter((c: any) => c.assigned_to).map((c: any) => c.assigned_to)
    )];
    const workerMap: Record<string, string> = {};
    if (workerIds.length > 0) {
      const { data: workers } = await supabase
        .from('worker')
        .select('id, name')
        .in('id', workerIds);
      for (const w of workers || []) workerMap[w.id] = w.name;
    }

    // Attach worker name to each checklist item
    const checklist = (rawChecklist || []).map((c: any) => ({
      ...c,
      worker_name: c.assigned_to ? (workerMap[c.assigned_to] ?? null) : null,
    }));

    // Group checklist by order_id
    const checklistByOrder: Record<string, any[]> = {};
    for (const c of checklist) {
      if (!checklistByOrder[c.order_id]) checklistByOrder[c.order_id] = [];
      checklistByOrder[c.order_id].push(c);
    }

    return filtered.map((o: any) => ({
      ...o,
      order_service:  byOrder[o.id]       ?? [],
      checklist_item: checklistByOrder[o.id] ?? [],
    }));
  } catch (error) {
    console.error('Get orders for calendar error:', error);
    throw error;
  }
}

/**
 * Helper: Map order status to color classes
 */
export function getStatusColor(status: string): string {
  const map: { [key: string]: string } = {
    planned: 'border-l-4 border-l-gray-400 bg-gray-50',
    confirmed: 'border-l-4 border-l-blue-500 bg-blue-50',
    in_progress: 'border-l-4 border-l-orange-500 bg-orange-50',
    completed: 'border-l-4 border-l-green-500 bg-green-50',
    archived: 'border-l-4 border-l-slate-700 bg-slate-100',
  };
  return map[status] || 'bg-gray-50';
}

/**
 * Helper: Map order status to badge classes
 */
export function getStatusBadge(status: string): string {
  const map: { [key: string]: string } = {
    planned: 'bg-gray-100 text-gray-800',
    confirmed: 'bg-blue-100 text-blue-800',
    in_progress: 'bg-orange-100 text-orange-800',
    completed: 'bg-green-100 text-green-800',
    archived: 'bg-slate-200 text-slate-700',
  };
  return map[status] || 'bg-gray-100 text-gray-800';
}

/**
 * Helper: Map order status to label
 */
export function getStatusLabel(status: string): string {
  const map: { [key: string]: string } = {
    planned: 'Plánováno',
    confirmed: 'Potvrzeno',
    in_progress: 'Probíhá',
    completed: 'Dokončeno',
    archived: 'Archivováno',
  };
  return map[status] || status;
}

/**
 * Business rule: cannot set status to 'completed' without at least one service.
 * Returns error message string, or null if valid.
 */
export function validateStatusChange(newStatus: string, servicesCount: number): string | null {
  if (newStatus === 'completed' && servicesCount === 0) {
    return 'Přidejte alespoň jednu službu před dokončením zakázky.';
  }
  return null;
}

/**
 * Business rule: cannot mark order as paid without specifying a payment method.
 * Returns error message string, or null if valid.
 */
export function validatePaymentFields(isPaid: boolean, paymentMethod: string | null | undefined): string | null {
  if (isPaid && !paymentMethod) {
    return 'Zvolte způsob platby před označením zakázky jako zaplacené.';
  }
  return null;
}
