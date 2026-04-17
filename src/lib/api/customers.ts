import { supabase } from '@/lib/supabase-client';

export async function getCustomers() {
  const { data, error } = await supabase
    .from('customer')
    .select('id, name, phone, email, ico, note, status, created_at')
    .neq('status', 'one_time')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getCustomer(id: string) {
  const { data, error } = await supabase
    .from('customer')
    .select('id, name, phone, email, ico, note, status, created_at, updated_at')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function createCustomer(payload: {
  name: string;
  phone?: string;
  email?: string;
  ico?: string;
  note?: string;
  status?: string;
}) {
  const { data, error } = await supabase
    .from('customer')
    .insert([{ ...payload, status: payload.status || 'active' }])
    .select('id, name, phone, email, ico, note, status')
    .single();
  if (error) throw error;
  return data;
}

export async function updateCustomer(id: string, payload: Partial<{
  name: string;
  phone: string;
  email: string;
  ico: string;
  note: string;
  status: string;
}>) {
  const cleanPayload = Object.fromEntries(
    Object.entries(payload).map(([k, v]) => [k, v === '' ? null : v])
  );
  const { data, error } = await supabase
    .from('customer')
    .update(cleanPayload)
    .eq('id', id)
    .select('id, name, phone, email, ico, note, status')
    .single();
  if (error) throw error;
  return data;
}

export async function deleteCustomer(id: string) {
  const { error } = await supabase
    .from('customer')
    .delete()
    .eq('id', id);
  if (error) throw error;
  return true;
}
