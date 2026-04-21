import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/send-notification
 *
 * Uses Firebase Admin SDK (FCM v1 API) — modern, secure approach.
 * No legacy Server Key needed. Uses a service account instead.
 *
 * Body (individual token):
 *   { token: string, title: string, body: string, data?: Record<string,string> }
 *
 * Body (topic broadcast):
 *   { topic: string, title: string, body: string, data?: Record<string,string> }
 *
 * Requires env var:
 *   FIREBASE_SERVICE_ACCOUNT_KEY = JSON string of the service account file
 *
 * If not configured, falls back gracefully (notification saved to Firestore
 * but not pushed in real-time — Cloud Functions can pick it up later).
 */

// Lazy-initialize Admin SDK to avoid cold-start issues
let adminApp: any = null;
let adminMessaging: any = null;

async function getAdminMessaging() {
  if (adminMessaging) return adminMessaging;

  const serviceAccountRaw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!serviceAccountRaw) return null;

  try {
    // Dynamic import to avoid issues with Edge runtime
    const admin = await import("firebase-admin");

    if (!adminApp) {
      // Parse service account — supports both raw JSON string and base64
      let serviceAccount: any;
      try {
        serviceAccount = JSON.parse(serviceAccountRaw);
      } catch {
        // Try base64 decode (useful for Vercel env vars with special chars)
        serviceAccount = JSON.parse(
          Buffer.from(serviceAccountRaw, "base64").toString("utf-8")
        );
      }

      // Initialize only if no app exists
      if (admin.apps.length === 0) {
        adminApp = admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        });
      } else {
        adminApp = admin.app();
      }
    }

    adminMessaging = admin.messaging(adminApp);
    return adminMessaging;
  } catch (err) {
    console.error("[send-notification] Failed to initialize Admin SDK:", err);
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token, topic, title, body: msgBody, data } = body;

    if (!title || !msgBody) {
      return NextResponse.json(
        { error: "title and body are required" },
        { status: 400 }
      );
    }

    if (!token && !topic) {
      return NextResponse.json(
        { error: "token or topic is required" },
        { status: 400 }
      );
    }

    const messaging = await getAdminMessaging();

    if (!messaging) {
      // Admin SDK not configured — notification is saved to Firestore
      // A Cloud Function can pick it up. Log so admin knows to configure.
      console.warn(
        "[send-notification] FIREBASE_SERVICE_ACCOUNT_KEY not set. " +
          "Notification saved to Firestore but not pushed in real-time."
      );
      return NextResponse.json({
        success: true,
        via: "firestore-only",
        message: "Notification saved. Configure FIREBASE_SERVICE_ACCOUNT_KEY to enable real-time push.",
      });
    }

    // Build FCM v1 message
    const message: any = {
      notification: {
        title,
        body: msgBody,
      },
      android: {
        notification: {
          icon: "ic_notification",
          clickAction: data?.actionUrl || "/",
        },
      },
      webpush: {
        notification: {
          icon: "/logos/192x192.png",
          badge: "/logos/favicon.png",
          requireInteraction: false,
        },
        fcmOptions: {
          link: data?.actionUrl || "/",
        },
      },
      // Stringify all data values — FCM v1 requires string values
      data: data
        ? Object.fromEntries(
            Object.entries(data).map(([k, v]) => [k, String(v)])
          )
        : undefined,
    };

    if (token) {
      message.token = token;
    } else {
      message.topic = topic;
    }

    const result = await messaging.send(message);
    console.log(`[send-notification] Sent successfully: ${result}`);

    return NextResponse.json({ success: true, messageId: result });
  } catch (err: any) {
    console.error("[send-notification] Error:", err);

    // FCM-specific error codes
    if (err.code === "messaging/registration-token-not-registered") {
      return NextResponse.json(
        { error: "Token inválido o expirado. El usuario debe reactivar las notificaciones." },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Error al enviar la notificación", details: err.message },
      { status: 500 }
    );
  }
}
