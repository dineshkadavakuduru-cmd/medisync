import type { FastifyInstance } from 'fastify';

export type WSMessageType =
  | 'BED_UPDATE'
  | 'MEDICINE_UPDATE'
  | 'ALERT_NEW'
  | 'ALERT_RESOLVED'
  | 'REFERRAL_UPDATE'
  | 'STAFF_UPDATE'
  | 'EMERGENCY_NEW'
  | 'EMERGENCY_UPDATE'
  | 'EMERGENCY_ESCALATED'
  | 'AMBULANCE_DISPATCHED'
  | 'CONNECTED';

export interface WSMessage {
  type: WSMessageType;
  facilityId: string;
  data: unknown;
  timestamp: string;
}

type Socket = {
  on(event: string, handler: (msg: Buffer) => void): void;
  send(data: string): void;
  readyState: number;
};

const clients: Map<string, Socket[]> = new Map();
const globalClients: Socket[] = [];

export function registerWebSocket(fastify: FastifyInstance) {
  fastify.get('/ws', { websocket: true }, (socket) => {
    socket.on('message', (msg: Buffer) => {
      try {
        const parsed = JSON.parse(msg.toString());
        if (parsed.action === 'subscribe') {
          if (parsed.facilityId) {
            if (!clients.has(parsed.facilityId)) {
              clients.set(parsed.facilityId, []);
            }
            const list = clients.get(parsed.facilityId)!;
            if (!list.includes(socket as Socket)) {
              list.push(socket as Socket);
            }
          } else {
            if (!globalClients.includes(socket as Socket)) {
              globalClients.push(socket as Socket);
            }
          }
          socket.send(
            JSON.stringify({ type: 'CONNECTED', facilityId: parsed.facilityId || '', data: null, timestamp: new Date().toISOString() } as WSMessage)
          );
        }
      } catch {
        // ignore malformed messages
      }
    });

    socket.on('close', () => {
      clients.forEach((sockets, key) => {
        const filtered = sockets.filter((s) => s !== socket);
        if (filtered.length === 0) {
          clients.delete(key);
        } else {
          clients.set(key, filtered);
        }
      });
      const gIdx = globalClients.indexOf(socket as Socket);
      if (gIdx > -1) globalClients.splice(gIdx, 1);
    });
  });
}

export function broadcast(message: WSMessage) {
  const payload = JSON.stringify(message);
  const facilitySockets = clients.get(message.facilityId) || [];
  facilitySockets.forEach((s) => {
    if (s.readyState === 1) s.send(payload);
  });
  globalClients.forEach((s) => {
    if (s.readyState === 1) s.send(payload);
  });
}
