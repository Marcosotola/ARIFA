"use client";
import { useState } from "react";
import Link from "next/link";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

export default function ContactoPage() {
  const [form, setForm] = useState({
    nombre: "", empresa: "", telefono: "", email: "", servicio: "", mensaje: ""
  });
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!db || Object.keys(db).length === 0) {
      alert("La base de datos no está configurada. Por favor, completa tu archivo .env.local para que esta función esté operativa.");
      return;
    }
    setLoading(true);

    try {
      // Save to Firestore
      await addDoc(collection(db, "consultas"), {
        ...form,
        fecha: serverTimestamp(),
        estado: "nueva",
        tipo: form.servicio.includes("Presupuesto") || form.servicio === "" ? "presupuesto" : "consulta"
      });

      // Optional: Build WhatsApp message as well
      const msg = encodeURIComponent(
        `Hola ARIFA! He enviado una consulta desde la web.\n\n` +
        `*Nombre:* ${form.nombre}\n` +
        `*Empresa:* ${form.empresa}\n` +
        `*Servicio:* ${form.servicio}\n` +
        `*Mensaje:* ${form.mensaje}`
      );
      
      setSent(true);
      // window.open(`https://wa.me/5493512449504?text=${msg}`, '_blank');
    } catch (error) {
      console.error("Error saving to Firestore:", error);
      alert("Hubo un error al enviar tu consulta. Por favor, intenta de nuevo o contáctanos por WhatsApp.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="page-banner" style={{ background: "linear-gradient(rgba(0,10,30,0.8), rgba(0,10,30,0.8)), url('/banner_contacto.png') center/cover no-repeat" }}>
        <div className="container">
          <h1>Contacto</h1>
          <div className="breadcrumb">
            <Link href="/">Inicio</Link>
            <span className="breadcrumb-sep">/</span>
            <span>Contacto</span>
          </div>
        </div>
      </div>

      <section className="section-padding">
        <div className="container contact-grid">
          {/* Info */}
          <div className="contact-info">
            <h2>Datos de Contacto</h2>
            <div className="section-bar" style={{margin:'12px 0 20px'}}></div>
            <p>
              Contactanos por cualquiera de los medios disponibles. Un asesor comercial
              se pondrá en contacto con vos a la brevedad.
            </p>

            <div className="contact-item">
              <div className="contact-item-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
              </div>
              <div className="contact-item-text">
                <strong>Dirección</strong>
                <span>Córdoba Capital, Argentina</span>
              </div>
            </div>

            <div className="contact-item">
              <div className="contact-item-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.8a19.79 19.79 0 01-3.07-8.67A2 2 0 012 0h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 14z"/></svg>
              </div>
              <div className="contact-item-text">
                <strong>Teléfonos</strong>
                <span>
                  Lic. Perez Ariel: <a href="tel:+5493512449504">+54 9 351 244-9504</a><br/>
                  Lic. Pedraza F.: <a href="tel:+5493512794498">+54 9 351 279-4498</a>
                </span>
              </div>
            </div>

            <div className="contact-item">
              <div className="contact-item-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
              </div>
              <div className="contact-item-text">
                <strong>E-mail</strong>
                <a href="mailto:arifa.seguridadcontraincendios@gmail.com">
                  arifa.seguridadcontraincendios@gmail.com
                </a>
              </div>
            </div>

            <div className="contact-item">
              <div className="contact-item-icon" style={{background:'#25D366'}}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              </div>
              <div className="contact-item-text">
                <strong>WhatsApp</strong>
                <a href="https://wa.me/5493512449504" target="_blank" rel="noopener noreferrer">
                  +54 9 351 244-9504
                </a>
              </div>
            </div>

            <div className="horario-box">
              <h3>Horario de Atención</h3>
              <p>Lunes a Viernes: 8:00 a 17:00 hs.</p>
              <p>Sábados: 9:00 a 13:00 hs.</p>
            </div>
          </div>

          {/* Form */}
          <div className="contact-form">
            {!sent ? (
              <>
                <h2>Envianos tu Consulta</h2>
                <p>Completá el formulario y te respondemos a la brevedad. Muchas gracias.</p>
                <form onSubmit={handleSubmit}>
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="nombre">Nombre y Apellido *</label>
                      <input id="nombre" name="nombre" type="text" required value={form.nombre} onChange={handleChange} placeholder="Tu nombre completo" />
                    </div>
                    <div className="form-group">
                      <label htmlFor="empresa">Empresa</label>
                      <input id="empresa" name="empresa" type="text" value={form.empresa} onChange={handleChange} placeholder="Nombre de tu empresa" />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="telefono">Teléfono *</label>
                      <input id="telefono" name="telefono" type="tel" required value={form.telefono} onChange={handleChange} placeholder="Tu número de teléfono" />
                    </div>
                    <div className="form-group">
                      <label htmlFor="email">E-mail *</label>
                      <input id="email" name="email" type="email" required value={form.email} onChange={handleChange} placeholder="tu@email.com" />
                    </div>
                  </div>
                  <div className="form-group">
                    <label htmlFor="servicio">Servicio de Interés</label>
                    <select id="servicio" name="servicio" value={form.servicio} onChange={handleChange}>
                      <option value="">Seleccioná un servicio...</option>
                      <option>Seguridad e Higiene Laboral</option>
                      <option>Mantenimiento de Matafuegos</option>
                      <option>Protección Contra Incendios</option>
                      <option>Instalaciones Fijas Contra Incendio</option>
                      <option>Capacitaciones</option>
                      <option>Planes de Evacuación</option>
                      <option>Cálculo de Carga de Fuego</option>
                      <option>Auditorías e Inspecciones</option>
                      <option>Planimetrías de Seguridad</option>
                      <option>Otro</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label htmlFor="mensaje">Mensaje *</label>
                    <textarea id="mensaje" name="mensaje" required value={form.mensaje} onChange={handleChange} placeholder="Describí tu consulta o necesidad..." />
                  </div>
                  <button type="submit" className="btn-red form-submit" disabled={loading}>
                    {loading ? "Enviando..." : "Enviar Consulta / Pedir Cotización"}
                  </button>
                </form>
              </>
            ) : (
              <div style={{textAlign:'center', padding:'40px 0'}}>
                <div style={{fontSize:'3rem', marginBottom:'20px'}}>✅</div>
                <h2 style={{color:'var(--primary-blue)', marginBottom:'12px'}}>¡Gracias por tu consulta!</h2>
                <p style={{color:'var(--text-muted)', marginBottom:'25px'}}>
                  Se abrió WhatsApp con tu mensaje. Un asesor te responderá a la brevedad.
                </p>
                <button className="btn-red" onClick={() => setSent(false)}>
                  Enviar otra consulta
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Map placeholder */}
      <div style={{background:'var(--bg-light)', padding:'20px 0'}}>
        <div className="container">
          <div style={{background:'#ccc', height:'350px', borderRadius:'4px', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:'15px'}}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="1.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
            <p style={{color:'#666', fontWeight:600}}>Córdoba Capital, Argentina</p>
            <a
              href="https://www.google.com/maps/search/Córdoba+Capital+Argentina"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-blue"
              style={{fontSize:'0.85rem'}}
            >
              Ver en Google Maps
            </a>
          </div>
        </div>
      </div>
    </>
  );
}
