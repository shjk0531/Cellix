import fp from 'fastify-plugin'
import type { FastifyPluginAsync } from 'fastify'
import fastifyRedis from '@fastify/redis'
import { env } from '../config/env.js'

const redisPlugin: FastifyPluginAsync = async (app) => {
    await app.register(fastifyRedis, { url: env.REDIS_URL, closeClient: true })
}

export default fp(redisPlugin, { name: 'redis' })
