import { WSMessageType, WSMessage } from '@medisync/shared';

export type { WSMessageType };

type Listener = (data: unknown) => void;

class WSClient {
  private ws: WebSocket | null = null;
  private readonly url: string;
  private listeners: Map<string, Listener[]> = new Map();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private facilityId?: string;

  constructor(url: string) {
    this.url = url;
  }

  connect(facilityId?: string) {
    this.facilityId = facilityId;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }
    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      this.ws?.send(JSON.stringify({ action: 'subscribe', facilityId: this.facilityId }));
    };

    this.ws.onmessage = (event) => {
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

    this.ws.onclose = () => {
      this.reconnectTimer = setTimeout(() => this.connect(this.facilityId), 3000);
    };

    this.ws.onerror = () => {
      this.ws?.close();
    };
  }

  on(type: WSMessageType | '*', callback: Listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type)!.push(callback);
  }

  off(type: WSMessageType | '*', callback: Listener) {
    const handlers = this.listeners.get(type) || [];
    this.listeners.set(type, handlers.filter((h) => h !== callback));
  }

  disconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.ws = null;
  }
}

export const wsClient = new WSClient('ws://10.0.2.2:3001/ws');
