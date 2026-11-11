import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const configured = !!url && !!key && !url.includes('<');

export const supabase = createClient(configured ? url : 'http://localhost:54321', configured ? key : 'missing', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  realtime: { params: { eventsPerSecond: 5 } },
});

export const SUPABASE_URL = url;
