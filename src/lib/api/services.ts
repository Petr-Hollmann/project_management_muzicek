import { supabase } from '@/lib/supabase-client';

export async function getServiceCategories() {
  const { data, error } = await supabase
    .from('service_category')
    .select('id, name, color_class, sort_order')
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function getServices() {
  const { data, error } = await supabase
    .from('service')
    .select('id, name, description, category_id, default_price, duration_minutes, is_active, sort_order')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function updateService(id: string, payload: { default_price?: number | null; name?: string; description?: string | null; is_active?: boolean }) {
  const { data, error } = await supabase
    .from('service')
    .update(payload)
    .eq('id', id)
    .select('id, name, description, category_id, default_price, duration_minutes, is_active, sort_order')
    .single();
  if (error) throw error;
  return data;
}

export async function createService(payload: { name: string; category_id: string; default_price?: number | null; description?: string | null }) {
  const { data, error } = await supabase
    .from('service')
    .insert([{ ...payload, is_active: true }])
    .select('id, name, description, category_id, default_price, duration_minutes, is_active, sort_order')
    .single();
  if (error) throw error;
  return data;
}

export async function deleteService(id: string) {
  const { error } = await supabase.from('service').delete().eq('id', id);
  if (error) throw error;
}

export async function updateServiceCategory(id: string, payload: { name?: string; color_class?: string }) {
  const { data, error } = await supabase
    .from('service_category')
    .update(payload)
    .eq('id', id)
    .select('id, name, color_class, sort_order')
    .single();
  if (error) throw error;
  return data;
}
