import { WSMessageType, WSMessage } from '@medisync/shared';
import { isDemoActive, onDemoModeChange } from './demoMode';

export type { WSMessageType };

type Listener = (data: unknown) => void;

class WSClient {
  private ws: WebSocket | null = null;
  private listeners: Map<string, Listener[]> = new Map();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private connections = new Map<symbol, string | undefined>();

  private getUrl(): string | null {
    if (isDemoActive()) return null;
    try {
      const configured = process.env.EXPO_PUBLIC_API_URL?.trim();
      if (!configured) return null;
      const url = new URL(configured);
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || !['/', '/api', '/api/'].includes(url.pathname)) return null;
      url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
      url.pathname = '/ws';
      return url.toString();
    } catch {
      return null;
    }
  }

  connect(facilityId?: string) {
    if (!this.getUrl()) {
      this.disconnect();
      return () => {};
    }
    const token = Symbol();
    this.connections.set(token, facilityId);
    this.open();
    this.subscribe();
    return () => {
      this.connections.delete(token);
      if (!this.connections.size) this.disconnect();
      else this.subscribe();
    };
  }

  private subscribe() {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    const facilities = new Set(this.connections.values());
    // A list screen and detail screen can coexist; subscribe globally in that case.
    const facilityId = facilities.size === 1 ? facilities.values().next().value : undefined;
    this.ws.send(JSON.stringify({ action: 'subscribe', facilityId }));
  }

  private open() {
    const url = this.getUrl();
    if (!url || !this.connections.size) { this.disconnect(); return; }
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    let socket: WebSocket;
    try {
      socket = new WebSocket(url);
    } catch {
      this.reconnectTimer = setTimeout(() => this.open(), 3000);
      return;
    }
    this.ws = socket;

    socket.onopen = () => {
      if (this.ws === socket) this.subscribe();
    };

    socket.onmessage = (event) => {
      if (this.ws !== socket || isDemoActive()) return;
      try {
        const msg = JSON.parse(event.data) as WSMessage;
        const handlers = this.listeners.get(msg.type) || [];
        handlers.forEach((h) => h(msg));
        const globalHandlers = this.listeners.get('*') || [];
        globalHandlers.forEach((h) => h(msg));
      } catch {
        // ignore
      }
    };

    socket.onclose = () => {
      if (this.ws !== socket) return;
      this.ws = null;
      if (this.connections.size && this.getUrl()) this.reconnectTimer = setTimeout(() => this.open(), 3000);
    };

    socket.onerror = () => {
      socket.close();
    };
  }

  on(type: WSMessageType | '*', callback: Listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type)!.push(callback);
    return () => this.off(type, callback);
  }

  off(type: WSMessageType | '*', callback: Listener) {
    const handlers = this.listeners.get(type) || [];
    this.listeners.set(type, handlers.filter((h) => h !== callback));
  }

  disconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.connections.clear();
    const socket = this.ws;
    this.ws = null;
    if (socket) {
      // Intentional close must never schedule a reconnect or deliver stale messages.
      socket.onopen = socket.onmessage = socket.onclose = socket.onerror = null;
      socket.close();
    }
  }
}

export const wsClient = new WSClient();
onDemoModeChange(() => wsClient.disconnect());
