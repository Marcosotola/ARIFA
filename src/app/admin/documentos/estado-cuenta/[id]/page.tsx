"use client";
import { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { db, auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { claveCliente, nombreCliente } from "@/lib/cuentaCorriente";

// Los estados de cuenta ya no son documentos cargados a mano: los links viejos (buscador, favoritos)
// llevan al estado de cuenta calculado del cliente.
export default function EstadoCuentaViejoRedirect() {
  const router = useRouter();
  const { id } = useParams() as { id: string };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { router.push("/login"); return; }
      try {
        const snap = await getDoc(doc(db, "estados-cuenta", id));
        if (snap.exists()) {
          const e = snap.data();
          const nombre = nombreCliente({ nombre: e.clienteNombre, apellido: e.clienteApellido, empresa: e.clienteEmpresa }) || "Sin nombre";
          router.replace(`/admin/documentos/estado-cuenta?c=${encodeURIComponent(claveCliente(e.clienteId, nombre))}`);
          return;
        }
      } catch (err) { console.error(err); }
      router.replace("/admin/documentos/estado-cuenta");
    });
    return () => unsub();
  }, [router, id]);

  return <div style={{ padding: "100px", textAlign: "center", color: "var(--text-muted)" }}>Abriendo estado de cuenta...</div>;
}
