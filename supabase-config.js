const SUPABASE_URL = "https://ezdwvsudtzhoyaiipxad.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_CFmSOoRNBNTb4-V-7N8lMw_IruRFufI";

const supabaseClient = supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
);
console.log("A1 Kitchen Supabase URL:", SUPABASE_URL);
console.log("A1 Kitchen Supabase client:", supabaseClient);
