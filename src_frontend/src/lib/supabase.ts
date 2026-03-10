import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://kmbmfzehpjjctvuagecd.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_efKKoj9G57qulY6lW5A6Tg_86KNYuF9'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)