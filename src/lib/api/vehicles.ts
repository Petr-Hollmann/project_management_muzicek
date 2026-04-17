import { supabase } from '@/lib/supabase-client';

export async function getAllVehicles() {
  const { data, error } = await supabase
    .from('customer_vehicle')
    .select('id, customer_id, brand, model, spz, vin, color, year, specification, tk_expiry, note, is_active, created_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getVehicleBySpz(spz: string) {
  const { data, error } = await supabase
    .from('customer_vehicle')
    .select('id, spz, brand, model, customer:customer_id(id, name)')
    .ilike('spz', spz.trim())
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getAllVehiclesWithCustomer() {
  const { data, error } = await supabase
    .from('customer_vehicle')
    .select('id, customer_id, brand, model, spz, vin, color, year, specification, tk_expiry, note, is_active, created_at, customer:customer_id(id, name, phone, email, status)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).filter((v) => (v.customer as any)?.status !== 'one_time');
}

export async function getVehiclesByCustomer(customerId: string) {
  const { data, error } = await supabase
    .from('customer_vehicle')
    .select('id, customer_id, brand, model, spz, vin, color, year, specification, tk_expiry, note, is_active, created_at')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getVehicle(id: string) {
  const { data, error } = await supabase
    .from('customer_vehicle')
    .select('id, customer_id, brand, model, spz, vin, color, year, specification, tk_expiry, note, is_active, created_at, updated_at, customer:customer_id(id, name, phone, email, ico)')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function createVehicle(customerId: string, payload: {
  brand?: string;
  model?: string;
  spz: string;
  vin?: string;
  color?: string;
  year?: number;
  specification?: string;
  tk_expiry?: string;
  note?: string;
  is_active?: boolean;
}) {
  const { data, error } = await supabase
    .from('customer_vehicle')
    .insert([{ customer_id: customerId, ...payload, is_active: payload.is_active ?? true }])
    .select('id, customer_id, brand, model, spz, vin, color, year, specification, tk_expiry, note, is_active')
    .single();
  if (error) throw error;
  return data;
}

export async function updateVehicle(id: string, payload: Partial<{
  brand: string;
  model: string;
  spz: string;
  vin: string;
  color: string;
  year: number;
  specification: string;
  tk_expiry: string;
  note: string;
  is_active: boolean;
}>) {
  const cleanPayload = Object.fromEntries(
    Object.entries(payload).map(([k, v]) => [k, v === '' ? null : v])
  );
  const { data, error } = await supabase
    .from('customer_vehicle')
    .update(cleanPayload)
    .eq('id', id)
    .select('id, customer_id, brand, model, spz, vin, color, year, specification, tk_expiry, note, is_active')
    .single();
  if (error) throw error;
  return data;
}

export async function deleteVehicle(id: string) {
  const { error } = await supabase
    .from('customer_vehicle')
    .delete()
    .eq('id', id);
  if (error) throw error;
  return true;
}

export function getTkStatus(tkExpiry?: string): 'expired' | 'critical' | 'warning' | 'ok' | 'unknown' {
  if (!tkExpiry) return 'unknown';
  const expiryDate = new Date(tkExpiry);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  expiryDate.setHours(0, 0, 0, 0);

  const daysUntilExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (daysUntilExpiry < 0) return 'expired';
  if (daysUntilExpiry < 30) return 'critical';
  if (daysUntilExpiry < 60) return 'warning';
  return 'ok';
}

export function getTkColor(status: string): string {
  switch (status) {
    case 'expired':
      return 'bg-red-100 text-red-700 border-red-300';
    case 'critical':
      return 'bg-red-100 text-red-700 border-red-300';
    case 'warning':
      return 'bg-orange-100 text-orange-700 border-orange-300';
    case 'ok':
      return 'bg-green-100 text-green-700 border-green-300';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-300';
  }
}
