import { supabase } from '@/lib/supabase-client';

export class BaseEntity {
  constructor(tableName) {
    this.tableName = tableName;
    this.client = supabase;
  }

  _parseSort(sortStr) {
    if (!sortStr) return { column: 'created_at', ascending: false };
    const ascending = !sortStr.startsWith('-');
    const column = sortStr.replace(/^-/, '')
      .replace('created_date', 'created_at')
      .replace('updated_date', 'updated_at');
    return { column, ascending };
  }

  async list(sortBy = '-created_at') {
    const { column, ascending } = this._parseSort(sortBy);
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .order(column, { ascending });
    if (error) throw new Error(`[${this.tableName}] list() failed: ${error.message}`);
    return data ?? [];
  }

  async filter(filters = {}, sortBy = '-created_at') {
    const { column, ascending } = this._parseSort(sortBy);
    let query = this.client.from(this.tableName).select('*');
    Object.entries(filters).forEach(([key, value]) => {
      if (value === undefined || value === null) return;
      if (Array.isArray(value)) {
        query = query.in(key, value);
      } else {
        query = query.eq(key, value);
      }
    });
    query = query.order(column, { ascending });
    const { data, error } = await query;
    if (error) throw new Error(`[${this.tableName}] filter() failed: ${error.message}`);
    return data ?? [];
  }

  async get(id) {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw new Error(`[${this.tableName}] get() failed: ${error.message}`);
    return data;
  }

  async create(payload) {
    const { data, error } = await this.client
      .from(this.tableName)
      .insert([payload])
      .select()
      .single();
    if (error) throw new Error(`[${this.tableName}] create() failed: ${error.message}`);
    return data;
  }

  async update(id, payload) {
    // Strip auto-managed / read-only columns that Supabase won't accept in an UPDATE
    const { id: _id, created_at, updated_at, ...rest } = payload;
    // Convert empty strings to null — prevents unique constraint violations
    // caused by DB triggers when a nullable field (e.g. phone) was null in DB
    // but got coerced to "" by the form's null→"" conversion
    const cleanPayload = Object.fromEntries(
      Object.entries(rest).map(([k, v]) => [k, v === '' ? null : v])
    );
    const { data, error } = await this.client
      .from(this.tableName)
      .update(cleanPayload)
      .eq('id', id)
      .select()
      .single();
    if (error) throw new Error(`[${this.tableName}] update() failed: ${error.message}`);
    return data;
  }

  async delete(id) {
    const { data, error } = await this.client
      .from(this.tableName)
      .delete()
      .eq('id', id)
      .select();
    if (error) throw new Error(`[${this.tableName}] delete() failed: ${error.message}`);
    if (!data || data.length === 0) throw new Error(`[${this.tableName}] delete() failed: no rows deleted (check RLS policies)`);
    return true;
  }
}
