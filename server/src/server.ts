import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import authRoutes from './routes/auth.js';
import patientsRoutes from './routes/patients.js';
import facilitiesRoutes from './routes/facilities.js';
import triageRoutes from './routes/triage.js';
import referralsRoutes from './routes/referrals.js';
import alertsRoutes from './routes/alerts.js';
import analyticsRoutes from './routes/analytics.js';
import emergenciesRoutes from './routes/emergencies.js';
import { registerWebSocket } from './websocket/realtime.js';
import { startSimulator } from './services/simulator.js';

const fastify = Fastify({
  logger: true,
});

async function start() {
  try {
    await fastify.register(cors, {
      origin: true,
    });

    await fastify.register(websocket);
    registerWebSocket(fastify);

    await fastify.register(authRoutes);
    await fastify.register(patientsRoutes);
    await fastify.register(facilitiesRoutes);
    await fastify.register(triageRoutes);
    await fastify.register(referralsRoutes);
    await fastify.register(alertsRoutes);
    await fastify.register(analyticsRoutes);
    await fastify.register(emergenciesRoutes);

    fastify.get('/', async () => {
      return {
        status: 'ok',
        name: 'ArogyaSetu+ API',
        version: '1.0.0',
      };
    });

    const port = parseInt(process.env.PORT || '3001', 10);

    await fastify.listen({ port, host: '0.0.0.0' });

    console.log(`ArogyaSetu+ API server running on port ${port}`);
    startSimulator();
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

const gracefulShutdown = async () => {
  try {
    await fastify.close();
    process.exit(0);
  } catch (err) {
    process.exit(1);
  }
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

start();
