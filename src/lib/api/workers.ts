import { supabase } from '@/lib/supabase-client';

export async function getWorkers() {
  const { data, error } = await supabase
    .from('worker')
    .select('id, name, phone, email, role, categories, is_active')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createWorker(payload) {
  const { data, error } = await supabase
    .from('worker')
    .insert([{ ...payload }])
    .select('id, name, phone, email, role, categories, is_active')
    .single();
  if (error) throw error;
  return data;
}

export async function updateWorker(id, payload) {
  const { data, error } = await supabase
    .from('worker')
    .update(payload)
    .eq('id', id)
    .select('id, name, phone, email, role, categories, is_active')
    .single();
  if (error) throw error;
  return data;
}

export async function deactivateWorker(id) {
  const { data, error } = await supabase
    .from('worker')
    .update({ is_active: false })
    .eq('id', id)
    .select('id, is_active')
    .single();
  if (error) throw error;
  return data;
}

export async function reactivateWorker(id) {
  const { data, error } = await supabase
    .from('worker')
    .update({ is_active: true })
    .eq('id', id)
    .select('id, is_active')
    .single();
  if (error) throw error;
  return data;
}

export async function deleteWorker(id) {
  const { error } = await supabase
    .from('worker')
    .delete()
    .eq('id', id);
  if (error) throw error;
  return true;
}
