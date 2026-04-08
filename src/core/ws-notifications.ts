/**
 * WebSocket 通知 — 实时推送给连接的客户端
 */

import { randomUUID } from "crypto";
import type { IncomingMessage } from "http";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const WSModule: any = require("ws");
const WebSocketServer: any = WSModule.WebSocketServer;
const WebSocket: any = WSModule.WebSocket;

let chatHandler: ((message: string, sessionId: string, clientId: string) => Promise<void>) | null = null;

export function setChatHandler(handler: (message: string, sessionId: string, clientId: string) => Promise<void>) {
  chatHandler = handler;
}

interface WSClient {
  id: string;
  ws: any;
  connectedAt: string;
  lastPing: number;
}

const clients = new Map<string, WSClient>();
let initialized = false;

export function initWebSocket(server: any): void {
  if (initialized) return;
  initialized = true;

  const wss = new WebSocketServer({ noServer: true, perMessageDeflate: false });

  wss.on("connection", (ws: any) => {
    const clientId = randomUUID().split("-")[0];
    const client: WSClient = { id: clientId, ws, connectedAt: new Date().toISOString(), lastPing: Date.now() };
    clients.set(clientId, client);
    console.log("[WebSocket] Client registered:", clientId, "Total clients:", clients.size);

    ws.on("message", (data: any) => {
      client.lastPing = Date.now();
      const msg = typeof data === "string" ? data : Buffer.from(data as any).toString("utf-8");

      if (msg === "__ping__") {
        if (ws.readyState === WebSocket.OPEN) ws.send("__pong__");
        return;
      }
      if (msg === "__pong__") return;

      try {
        const parsed = JSON.parse(msg);
        if (parsed.type === "chat" && parsed.message && chatHandler) {
          const sid = parsed.sessionId || `ws_${Date.now()}`;
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ event: "chat_thinking", data: { sessionId: sid } }));
          }
          chatHandler(parsed.message, sid, clientId).catch((err) => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ event: "chat_error", data: { error: err.message || "Processing failed", sessionId: sid } }));
            }
          });
          return;
        }
      } catch {}

      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ event: "ack", data: { received: msg } }));
      }
    });

    ws.on("pong", () => {
      client.lastPing = Date.now();
    });

    ws.on("close", (code: any, reason: any) => {
      console.log("[WebSocket] Client disconnected:", clientId, "code:", code, "reason:", reason?.toString() || "none");
      clients.delete(clientId);
    });

    ws.on("error", (err: any) => {
      const code = err?.code || "UNKNOWN";
      if (code === "ECONNRESET") console.log("[WebSocket] Client reset connection:", clientId);
      else console.log("[WebSocket] Client error:", clientId, err?.message || String(err), code);
      clients.delete(clientId);
    });
  });

  const previousUpgradeListeners = typeof server.listeners === "function" ? server.listeners("upgrade") : [];
  if (previousUpgradeListeners.length > 0 && typeof server.removeAllListeners === "function") {
    server.removeAllListeners("upgrade");
  }

  server.on("upgrade", (req: IncomingMessage, socket: any, head: Buffer) => {
    const urlPath = (req.url || "/").split("?")[0];
    console.log("[WebSocket] Upgrade request:", { url: req.url, urlPath });

    if (urlPath === "/ws" || urlPath === "/ws/") {
      try {
        wss.handleUpgrade(req, socket, head, (ws: any) => {
          wss.emit("connection", ws, req);
        });
      } catch (err: any) {
        console.log("[WebSocket] handleUpgrade error:", err?.message || String(err));
        socket.destroy();
      }
      return;
    }

    for (const listener of previousUpgradeListeners) {
      try {
        listener.call(server, req, socket, head);
        if (socket.destroyed) return;
      } catch (err: any) {
        console.log("[WebSocket] Forward upgrade listener error:", err?.message || String(err));
      }
    }
    if (!socket.destroyed) socket.destroy();
  });

  setInterval(() => {
    const now = Date.now();
    for (const [id, client] of clients) {
      if (now - client.lastPing > 60000) {
        clients.delete(id);
        client.ws.terminate();
        continue;
      }
      try {
        if (client.ws.readyState === WebSocket.OPEN) client.ws.ping();
      } catch {
        clients.delete(id);
      }
    }
  }, 30000);
}

export function broadcastNotification(
  event: string,
  data: Record<string, any>
): number {
  const payload = JSON.stringify({ event, data, timestamp: new Date().toISOString() });
  let sent = 0;

  for (const [id, client] of clients) {
    try {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(payload);
        sent++;
      }
    } catch {
      clients.delete(id);
    }
  }

  return sent;
}

export function sendToClient(
  clientId: string,
  event: string,
  data: Record<string, any>
): boolean {
  const client = clients.get(clientId);
  if (!client || client.ws.readyState !== WebSocket.OPEN) return false;

  try {
    client.ws.send(JSON.stringify({ event, data, timestamp: new Date().toISOString() }));
    return true;
  } catch {
    clients.delete(clientId);
    return false;
  }
}

export function listConnectedClients(): Array<{ id: string; connectedAt: string }> {
  return Array.from(clients.values()).map((c) => ({
    id: c.id,
    connectedAt: c.connectedAt,
  }));
}

export function getClientCount(): number {
  return clients.size;
}
