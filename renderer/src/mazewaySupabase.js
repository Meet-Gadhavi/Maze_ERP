import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://uzmxrijlntgmbqqqhsbl.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV6bXhyaWpsbnRnbWJxcXFoc2JsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0Njg3MTksImV4cCI6MjA5MzA0NDcxOX0.e3dLNyLY5OXlTmqMcM-5f3ObL4GxsccSU0FpvHeQCpM';

export const mazewaySupabase = createClient(supabaseUrl, supabaseAnonKey);
