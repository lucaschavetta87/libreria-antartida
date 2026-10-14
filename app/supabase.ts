/**
 * Reexporta el cliente unico de Supabase.
 *
 * Antes este archivo tenia sus propias credenciales hardcodeadas, distinto de
 * lib/supabase.ts. Eso hacia que hubiera dos fuentes de verdad y que el build
 * fallara si falta una sola variable de entorno.
 *
 * Se mantiene el archivo porque varios componentes lo importan desde acá.
 */
export { supabase } from '../lib/supabase';