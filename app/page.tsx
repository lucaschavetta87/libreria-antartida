"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "./supabase";
import Navbar from "../components/Navbar";
import Topbar from "../components/Topbar";
import BarraInferior from "../components/BarraInferior";
import DashboardInicio from "../components/DashboardInicio"; 
import Stock from "../components/GestionStock";
import Ventas from "../components/Ventas";
import VentasMayoristas from "../components/VentasMayoristas"; 
import ClientesCC from "../components/ClientesCC";
import CierreCaja from "../components/CierreCaja";
import GestionUsuarios from "../components/GestiondeUsuarios"; 
import PedidosWeb from "../components/PedidosWeb";

import MercadoLibre from "../components/MercadoLibre";
import { paddingContenido } from "../lib/ui";
import { useToast } from "../components/ui/Avisos";
import { useTema } from "../components/ui/TemaGlobal";

// Tipos
interface StockItem { id: number; nombre: string; cantidad: number; [key: string]: any; }
interface Venta { id: number; fecha?: string | null; total?: number | string | null; metodo_pago?: string | null; descuento?: number | string | null; items?: any; [key: string]: any; }

type TabKey = "inicio" | "stock" | "ventas" | "ventas_mayoristas" | "pedidos_web" | "clientes" | "caja" | "usuarios" | "pagina_web" | "portada_web" | "mercadolibre";

const APP_TITLE = "Libreria - Antartida";

export const dynamic = "force-dynamic";

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [usuarioActivo, setUsuarioActivo] = useState<any | null>(null); 
  const [activeTab, setActiveTab] = useState<TabKey>("inicio");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [ventas, setVentas] = useState<Venta[]>([]);
  interface Orden { id: number; fecha?: string | null; total?: number | string | null; estado?: string | null; [key: string]: any }
  const [ordenes, setOrdenes] = useState<Orden[]>([]);
  const [stock, setStock] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Tema y responsive vienen del proveedor raíz (antes se duplicaban por archivo).
  const { darkMode, setDarkMode, theme, esMovil: isMobile, ancho, montado } = useTema();
  const toast = useToast();

  // La sidebar lateral y la barra inferior nunca coinciden: hasta 1024px va la
  // barra de abajo; desde 1025px en adelante, la sidebar de la izquierda.
  const esEscritorio = montado && ancho > 1024;

  // Pedidos que todavía no están resueltos: alimentan el badge de la barra.
  const pedidosPendientes = ordenes.filter(
    (o: any) => !['entregado', 'completado', 'cancelado'].includes(String(o.estado || '').toLowerCase())
  ).length;

  // En el celular la sidebar no se usa (la navegación vive en la barra inferior).
  useEffect(() => {
    if (isMobile) setIsSidebarCollapsed(true);
  }, [isMobile, setIsSidebarCollapsed]);

  useEffect(() => { if (isAuthenticated) cargarDatos(); }, [isAuthenticated]);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      
      const { data: dataProducts, error: errorProducts } = await supabase
        .from("stock")
        .select("*")
        .order("nombre", { ascending: true })
        .range(0, 9999);

      if (errorProducts) {
        console.error("Error al cargar stock desde Supabase:", errorProducts);
      } else if (dataProducts) {
        setStock(dataProducts);
      }

      const [oRes, vRes] = await Promise.all([
        supabase.from("ordenes").select("*").order("id", { ascending: false }),
        supabase.from("ventas").select("*").order("id", { ascending: false })
      ]);
      if (oRes.data) setOrdenes(oRes.data as Orden[]);
      if (vRes.data) setVentas(vRes.data as Venta[]);

    } catch (error) { 
      console.error("Error inesperado en cargarDatos:", error); 
    } finally { 
      setLoading(false); 
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const userLow = user.trim().toLowerCase();
    const passTrim = pass.trim();

    if ((userLow === "antartida" && passTrim === "antartida1234") || (userLow === "admin" && passTrim === "admin123")) {
      setUsuarioActivo({
        nombre: "Administrador",
        username: "admin",
        permisos: ["inicio", "stock", "ventas", "ventas_mayoristas", "pedidos_web", "clientes", "caja", "usuarios", "portada_web", "mercadolibre"]
      });
      setIsAuthenticated(true);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("usuarios_sistema")
        .select("*")
        .eq("username", userLow)
        .eq("password", passTrim)
        .single();

      if (error || !data) {
        toast.error("Usuario o contraseña incorrectos");
      } else {
        setUsuarioActivo({
          nombre: data.nombre,
          username: data.username,
          permisos: Array.isArray(data.permisos) ? data.permisos : JSON.parse(data.permisos || '["inicio"]')
        });
        setIsAuthenticated(true);
        setActiveTab("inicio");
      }
    } catch (err) {
      toast.error("Error al conectar con el servidor de autenticación");
    }
  };

  const tienePermiso = (tab: TabKey) => {
    if (!usuarioActivo) return false;
    if (usuarioActivo.username === "admin") return true; 
    return usuarioActivo.permisos.includes(tab);
  };

  if (!isAuthenticated) {
    return (
      <div style={{
        minHeight: "100dvh",
        width: "100%",
        background: darkMode
          ? "radial-gradient(1200px 600px at 50% -10%, #312e81 0%, #0f172a 60%)"
          : "radial-gradient(1200px 600px at 50% -10%, #e0e7ff 0%, #f1f5f9 60%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "16px",
        padding: isMobile ? "20px 16px" : "32px 24px"
      }}>
        <form
          onSubmit={handleLogin}
          style={{
            backgroundColor: theme.card,
            color: theme.text,
            border: `1px solid ${theme.border}`,
            borderRadius: "20px",
            padding: isMobile ? "28px 22px" : "38px 36px",
            width: "100%",
            maxWidth: "380px",
            margin: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "stretch",
            gap: "12px",
            boxShadow: theme.shadowCard
          }}
        >
          <div style={{ textAlign: "center", marginBottom: "6px" }}>
            <div style={{
              width: "56px", height: "56px", margin: "0 auto 14px", borderRadius: "16px",
              background: "linear-gradient(180deg, #4f46e5 0%, #6366f1 100%)",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: "26px"
            }}>🕉️</div>

            <h1 style={{ fontWeight: 800, margin: "0 0 4px", fontSize: isMobile ? "1.35rem" : "1.6rem", color: theme.text }}>{APP_TITLE}</h1>
            <p style={{ margin: 0, fontSize: "0.82rem", color: theme.subtext }}>Sistema de gestión</p>
          </div>

          <input
            type="text" placeholder="Usuario" autoComplete="username" aria-label="Usuario" value={user}
            onChange={(e) => setUser(e.target.value)}
            className="campo-alto"
            style={{ width: "100%" }}
          />
          <input
            type="password" placeholder="Contraseña" autoComplete="current-password" aria-label="Contraseña" value={pass}
            onChange={(e) => setPass(e.target.value)}
            className="campo-alto"
            style={{ width: "100%" }}
          />
          <button type="submit" style={{
            width: "100%", padding: "13px", borderRadius: "10px", border: "none", marginTop: "2px",
            background: "linear-gradient(180deg, #4f46e5 0%, #4338ca 100%)", color: "#FFFFFF",
            cursor: "pointer", fontWeight: 700, fontSize: "16px", minHeight: "48px"
          }}>Entrar</button>

          <div style={{ textAlign: "center", marginTop: "6px" }}>
            <button
              type="button"
              onClick={() => setDarkMode(!darkMode)}
              aria-label={darkMode ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
              style={{
                background: "transparent", border: `1px solid ${theme.border}`,
                borderRadius: "10px", padding: "9px 14px", color: theme.subtext, cursor: "pointer",
                fontSize: "0.8rem", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "7px"
              }}
            >
              {darkMode ? "☀️ Modo claro" : "🌙 Modo oscuro"}
            </button>
          </div>
        </form>

        <p style={{ margin: 0, fontSize: "0.75rem", color: darkMode ? "rgba(255,255,255,0.45)" : "#64748b", textAlign: "center" }}>
          Acceso interno · Libreria - Antartida
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", minHeight: "100vh", backgroundColor: theme.bg, color: theme.text }}>
      
      {esEscritorio && (
        <Navbar 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
          darkMode={darkMode} 
          setDarkMode={setDarkMode} 
          isCollapsed={isSidebarCollapsed} 
          setIsCollapsed={setIsSidebarCollapsed}
          usuarioActivo={usuarioActivo}
        />
      )}

      <Topbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
        isCollapsed={isSidebarCollapsed}
        esEscritorio={esEscritorio}
        usuarioActivo={usuarioActivo}
        pedidosPendientes={pedidosPendientes}
      />

      {/* Navegación del celular y la tablet. En escritorio la oculta el CSS
          y corre la sidebar lateral. */}
      <BarraInferior
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        darkMode={darkMode}
        usuarioActivo={usuarioActivo}
        pedidosPendientes={pedidosPendientes}
      />

      <main
        className="con-barra-inferior"
        style={{
        flexGrow: 1,
        minWidth: 0,
        ...paddingContenido(isMobile),
        // Deja lugar para la barra superior fija
        paddingTop: isMobile ? 76 : 82,
        marginLeft: esEscritorio ? (isSidebarCollapsed ? "76px" : "248px") : "0px",
        transition: "margin-left 0.25s ease, padding 0.2s ease"
      }}>
        <div style={{ maxWidth: "1512px", margin: "0 auto", width: "100%" }}>
          
          {activeTab === "usuarios" && usuarioActivo?.username === "admin" && (
            <GestionUsuarios darkMode={darkMode} theme={theme} isMobile={isMobile} />
          )}

          {activeTab === "inicio" && tienePermiso("inicio") && (
            <DashboardInicio darkMode={darkMode} onNavegar={(tab) => setActiveTab(tab as TabKey)} />
          )}

          {activeTab === "pagina_web" && (
            <div style={{ width: "100%", display: "flex", flexDirection: "column" }}>
              <iframe
                src="https://antartida.sistemasmendoza.com.ar"
                title="Librería Antártida"
                style={{
                  width: '100%',
                  height: isMobile ? 'calc(100vh - 90px)' : 'calc(100vh - 80px)',
                  border: 'none',
                  borderRadius: '16px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
                }}
                allow="clipboard-write; fullscreen"
              />
            </div>
          )}

          {activeTab !== "inicio" && activeTab !== "usuarios" && activeTab !== "pagina_web" && (
            <div style={{ width: "100%", display: "flex", flexDirection: "column" }}>
              
              {activeTab === "stock" && tienePermiso("stock") && (
                <Stock stock={stock} setStock={setStock} darkMode={darkMode} esAdmin={usuarioActivo?.username === "admin"} />
              )}
              
              {activeTab === "ventas" && tienePermiso("ventas") && (
                <Ventas stock={stock} setStock={setStock} ventas={ventas} setVentas={setVentas} darkMode={darkMode} />
              )}
              
              {activeTab === "ventas_mayoristas" && tienePermiso("ventas_mayoristas") && (
                <VentasMayoristas stock={stock} setStock={setStock} ventas={ventas} setVentas={setVentas} darkMode={darkMode} />
              )}
              
              {activeTab === "pedidos_web" && tienePermiso("pedidos_web") && (
                <PedidosWeb darkMode={darkMode} />
              )}
              
              {activeTab === "clientes" && tienePermiso("clientes") && (
                <ClientesCC darkMode={darkMode} />
              )}
              
              {activeTab === "caja" && tienePermiso("caja") && (
                <CierreCaja darkMode={darkMode} />
              )}

              {activeTab === "mercadolibre" && tienePermiso("mercadolibre") && (
                <MercadoLibre darkMode={darkMode} />
              )}
              
            </div>
          )}
          
        </div>
      </main>
    </div>
  );
}