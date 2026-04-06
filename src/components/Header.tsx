"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";

// NAV DATA - espejos de Maxi Seguridad adaptado a ARIFA
const NAV_ITEMS = [
  { label: "Inicio", href: "/" },
  {
    label: "La Empresa",
    href: "/la-empresa",
    children: [
      { label: "Nosotros", href: "/nosotros" },
      { label: "Habilitaciones y Certificaciones", href: "/certificaciones" },
      { label: "Clientes", href: "/clientes" },
      { label: "Código de Ética", href: "/etica" },
      { label: "Trabajá con Nosotros", href: "/trabaja-con-nosotros" },
    ],
  },
  { label: "Normativas", href: "/normativas" },
  {
    label: "Servicios",
    href: "/servicios",
    mega: true,
    groups: [
      {
        title: "Seguridad e Higiene",
        links: [
          { label: "Análisis y Evaluación de Riesgos", href: "/servicios/analisis-de-riesgos" },
          { label: "Capacitación al Personal", href: "/servicios/capacitacion-personal" },
          { label: "Investigación de Siniestros", href: "/servicios/investigacion-siniestros" },
          { label: "Medición de Contaminantes", href: "/servicios/medicion-contaminantes" },
        ],
      },
      {
        title: "Protección Contra Incendios",
        links: [
          { label: "Mantenimiento de Matafuegos", href: "/servicios/matafuegos" },
          { label: "Instalaciones Fijas Contra Incendio", href: "/servicios/instalaciones-fijas" },
          { label: "Detección y Alarma de Incendio", href: "/servicios/deteccion-alarma" },
          { label: "Sistemas de Espuma y Gases", href: "/servicios/sistemas-espuma-gases" },
        ],
      },
      {
        title: "Capacitaciones y Documentación",
        links: [
          { label: "Planes de Evacuación", href: "/servicios/planes-evacuacion" },
          { label: "Cálculo de Carga de Fuego", href: "/servicios/carga-de-fuego" },
          { label: "Auditorías Contra Incendios", href: "/servicios/auditorias" },
          { label: "Planimetrías de Seguridad", href: "/servicios/planimetrias" },
        ],
      },
    ],
  },
  {
    label: "Catálogo",
    href: "/catalogo",
    mega: true,
    groups: [
      {
        title: "Seguridad y Extinción",
        links: [
          { label: "Matafuegos", href: "/catalogo/matafuegos" },
          { label: "Detectores y Alarmas", href: "/catalogo/detectores-alarmas" },
          { label: "Rociadores y Sprinklers", href: "/catalogo/rociadores-sprinklers" },
          { label: "Mangueras y Accesorios", href: "/catalogo/mangueras-accesorios" },
        ],
      },
      {
        title: "Protección y Primeros Auxilios",
        links: [
          { label: "Equipos de Protección Personal", href: "/catalogo/equipos-proteccion-personal" },
          { label: "Botiquines", href: "/catalogo/botiquines-primeros-auxilios" },
          { label: "Iluminación de Emergencia", href: "/catalogo/iluminacion-emergencia" },
          { label: "Señalización", href: "/catalogo/senalizacion" },
        ],
      },
    ],
  },
  { label: "Contacto", href: "/contacto" },
];

function NavDropdown({ item }: { item: typeof NAV_ITEMS[0] }) {
  const pathname = usePathname();
  const isActive =
    pathname === item.href ||
    (item.children && item.children.some((c) => pathname === c.href)) ||
    (item.groups && item.groups.some((g) => g.links.some((l) => pathname === l.href)));

  if (item.mega && item.groups) {
    return (
      <li>
        <Link href={item.href!} className={isActive ? "active" : ""}>
          {item.label} <span className="nav-arrow" />
        </Link>
        <div className="mega-dropdown">
          <div className="mega-grid">
            {item.groups.map((g) => (
              <div key={g.title} className="mega-group">
                <div className="mega-group-title">{g.title}</div>
                {g.links.map((l) => (
                  <Link key={l.href} href={l.href}>{l.label}</Link>
                ))}
              </div>
            ))}
          </div>
        </div>
      </li>
    );
  }
  if (item.children) {
    return (
      <li>
        <Link href={item.href!} className={isActive ? "active" : ""}>
          {item.label} <span className="nav-arrow" />
        </Link>
        <div className="dropdown">
          {item.children.map((c) => (
            <Link key={c.href} href={c.href}>{c.label}</Link>
          ))}
        </div>
      </li>
    );
  }
  return (
    <li>
      <Link href={item.href!} className={pathname === item.href ? "active" : ""}>
        {item.label}
      </Link>
    </li>
  );
}

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [expandedMobile, setExpandedMobile] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsub();
  }, []);

  useEffect(() => { setMenuOpen(false); setExpandedMobile(null); }, [pathname]);

  return (
    <>
      {/* TOP BAR */}
      <div className="top-bar">
        <div className="container top-bar-inner">
          <div className="top-bar-left">
            <a href="https://wa.me/5493512449504" target="_blank" rel="noopener noreferrer" aria-label="WhatsApp">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            </a>
            <a href="https://www.facebook.com/share/1EEpG3myYc/" target="_blank" rel="noopener noreferrer" aria-label="Facebook">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z"/></svg>
            </a>
            <a href="https://www.instagram.com/arifacba" target="_blank" rel="noopener noreferrer" aria-label="Instagram">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
            </a>
          </div>
          <div className="top-bar-right">
            <div className="top-contact-item">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{color:'#D32F2F'}}><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.8a19.79 19.79 0 01-3.07-8.67A2 2 0 012 0h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 14z"/></svg>
              <a href="tel:+5493512449504">+54 9 351 244-9504</a>
            </div>
            <div className="top-contact-item">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{color:'#D32F2F'}}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
              <a href="mailto:arifa.seguridadcontraincendios@gmail.com">arifa.seguridadcontraincendios@gmail.com</a>
            </div>
          </div>
        </div>
      </div>

      {/* MAIN HEADER */}
      <header className="main-header">
        <div className="container header-inner">
          <Link href="/" className="logo-link">
            <img 
              src="/logos/logoFondoTransparente.svg" 
              alt="ARIFA Logo" 
              className="main-logo"
            />
          </Link>

          <nav className="main-nav">
            <ul className="nav-list">
              {NAV_ITEMS.map((item) => (
                <NavDropdown key={item.href || item.label} item={item} />
              ))}
            </ul>
          </nav>

          <a href="tel:+5493512449504" className="header-phone">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{color:'#D32F2F'}}><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.8a19.79 19.79 0 01-3.07-8.67A2 2 0 012 0h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 14z"/></svg>
            351 244-9504
          </a>

          <Link href={user ? "/admin" : "/login"} className="header-cta" style={{ background: "var(--primary-blue)", color: "#fff", borderColor: "var(--primary-blue)" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            <span className="cta-text">{user ? "Mi Cuenta" : "Ingresar"}</span>
          </Link>

          <button
            className="hamburger"
            aria-label="Abrir menú"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <span style={menuOpen ? {transform:'rotate(45deg) translate(5px, 5px)'} : undefined}></span>
            <span style={menuOpen ? {opacity:0} : undefined}></span>
            <span style={menuOpen ? {transform:'rotate(-45deg) translate(5px,-5px)'} : undefined}></span>
          </button>
        </div>

        {/* MOBILE MENU */}
        <div className={`mobile-menu${menuOpen ? ' open' : ''}`}>
          {NAV_ITEMS.map((item) => {
            const hasChildren = item.children || item.groups;
            const links = item.children || (item.groups ? item.groups.flatMap(g => g.links) : []);
            return (
              <div key={item.href || item.label} className="mobile-nav-item">
                {hasChildren ? (
                  <>
                    <a
                      href="#"
                      onClick={(e) => { e.preventDefault(); setExpandedMobile(expandedMobile === item.label ? null : item.label); }}
                    >
                      {item.label} {expandedMobile === item.label ? '▲' : '▼'}
                    </a>
                    {expandedMobile === item.label && (
                      <div className="mobile-nav-group">
                        {links.map((c) => (
                          <Link key={c.href} href={c.href}>{c.label}</Link>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <Link href={item.href!}>{item.label}</Link>
                )}
              </div>
            );
          })}
          <div style={{padding:'15px 0'}}>
            <Link href={user ? "/admin" : "/login"} className="btn-blue" style={{display:'block', textAlign:'center'}}>
              {user ? "Mi Cuenta" : "Ingresar"}
            </Link>
          </div>
        </div>
      </header>
    </>
  );
}
