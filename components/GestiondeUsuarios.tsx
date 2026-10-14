"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '../app/supabase';

interface GestionUsuariosProps {
  darkMode: boolean;
  theme: {
    card: string;
    border: string;
    innerBox: string;
    text: string;
    subtext: string;
  };
  isMobile: boolean;
}

// 🔥 ACTUALIZADO: Se agregó la sección de Pedidos Web al panel de permisos
const SECCIONES_SISTEMA = [
  { id: 'inicio', label: '📊 Inicio / Dashboard' },
  { id: 'stock', label: '📦 Gestión de Stock' },
  { id: 'ventas', label: '🛒 Ventas Minoristas Mostrador' },
  { id: 'ventas_mayoristas', label: '🏢 Ventas Mayoristas Gremio' },
  { id: 'pedidos_web', label: '🌐 Pedidos Web' },
  { id: 'caja', label: '🏦 Cierre de Caja y Auditoría' },
  { id: 'portada_web', label: '🖼️ Control de la Portada Web' }
];

export default function GestionUsuarios({ darkMode, theme, isMobile }: GestionUsuariosProps) {
  const [listaUsuarios, setListaUsuarios] = useState<any[]>([]);
  const [nuevoUsuario, setNuevoUsuario] = useState({ username: '', password: '', nombre: '' });
  const [permisosSeleccionados, setPermisosSeleccionados] = useState<string[]>(['inicio']);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    cargarUsuarios();
  }, []);

  const cargarUsuarios = async () => {
    setCargando(true);
    const { data, error } = await supabase.from('usuarios_sistema').select('*');
    if (!error && data) setListaUsuarios(data);
    setCargando(false);
  };

  const manejarCrearUsuario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoUsuario.username || !nuevoUsuario.password || !nuevoUsuario.nombre) {
      return alert("Por favor, completa todos los campos del empleado.");
    }

    try {
      const payload = {
        username: nuevoUsuario.username.trim().toLowerCase(),
        password: nuevoUsuario.password.trim(),
        nombre: nuevoUsuario.nombre.trim(),
        permisos: permisosSeleccionados
      };

      const { error } = await supabase.from('usuarios_sistema').insert([payload]);
      
      if (error) {
        if (error.code === '23505') return alert("⚠️ El nombre de usuario ya existe.");
        throw error;
      }

      alert(`🎉 Usuario "${payload.nombre}" creado con éxito.`);
      setNuevoUsuario({ username: '', password: '', nombre: '' });
      setPermisosSeleccionados(['inicio']);
      await cargarUsuarios();
    } catch (err: any) {
      alert("Error al registrar: " + err.message);
    }
  };

  const eliminarUsuario = async (username: string) => {
    if (username === 'admin') return alert("No se puede eliminar el perfil maestro.");
    if (!window.confirm(`¿Seguro que deseas dar de baja al usuario ${username}?`)) return;

    const { error } = await supabase.from('usuarios_sistema').delete().eq('username', username);
    if (!error) {
      setListaUsuarios(listaUsuarios.filter(u => u.username !== username));
    }
  };

  const togglePermisoCheckbox = (id: string) => {
    if (permisosSeleccionados.includes(id)) {
      setPermisosSeleccionados(permisosSeleccionados.filter(p => p !== id));
    } else {
      setPermisosSeleccionados([...permisosSeleccionados, id]);
    }
  };

  const inputStyle: React.CSSProperties = {
    padding: '12px',
    borderRadius: '10px',
    border: `1px solid ${theme.border}`,
    backgroundColor: theme.innerBox,
    color: theme.text,
    outline: 'none',
    fontSize: '15px',
    width: '100%'
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
      <div>
        <h2 style={{ margin: 0, fontWeight: '900', color: theme.text }}>👥 Panel de Configuración de Usuarios</h2>
        <p style={{ margin: '4px 0 0 0', color: theme.subtext }}>Alta de credenciales y segmentación granular de accesos para empleados</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '25px', alignItems: 'flex-start' }}>
        
        {/* FORMULARIO DE ALTA */}
        <div style={{ backgroundColor: theme.card, padding: '25px', borderRadius: '20px', border: `1px solid ${theme.border}` }}>
          <h3 style={{ margin: '0 0 20px 0', color: '#8b5cf6', fontWeight: '800' }}>➕ Crear Nuevo Usuario</h3>
          <form onSubmit={manejarCrearUsuario} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <input type="text" placeholder="Nombre completo del Empleado (Ej: Juan Pérez)" required value={nuevoUsuario.nombre} onChange={e => setNuevoUsuario({ ...nuevoUsuario, nombre: e.target.value })} style={inputStyle} />
            <input type="text" placeholder="ID / Nombre de Usuario (Ej: vendedor1)" required value={nuevoUsuario.username} onChange={e => setNuevoUsuario({ ...nuevoUsuario, username: e.target.value })} style={inputStyle} />
            <input type="text" placeholder="Contraseña de Acceso Directo" required value={nuevoUsuario.password} onChange={e => setNuevoUsuario({ ...nuevoUsuario, password: e.target.value })} style={inputStyle} />
            
            <div style={{ marginTop: '10px' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: theme.subtext, display: 'block', marginBottom: '10px' }}>ASIGNAR PERMISOS DE SECCIÓN:</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {SECCIONES_SISTEMA.map((sec) => (
                  <label key={sec.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.95rem', cursor: 'pointer', color: theme.text }}>
                    <input 
                      type="checkbox" 
                      checked={permisosSeleccionados.includes(sec.id)} 
                      onChange={() => togglePermisoCheckbox(sec.id)}
                      style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                    {sec.label}
                  </label>
                ))}
              </div>
            </div>

            <button type="submit" style={{ backgroundColor: '#8b5cf6', color: '#fff', border: 'none', padding: '12px', borderRadius: '10px', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer', marginTop: '15px' }}>
              💾 DAR DE ALTA EMPLEADO
            </button>
          </form>
        </div>

        {/* LISTADO DE USUARIOS ACTIVOS */}
        <div style={{ backgroundColor: theme.card, padding: '25px', borderRadius: '20px', border: `1px solid ${theme.border}`, display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <h3 style={{ margin: '0 0 10px 0', color: theme.text, fontWeight: '800' }}>📋 Usuarios con Acceso Registrado</h3>
          
          {cargando ? (
            <p style={{ color: theme.subtext, textAlign: 'center' }}>⏳ Cargando empleados...</p>
          ) : listaUsuarios.filter(u => u.username !== 'admin').length === 0 ? (
            <p style={{ color: theme.subtext, textAlign: 'center', padding: '20px' }}>No hay empleados registrados todavía.</p>
          ) : (
            listaUsuarios.filter(u => u.username !== 'admin').map((u) => (
              <div key={u.username} style={{ backgroundColor: theme.innerBox, padding: '15px', borderRadius: '12px', border: `1px solid ${theme.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 'bold', fontSize: '1.05rem', color: theme.text }}>{u.nombre} <span style={{ color: '#8b5cf6', fontSize: '0.85rem' }}>({u.username})</span></div>
                  <div style={{ fontSize: '0.85rem', color: theme.subtext, marginTop: '4px' }}>Clave: <code>{u.password}</code></div>
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '8px' }}>
                    {(Array.isArray(u.permisos) ? u.permisos : JSON.parse(u.permisos || '[]')).map((p: string) => (
                      <span key={p} style={{ backgroundColor: darkMode ? '#334155' : '#e2e8f0', color: theme.text, fontSize: '0.72rem', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                        {p === 'ventas' ? 'VENTAS MIN' : p === 'ventas_mayoristas' ? 'VENTAS MAY' : p === 'pedidos_web' ? 'PEDIDOS WEB' : p === 'portada_web' ? 'PORTADA WEB' : p === 'caja' ? 'CIERRE CAJA' : p.toUpperCase()}
                      </span>
                    ))}
                  </div>
                </div>
                <button 
                  onClick={() => eliminarUsuario(u.username)}
                  style={{ backgroundColor: 'transparent', border: '1px solid #ef4444', color: '#ef4444', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}
                >
                  🗑️ Quitar
                </button>
              </div>
            ))
          )}
        </div>

      </div>
    </div>
  );
}