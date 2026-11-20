import { createClient } from '@supabase/supabase-js';

/**
 * Cliente unico de Supabase para todo el sistema de gestion.
 *
 * Lee las variables de entorno, pero trae los valores por defecto para que el
 * proyecto funcione apenas se clone el repo (sin tener que configurar nada).
 * Si preferís usar variables, copiá .env.example a .env.local.
 */
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || '';

const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  '';

// Fallo temprano y con un mensaje entendible en vez del error crudo de
// Supabase ("supabaseUrl is required"), que rompia el build entero.
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Faltan las variables de Supabase. Copiá .env.example a .env.local y completá ' +
      'NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);