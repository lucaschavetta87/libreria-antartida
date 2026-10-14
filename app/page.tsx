"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "./supabase";
import Navbar from "../components/Navbar";
import DashboardInicio from "../components/DashboardInicio"; 
import Stock from "../components/GestionStock";
import Ventas from "../components/Ventas";
import VentasMayoristas from "../components/VentasMayoristas"; 
import ClientesCC from "../components/ClientesCC";
import CierreCaja from "../components/CierreCaja";
import GestionUsuarios from "../components/GestiondeUsuarios"; 
import PedidosWeb from "../components/PedidosWeb";
import GestionPortada from "../components/GestionPortada";

// Tipos
interface StockItem { id: number; nombre: string; cantidad: number; [key: string]: any; }
interface Venta { id: number; fecha?: string | null; total?: number | string | null; metodo_pago?: string | null; descuento?: number | string | null; items?: any; [key: string]: any; }

type TabKey = "inicio" | "stock" | "ventas" | "ventas_mayoristas" | "pedidos_web" | "clientes" | "caja" | "usuarios" | "pagina_web" | "portada_web";

const APP_TITLE = "Pueblos del Mundo";

const buildTheme = (darkMode: boolean) => ({
  bg: darkMode ? "#0f172a" : "#F9FAFB",
  card: darkMode ? "#1e293b" : "#FFFFFF",
  text: darkMode ? "#f8fafc" : "#111827",
  subtext: darkMode ? "#94a3b8" : "#6B7280",
  border: darkMode ? "#334155" : "#e2e8f0",
  innerBox: darkMode ? "#0f172a" : "#f1f5f9", 
  shadow: "0 10px 15px -3px rgba(0, 0, 0, 0.04), 0 4px 6px -2px rgba(0, 0, 0, 0.02)"
});

export const dynamic = "force-dynamic";

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [usuarioActivo, setUsuarioActivo] = useState<any | null>(null); 
  const [darkMode, setDarkMode] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("inicio");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [ventas, setVentas] = useState<Venta[]>([]);
  interface Orden { id: number; fecha?: string | null; total?: number | string | null; estado?: string | null; [key: string]: any }
  const [ordenes, setOrdenes] = useState<Orden[]>([]);
  const [stock, setStock] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const theme = buildTheme(darkMode);

  useEffect(() => {
    const checkResponsiveness = () => {
      const mobileView = window.innerWidth <= 768;
      setIsMobile(mobileView);
      if (mobileView) setIsSidebarCollapsed(true);
    };
    checkResponsiveness();
    window.addEventListener("resize", checkResponsiveness);
    return () => window.removeEventListener("resize", checkResponsiveness);
  }, []);

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

    if ((userLow === "laindia" && passTrim === "laindia1234") || (userLow === "admin" && passTrim === "admin123")) {
      setUsuarioActivo({
        nombre: "Administrador",
        username: "admin",
        permisos: ["inicio", "stock", "ventas", "ventas_mayoristas", "pedidos_web", "clientes", "caja", "usuarios", "portada_web"]
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
        alert("Usuario o contraseña incorrectos");
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
      alert("Error al conectar con el servidor de autenticación");
    }
  };

  const tienePermiso = (tab: TabKey) => {
    if (!usuarioActivo) return false;
    if (usuarioActivo.username === "admin") return true; 
    return usuarioActivo.permisos.includes(tab);
  };

  if (!isAuthenticated) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: "#6366F1", display: "flex", justifyContent: "center", alignItems: "center", padding: "16px" }}>
        <form onSubmit={handleLogin} style={{ backgroundColor: "#FFFFFF", padding: isMobile ? "30px 20px" : "40px", borderRadius: "24px", width: "100%", maxWidth: "380px", textAlign: "center", boxShadow: "0 10px 25px rgba(0,0,0,0.1)" }}>
          <h1 style={{ fontWeight: 900, marginBottom: "24px", fontSize: isMobile ? "1.6rem" : "2rem", color: "#111827" }}>{APP_TITLE}</h1>
          <input type="text" placeholder="Usuario" onChange={(e) => setUser(e.target.value)} style={{ width: "100%", padding: "12px", marginBottom: "15px", borderRadius: "10px", border: "1px solid #E5E7EB", fontSize: "16px" }} />
          <input type="password" placeholder="Contraseña" onChange={(e) => setPass(e.target.value)} style={{ width: "100%", padding: "12px", marginBottom: "20px", borderRadius: "10px", border: "1px solid #E5E7EB", fontSize: "16px" }} />
          <button type="submit" style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "none", backgroundColor: "#6366F1", color: "#FFFFFF", cursor: "pointer", fontWeight: "bold", fontSize: "16px" }}>Entrar</button>
        </form>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", minHeight: "100vh", backgroundColor: theme.bg, color: theme.text }}>
      
      <Navbar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        darkMode={darkMode} 
        setDarkMode={setDarkMode} 
        isCollapsed={isSidebarCollapsed} 
        setIsCollapsed={setIsSidebarCollapsed}
        usuarioActivo={usuarioActivo}
      />

      <main style={{ flexGrow: 1, padding: isMobile ? "20px 16px" : "40px 52px", marginLeft: isMobile ? "0px" : (isSidebarCollapsed ? "90px" : "270px"), paddingTop: isMobile ? "90px" : "40px" }}>
        <div style={{ maxWidth: "1512px", margin: "0 auto", width: "100%" }}>
          
          {activeTab === "usuarios" && usuarioActivo?.username === "admin" && (
            <GestionUsuarios darkMode={darkMode} theme={theme} isMobile={isMobile} />
          )}

          {activeTab === "inicio" && tienePermiso("inicio") && (
            <DashboardInicio darkMode={darkMode} />
          )}

          {activeTab === "pagina_web" && (
            <div style={{ width: "100%", display: "flex", flexDirection: "column" }}>
              <iframe
                src="https://distribuidoraindiaweb.vercel.app/"
                title="Web Distribuidora India"
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

              {activeTab === "portada_web" && tienePermiso("portada_web") && (
                <GestionPortada darkMode={darkMode} theme={theme} isMobile={isMobile} />
              )}
              
            </div>
          )}
          
        </div>
      </main>
    </div>
  );
}