import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import authRoutes from './routes/auth.js';
import patientsRoutes from './routes/patients.js';
import fieldWorkflowsRoutes from './routes/fieldWorkflows.js';
import facilitiesRoutes from './routes/facilities.js';
import triageRoutes from './routes/triage.js';
import referralsRoutes from './routes/referrals.js';
import alertsRoutes from './routes/alerts.js';
import analyticsRoutes from './routes/analytics.js';
import emergenciesRoutes from './routes/emergencies.js';
import teleconsultRoutes from './routes/teleconsult.js';
import appointmentsRoutes from './routes/appointments.js';
import diagnosticsRoutes from './routes/diagnostics.js';
import fhirRoutes from './routes/fhir.js';
import { registerWebSocket } from './websocket/realtime.js';
import { startSimulator } from './services/simulator.js';
import vitalsRoutes from './routes/vitals.js';
import { pathToFileURL } from 'node:url';

export async function buildServer(logger = false) {
  const fastify = Fastify({ logger, ajv: { customOptions: { removeAdditional: false, coerceTypes: false } } });
  try {
    await fastify.register(cors, {
      origin: true,
    });

    await fastify.register(websocket);
    registerWebSocket(fastify);

    await fastify.register(authRoutes);
    await fastify.register(patientsRoutes);
    await fastify.register(fieldWorkflowsRoutes);
    await fastify.register(facilitiesRoutes);
    await fastify.register(triageRoutes);
    await fastify.register(referralsRoutes);
    await fastify.register(alertsRoutes);
    await fastify.register(analyticsRoutes);
    await fastify.register(emergenciesRoutes);
    await fastify.register(teleconsultRoutes);
    await fastify.register(appointmentsRoutes);
    await fastify.register(diagnosticsRoutes);
    await fastify.register(fhirRoutes);
    await fastify.register(vitalsRoutes);

    fastify.get('/', async () => {
      return {
        status: 'ok',
        name: 'MediSync API',
        version: '1.0.0',
        mode: 'demo',
        authentication: 'unconfigured',
        abdm: 'unconfigured',
        externalNotifications: 'unconfigured',
      };
    });

    await fastify.ready();
    return fastify;
  } catch (err) {
    await fastify.close();
    throw err;
  }
}

async function start() {
  const port = Number(process.env.PORT || '3001');
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('PORT must be an integer from 0 to 65535');
  const fastify = await buildServer(true);
  try {
    await fastify.listen({ port, host: process.env.HOST || '0.0.0.0' });
    startSimulator();
  } catch (error) {
    await fastify.close();
    throw error;
  }
  const gracefulShutdown = async () => {
    try { await fastify.close(); process.exit(0); }
    catch { process.exit(1); }
  };
  process.on('SIGINT', gracefulShutdown);
  process.on('SIGTERM', gracefulShutdown);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  start().catch(error => { console.error(error); process.exitCode = 1; });
}
