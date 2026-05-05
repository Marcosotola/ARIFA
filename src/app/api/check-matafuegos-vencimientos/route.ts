import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/check-matafuegos-vencimientos
 *
 * Recorre todos los extintores en `matafuegos_activos` y genera
 * notificaciones automáticas en `notificaciones_enviadas` para:
 *   - admins / superadmins / secretarias  (siempre)
 *   - el cliente del equipo              (si tiene clienteId)
 *
 * Disparadores:
 *   1. Venc. Carga vencida  (< hoy)
 *   2. Venc. Carga próxima  (dentro de 30 días)
 *   3. Venc. PH vencida     (< hoy)
 *   4. Venc. PH próxima     (dentro de 30 días)
 *
 * Para evitar spam se revisa si ya existe una notificación del mismo tipo
 * para ese extintor en los últimos 25 días antes de crear una nueva.
 */

// ─── Lazy Admin SDK init (copied pattern from send-notification) ─────────────
let adminApp: any = null;
let _adminDb: any = null;
let _adminMessaging: any = null;

async function getAdmin() {
  if (_adminDb) return { db: _adminDb, messaging: _adminMessaging };

  const serviceAccountRaw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!serviceAccountRaw) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY not set");
  }

  const admin = await import("firebase-admin");

  if (!adminApp) {
    let serviceAccount: any;
    try {
      serviceAccount = JSON.parse(serviceAccountRaw);
    } catch {
      serviceAccount = JSON.parse(
        Buffer.from(serviceAccountRaw, "base64").toString("utf-8")
      );
    }
    if (admin.apps.length === 0) {
      adminApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      });
    } else {
      adminApp = admin.app();
    }
  }

  _adminDb = admin.firestore(adminApp);
  try { _adminMessaging = admin.messaging(adminApp); } catch { _adminMessaging = null; }

  return { db: _adminDb, messaging: _adminMessaging };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Returns YYYY-MM-DD of today */
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

/** Days between two Date objects (can be negative) */
function daysDiff(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

/**
 * Send FCM push to a single FCM token via Admin Messaging.
 * Silently swallows errors so one bad token doesn't abort the whole batch.
 */
async function pushFCM(
  messaging: any,
  token: string,
  title: string,
  body: string,
  actionUrl: string
) {
  if (!messaging || !token) return;
  try {
    await messaging.send({
      token,
      notification: { title, body },
      webpush: {
        notification: { icon: "/logos/192x192.png", badge: "/logos/favicon.png" },
        fcmOptions: { link: actionUrl },
      },
      data: { actionUrl },
    });
  } catch (e: any) {
    console.warn("[check-matafuegos] FCM send failed for token:", token, e?.code);
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function POST(_req: NextRequest) {
  try {
    const { db, messaging } = await getAdmin();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const in30 = new Date(today);
    in30.setDate(in30.getDate() + 30);

    // 1. Load all extinguishers
    const mSnap = await db.collection("matafuegos_activos").get();
    const extintores: any[] = mSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }));

    // 2. Load admins/superadmins/secretarias to notify
    const usersSnap = await db.collection("usuarios").get();
    const staffUsers: any[] = [];
    usersSnap.forEach((d: any) => {
      const data = d.data();
      const rol = data.rol || "";
      if (["admin", "superadmin", "secretaria"].includes(rol)) {
        staffUsers.push({ uid: d.id, ...data });
      }
    });

    // 3. Load recent notifications to avoid duplicates (last 25 days)
    const since25 = new Date(today);
    since25.setDate(since25.getDate() - 25);
    const recentSnap = await db
      .collection("notificaciones_enviadas")
      .where("creadaEn", ">=", since25)
      .where("subtipo", "==", "matafuegos-auto")
      .get();

    // Key: `${matafuegoId}__${tipo}__${destinatarioUid}`
    const recentKeys = new Set<string>();
    recentSnap.forEach((d: any) => {
      const data = d.data();
      if (data.matafuegoId && data.tipoAlerta && data.destinatarioUid) {
        recentKeys.add(`${data.matafuegoId}__${data.tipoAlerta}__${data.destinatarioUid}`);
      }
    });

    const notifsBatch: any[] = [];

    for (const m of extintores) {
      const nombre = m.clienteNombre || m.clienteEmpresa || "cliente";
      const tarjeta = m.nroTarjeta || m.id;
      const descripcion = `${m.datosTecnicos?.agente || ""} ${m.datosTecnicos?.capacidad || ""}`.trim();
      const equipoLabel = `Tarjeta N° ${tarjeta}${descripcion ? ` (${descripcion})` : ""}`;

      // ── CARGA checks ──────────────────────────────────────────────────────
      const vcStr: string | undefined = m.historial?.vencimientoCarga; // "YYYY-MM"
      if (vcStr) {
        // Treat as end-of-month: YYYY-MM-28 (safe approx)
        const vcDate = new Date(vcStr + "-28");
        vcDate.setHours(0, 0, 0, 0);

        let tipoAlerta: string | null = null;
        let titulo = "";
        let cuerpo = "";
        let actionUrl = "/admin/planillas/matafuegos?tab=inventario";

        if (vcDate < today) {
          tipoAlerta = "carga-vencida";
          titulo = "⚠️ Extintor con Carga Vencida";
          cuerpo = `El extintor ${equipoLabel} de ${nombre} tiene la carga VENCIDA desde ${vcStr}. Coordiná el mantenimiento a la brevedad.`;
        } else if (vcDate <= in30) {
          const diasRestantes = daysDiff(today, vcDate);
          tipoAlerta = "carga-por-vencer";
          titulo = "🔔 Extintor próximo a vencer (Carga)";
          cuerpo = `El extintor ${equipoLabel} de ${nombre} vence su carga en aprox. ${diasRestantes} días (${vcStr}). Coordiná el servicio.`;
        }

        if (tipoAlerta) {
          // Notify all staff
          for (const staff of staffUsers) {
            const key = `${m.id}__${tipoAlerta}__${staff.uid}`;
            if (!recentKeys.has(key)) {
              notifsBatch.push({
                notif: {
                  titulo,
                  cuerpo,
                  tipo: "usuario",
                  subtipo: "matafuegos-auto",
                  tipoAlerta,
                  matafuegoId: m.id,
                  destinatarioUid: staff.uid,
                  destinatarioEmail: staff.email || "",
                  fcmToken: staff.fcmToken || null,
                  estado: "pendiente",
                  actionUrl,
                  creadaEn: new Date(),
                },
                fcmToken: staff.fcmToken || null,
                title: titulo,
                body: cuerpo,
                actionUrl,
              });
              recentKeys.add(key);
            }
          }

          // Notify the client (if linked)
          if (m.clienteId) {
            // Find client user
            const clienteUserSnap = await db.collection("usuarios").doc(m.clienteId).get();
            if (clienteUserSnap.exists) {
              const clienteData = clienteUserSnap.data();
              const key = `${m.id}__${tipoAlerta}__${m.clienteId}`;
              if (!recentKeys.has(key)) {
                const clienteTitulo = vcDate < today
                  ? "⚠️ Tu extintor tiene la carga vencida"
                  : "🔔 Tu extintor está próximo a vencer (Carga)";
                const clienteCuerpo = vcDate < today
                  ? `Tu extintor ${equipoLabel} tiene la carga VENCIDA desde ${vcStr}. Por favor, contactanos para coordinar el servicio.`
                  : `Tu extintor ${equipoLabel} vence su carga pronto (${vcStr}). Contactanos para coordinar el mantenimiento.`;
                notifsBatch.push({
                  notif: {
                    titulo: clienteTitulo,
                    cuerpo: clienteCuerpo,
                    tipo: "usuario",
                    subtipo: "matafuegos-auto",
                    tipoAlerta,
                    matafuegoId: m.id,
                    destinatarioUid: m.clienteId,
                    destinatarioEmail: clienteData?.email || m.clienteEmail || "",
                    fcmToken: clienteData?.fcmToken || null,
                    estado: "pendiente",
                    actionUrl: "/admin/planillas/matafuegos?tab=inventario",
                    creadaEn: new Date(),
                  },
                  fcmToken: clienteData?.fcmToken || null,
                  title: clienteTitulo,
                  body: clienteCuerpo,
                  actionUrl: "/admin/planillas/matafuegos?tab=inventario",
                });
                recentKeys.add(key);
              }
            }
          }
        }
      }

      // ── PH checks ─────────────────────────────────────────────────────────
      const vphStr: string | undefined = m.historial?.proximaPH; // "YYYY-MM-DD"
      if (vphStr) {
        const vphDate = new Date(vphStr);
        vphDate.setHours(0, 0, 0, 0);

        let tipoAlerta: string | null = null;
        let titulo = "";
        let cuerpo = "";
        const actionUrl = "/admin/planillas/matafuegos?tab=inventario";

        if (vphDate < today) {
          tipoAlerta = "ph-vencida";
          titulo = "⚠️ Extintor con PH Vencida";
          cuerpo = `El extintor ${equipoLabel} de ${nombre} tiene la prueba hidrostática VENCIDA (${vphStr}). Coordiná la revisión.`;
        } else if (vphDate <= in30) {
          const diasRestantes = daysDiff(today, vphDate);
          tipoAlerta = "ph-por-vencer";
          titulo = "🔔 Extintor próximo a vencer (PH)";
          cuerpo = `El extintor ${equipoLabel} de ${nombre} vence su PH en aprox. ${diasRestantes} días (${vphStr}). Coordiná el servicio.`;
        }

        if (tipoAlerta) {
          for (const staff of staffUsers) {
            const key = `${m.id}__${tipoAlerta}__${staff.uid}`;
            if (!recentKeys.has(key)) {
              notifsBatch.push({
                notif: {
                  titulo,
                  cuerpo,
                  tipo: "usuario",
                  subtipo: "matafuegos-auto",
                  tipoAlerta,
                  matafuegoId: m.id,
                  destinatarioUid: staff.uid,
                  destinatarioEmail: staff.email || "",
                  fcmToken: staff.fcmToken || null,
                  estado: "pendiente",
                  actionUrl,
                  creadaEn: new Date(),
                },
                fcmToken: staff.fcmToken || null,
                title: titulo,
                body: cuerpo,
                actionUrl,
              });
              recentKeys.add(key);
            }
          }

          if (m.clienteId) {
            const clienteUserSnap = await db.collection("usuarios").doc(m.clienteId).get();
            if (clienteUserSnap.exists) {
              const clienteData = clienteUserSnap.data();
              const key = `${m.id}__${tipoAlerta}__${m.clienteId}`;
              if (!recentKeys.has(key)) {
                const clienteTitulo = vphDate < today
                  ? "⚠️ Tu extintor tiene la PH vencida"
                  : "🔔 Tu extintor está próximo a vencer (PH)";
                const clienteCuerpo = vphDate < today
                  ? `Tu extintor ${equipoLabel} tiene la prueba hidrostática VENCIDA (${vphStr}). Contactanos para coordinar.`
                  : `Tu extintor ${equipoLabel} vence su PH pronto (${vphStr}). Contactanos para coordinar el servicio.`;
                notifsBatch.push({
                  notif: {
                    titulo: clienteTitulo,
                    cuerpo: clienteCuerpo,
                    tipo: "usuario",
                    subtipo: "matafuegos-auto",
                    tipoAlerta,
                    matafuegoId: m.id,
                    destinatarioUid: m.clienteId,
                    destinatarioEmail: clienteData?.email || m.clienteEmail || "",
                    fcmToken: clienteData?.fcmToken || null,
                    estado: "pendiente",
                    actionUrl: "/admin/planillas/matafuegos?tab=inventario",
                    creadaEn: new Date(),
                  },
                  fcmToken: clienteData?.fcmToken || null,
                  title: clienteTitulo,
                  body: clienteCuerpo,
                  actionUrl: "/admin/planillas/matafuegos?tab=inventario",
                });
                recentKeys.add(key);
              }
            }
          }
        }
      }
    }

    // 4. Persist all new notifications and push FCM
    let saved = 0;
    let pushed = 0;
    for (const item of notifsBatch) {
      await db.collection("notificaciones_enviadas").add(item.notif);
      saved++;
      if (item.fcmToken && messaging) {
        await pushFCM(messaging, item.fcmToken, item.title, item.body, item.actionUrl);
        pushed++;
      }
    }

    return NextResponse.json({
      ok: true,
      extintoresRevisados: extintores.length,
      notificacionesCreadas: saved,
      pushEnviados: pushed,
    });
  } catch (err: any) {
    console.error("[check-matafuegos] Error:", err);
    return NextResponse.json(
      { ok: false, error: err.message || "Error interno" },
      { status: 500 }
    );
  }
}
