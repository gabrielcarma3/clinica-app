// ============================================================
// SUPABASE CONFIG
// Replace these values with your own Supabase project keys.
// Create a free project at https://supabase.com
// ============================================================
export const SUPABASE_URL = 'https://lpmptzjnbamkgnradwkq.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxwbXB0empuYmFta2ducmFkd2txIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNzcxMTYsImV4cCI6MjA5MTg1MzExNn0.oy6pGVpp17v6iObP2mXNI3psHNTLIo9r9Wav2EVFK3w';

// ============================================================
// SUPABASE SQL — run this in your Supabase SQL editor
// ============================================================
/*
-- Enable Row Level Security on all tables

create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text,
  crp text,
  clinic_name text,
  phone text,
  created_at timestamptz default now()
);

create table public.patients (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  phone text,
  email text,
  day_of_week int not null, -- 0=Mon,1=Tue,...,5=Sat
  time text not null, -- e.g. "09:00"
  value numeric(10,2) not null default 0,
  frequency text not null default 'weekly', -- weekly | biweekly | monthly
  social_price boolean default false,
  session_count int default 0,
  notes text,
  active boolean default true,
  created_at timestamptz default now()
);

create table public.sessions (
  id uuid default gen_random_uuid() primary key,
  patient_id uuid references public.patients(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  date date not null,
  status text not null default 'scheduled', -- scheduled | done | missed | missed_notified | rescheduled | cancelled
  value numeric(10,2),
  paid boolean default false,
  paid_at timestamptz,
  payment_method text, -- pix | card | cash | transfer
  note text,
  rescheduled_to date,
  created_at timestamptz default now()
);

-- RLS Policies
alter table public.profiles enable row level security;
alter table public.patients enable row level security;
alter table public.sessions enable row level security;

create policy "Users own their profile" on public.profiles for all using (auth.uid() = id);
create policy "Users own their patients" on public.patients for all using (auth.uid() = user_id);
create policy "Users own their sessions" on public.sessions for all using (auth.uid() = user_id);

-- Trigger: create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
*/

// ============================================================
// LIGHTWEIGHT SUPABASE CLIENT (no npm needed)
// ============================================================
export class SupabaseClient {
  constructor(url, key) {
    this.url = url;
    this.key = key;
    this.token = null;
  }

  async _fetch(path, opts = {}) {
    const headers = {
      'apikey': this.key,
      'Content-Type': 'application/json',
      'Prefer': opts.prefer || '',
      ...(this.token ? { 'Authorization': `Bearer ${this.token}` } : {}),
      ...opts.headers
    };
    const res = await fetch(`${this.url}${path}`, {
      method: opts.method || 'GET',
      headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined
    });
    if (!res.ok && res.status !== 204) {
      const err = await res.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(err.message || err.error_description || 'Request failed');
    }
    if (res.status === 204) return null;
    return res.json();
  }

  // Auth
  async signUp(email, password, meta = {}) {
    const data = await this._fetch('/auth/v1/signup', {
      method: 'POST',
      body: { email, password, data: meta }
    });
    this.token = data?.access_token;
    if (data?.access_token) this._persistSession(data);
    return data;
  }

  async signIn(email, password) {
    const data = await this._fetch('/auth/v1/token?grant_type=password', {
      method: 'POST',
      body: { email, password }
    });
    this.token = data?.access_token;
    if (data?.access_token) this._persistSession(data);
    return data;
  }

  async signOut() {
    await this._fetch('/auth/v1/logout', { method: 'POST' }).catch(() => {});
    this.token = null;
    localStorage.removeItem('clinica_session');
  }

  async getUser() {
    if (!this.token) return null;
    return this._fetch('/auth/v1/user');
  }

  _persistSession(data) {
    localStorage.setItem('clinica_session', JSON.stringify({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Date.now() + (data.expires_in * 1000)
    }));
  }

  async restoreSession() {
    const raw = localStorage.getItem('clinica_session');
    if (!raw) return false;
    try {
      const s = JSON.parse(raw);
      if (Date.now() < s.expires_at - 60000) {
        this.token = s.access_token;
        return true;
      }
      // Refresh
      const data = await this._fetch('/auth/v1/token?grant_type=refresh_token', {
        method: 'POST',
        body: { refresh_token: s.refresh_token }
      });
      this.token = data.access_token;
      this._persistSession(data);
      return true;
    } catch {
      localStorage.removeItem('clinica_session');
      return false;
    }
  }

  // Database helpers
  from(table) {
    return new QueryBuilder(this, table);
  }
}

class QueryBuilder {
  constructor(client, table) {
    this.client = client;
    this.table = table;
    this._filters = [];
    this._select = '*';
    this._order = null;
    this._limit = null;
    this._single = false;
    this._prefer = '';
  }

  select(cols = '*') { this._select = cols; return this; }
  order(col, { ascending = true } = {}) { this._order = `${col}.${ascending ? 'asc' : 'desc'}`; return this; }
  limit(n) { this._limit = n; return this; }
  single() { this._single = true; return this; }

  eq(col, val) { this._filters.push(`${col}=eq.${val}`); return this; }
  neq(col, val) { this._filters.push(`${col}=neq.${val}`); return this; }
  gte(col, val) { this._filters.push(`${col}=gte.${val}`); return this; }
  lte(col, val) { this._filters.push(`${col}=lte.${val}`); return this; }
  is(col, val) { this._filters.push(`${col}=is.${val}`); return this; }
  in(col, vals) { this._filters.push(`${col}=in.(${vals.join(',')})`); return this; }

  _buildUrl() {
    let url = `/rest/v1/${this.table}?select=${this._select}`;
    this._filters.forEach(f => url += `&${f}`);
    if (this._order) url += `&order=${this._order}`;
    if (this._limit) url += `&limit=${this._limit}`;
    return url;
  }

  async get() {
    const headers = this._single ? { 'Accept': 'application/vnd.pgrst.object+json' } : {};
    const data = await this.client._fetch(this._buildUrl(), { headers });
    return { data, error: null };
  }

  async insert(body) {
    const data = await this.client._fetch(`/rest/v1/${this.table}`, {
      method: 'POST',
      prefer: 'return=representation',
      body: Array.isArray(body) ? body : [body]
    });
    return { data: Array.isArray(data) ? data[0] : data, error: null };
  }

  async update(body) {
    const data = await this.client._fetch(this._buildUrl().replace(`?select=${this._select}`, ''), {
      method: 'PATCH',
      prefer: 'return=representation',
      body
    });
    return { data, error: null };
  }

  async delete() {
    await this.client._fetch(this._buildUrl().replace(`?select=${this._select}`, ''), {
      method: 'DELETE'
    });
    return { error: null };
  }
}

export const supabase = new SupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY);
