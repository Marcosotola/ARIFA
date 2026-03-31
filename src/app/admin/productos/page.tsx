"use client";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import Link from "next/link";
import { CATEGORIAS_PLACEHOLDER } from "@/lib/productos";

export default function AdminProductos() {
  const [productos, setProductos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProds = async () => {
      try {
        const q = query(collection(db, "productos"), orderBy("creadoEn", "desc"));
        const snapshot = await getDocs(q);
        setProductos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (e) {
        console.error("Error fetching products:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchProds();
  }, []);

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', flexWrap: 'wrap', gap: '20px' }}>
        <div>
          <h1 style={{ fontSize: "1.8rem", fontWeight: 800, color: "var(--primary-blue)" }}>Gestión de Productos</h1>
          <p style={{ color: "var(--text-muted)", fontSize: '0.9rem' }}>Administra el catálogo online de ARIFA.</p>
        </div>
        <button className="btn-red" style={{ padding: '10px 20px', fontSize: '0.85rem' }}>+ Nuevo Producto</button>
      </header>

      <div style={{ background: '#fff', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.04)', overflow: 'hidden', border: '1px solid #eee' }}>
        <div className="filter-row" style={{ padding: '15px 20px', borderBottom: '1px solid #f0f0f0', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <input 
            type="text" 
            placeholder="Buscar productos..." 
            style={{ flex: '1', minWidth: '200px', padding: '10px 15px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '0.9rem' }}
          />
          <select style={{ flex: '1', minWidth: '150px', padding: '10px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '0.9rem', color: '#666' }}>
            <option>Categorías</option>
            {CATEGORIAS_PLACEHOLDER.map(c => <option key={c.id}>{c.nombre}</option>)}
          </select>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ background: '#fafafa', borderBottom: '1.5px solid #eee' }}>
              <tr>
                <th style={{ textAlign: 'left', padding: '15px 20px', fontSize: '0.70rem', color: '#999', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Producto</th>
                <th style={{ textAlign: 'left', padding: '15px 20px', fontSize: '0.70rem', color: '#999', textTransform: 'uppercase', letterSpacing: '0.5px' }} className="hide-mobile">Categoría</th>
                <th style={{ textAlign: 'left', padding: '15px 20px', fontSize: '0.70rem', color: '#999', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Estado</th>
                <th style={{ textAlign: 'right', padding: '15px 20px', fontSize: '0.70rem', color: '#999', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {productos.length > 0 ? productos.map((p) => (
                <tr key={p.id} style={{ borderBottom: '1px solid #f8f8f8' }}>
                  <td style={{ padding: '15px 20px' }}>
                    <div style={{ fontWeight: 700, color: 'var(--primary-blue)', fontSize: '0.88rem' }}>{p.nombre}</div>
                    <div style={{ fontSize: '0.7rem', color: '#aaa', marginTop: '2px' }}>{p.slug}</div>
                  </td>
                  <td style={{ padding: '15px 20px', fontSize: '0.8rem', color: '#666' }} className="hide-mobile">
                    {CATEGORIAS_PLACEHOLDER.find(c => c.id === p.categoriaId)?.nombre || '---'}
                  </td>
                  <td style={{ padding: '15px 20px' }}>
                    <span style={{ fontSize: '0.62rem', fontWeight: 900, padding: '3px 8px', borderRadius: '4px', background: p.destacado ? '#fff3e0' : '#e8f5e9', color: p.destacado ? '#ef6c00' : '#2e7d32', textTransform: 'uppercase' }}>
                      {p.destacado ? 'Dest.' : 'Act'}
                    </span>
                  </td>
                  <td style={{ padding: '15px 20px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', padding: '5px' }} title="Editar">📝</button>
                    <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', padding: '5px', marginLeft: '5px' }} title="Eliminar">🗑️</button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={4} style={{ padding: '80px 20px', textAlign: 'center', color: '#bbb' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '15px' }}>📦</div>
                    {loading ? 'Sincronizando...' : 'Catálogo vacío.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <style jsx>{`
        @media (max-width: 600px) {
          .hide-mobile { display: none !important; }
        }
      `}</style>
    </div>
  );
}
