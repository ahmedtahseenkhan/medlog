import Fastify from 'fastify'
import { validateEnv } from './lib/validateEnv.js'
import { registerPlugins } from './plugins/index.js'
import { registerRoutes } from './routes/index.js'

validateEnv()

const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL ?? 'info',
    transport:
      process.env.NODE_ENV !== 'production'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
  },
})

await registerPlugins(app)
await registerRoutes(app)

const port = Number(process.env.PORT ?? 3001)
const host = process.env.HOST ?? '0.0.0.0'

try {
  await app.listen({ port, host })
  app.log.info(`MedLog API running at http://${host}:${port}`)
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
