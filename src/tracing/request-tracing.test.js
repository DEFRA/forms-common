import { getTraceId, tracing } from '@defra/hapi-tracing'
import hapi from '@hapi/hapi'

import {
  getCorrelationId,
  getUserId,
  setUserId
} from '~/src/logging/log-context.js'
import { requestTracing } from '~/src/tracing/request-tracing.js'

describe('request-tracing', () => {
  const tracingHeader = 'x-cdp-request-id'
  const correlationId = '1066e8cc-8e1e-4671-8ad7-b4cd9c95bb94'
  const userId = '86758ba9-92e7-4287-9751-7705e449f0a5'

  /**
   * @typedef {object} Context
   * @property {string} [correlationId] - Correlation ID of the log context
   * @property {string | null} [traceId] - Trace ID of `@defra/hapi-tracing`
   * @property {string} [userId] - User ID of the log context
   */

  /** @type {Server} */
  let server

  /** @type {Context} */
  let responseContext

  /**
   * @returns {Context}
   */
  function getContext() {
    return {
      correlationId: getCorrelationId(),
      traceId: getTraceId(),
      userId: getUserId()
    }
  }

  /**
   * @param {RequestTracingOptions} [options]
   */
  async function createServer(options) {
    server = hapi.server()
    responseContext = {}

    server.auth.scheme('test', () => ({
      authenticate: (_request, h) =>
        h.authenticated({ credentials: { user: { id: userId } } })
    }))
    server.auth.strategy('test', 'test')

    await register(options)

    server.route([
      { method: 'GET', path: '/open', handler: getContext },
      {
        method: 'GET',
        path: '/secure',
        handler: getContext,
        options: { auth: 'test' }
      },
      {
        method: 'GET',
        path: '/sign-in',
        handler() {
          setUserId(userId)

          return getContext()
        }
      }
    ])

    // The response log is written when this event is emitted
    server.events.on('response', () => {
      responseContext = {
        correlationId: getCorrelationId(),
        userId: getUserId()
      }
    })
  }

  /**
   * @param {RequestTracingOptions} [options]
   */
  function register(options) {
    return server.register({ plugin: requestTracing, options })
  }

  afterEach(async () => {
    await server.stop()
  })

  describe('with a tracing header', () => {
    beforeEach(async () => {
      await createServer({
        tracingHeader,
        tracingPlugin: tracing.plugin,
        getUserId: (request) =>
          /** @type {{ id: string } | undefined} */ (
            request.auth.credentials.user
          )?.id
      })
    })

    it('should use the correlation ID from the tracing header', async () => {
      const { result } = await server.inject({
        method: 'GET',
        url: '/open',
        headers: { [tracingHeader]: correlationId }
      })

      expect(result).toEqual({
        correlationId,
        traceId: correlationId,
        userId: undefined
      })
      expect(responseContext).toEqual({ correlationId, userId: undefined })
    })

    it('should generate a correlation ID when there is no tracing header', async () => {
      const response = await server.inject({ method: 'GET', url: '/open' })
      const result = /** @type {Context} */ (response.result)

      expect(result).toEqual({
        correlationId: expect.stringMatching(/^[0-9a-f-]{36}$/),
        traceId: result.correlationId,
        userId: undefined
      })
      expect(responseContext).toEqual({
        correlationId: result.correlationId,
        userId: undefined
      })
    })

    it('should use a different correlation ID for each request', async () => {
      const [first, second] = await Promise.all([
        server.inject({ method: 'GET', url: '/open' }),
        server.inject({ method: 'GET', url: '/open' })
      ])

      expect(/** @type {Context} */ (first.result).correlationId).not.toBe(
        /** @type {Context} */ (second.result).correlationId
      )
    })

    it('should replace unsafe characters in the correlation ID', async () => {
      const { result } = await server.inject({
        method: 'GET',
        url: '/open',
        headers: { [tracingHeader]: 'abc] [def' }
      })

      expect(result).toMatchObject({
        correlationId: 'abc___def',
        traceId: 'abc___def'
      })
    })

    it('should add the ID of the authenticated user', async () => {
      const { result } = await server.inject({
        method: 'GET',
        url: '/secure',
        headers: { [tracingHeader]: correlationId }
      })

      expect(result).toEqual({
        correlationId,
        traceId: correlationId,
        userId
      })
      expect(responseContext).toEqual({ correlationId, userId })
    })

    it('should keep a user ID set while the request is handled', async () => {
      await server.inject({
        method: 'GET',
        url: '/sign-in',
        headers: { [tracingHeader]: correlationId }
      })

      expect(responseContext).toEqual({ correlationId, userId })
    })

    it('should keep the log context for a request that fails', async () => {
      const { statusCode } = await server.inject({
        method: 'GET',
        url: '/not-found',
        headers: { [tracingHeader]: correlationId }
      })

      expect(statusCode).toBe(404)
      expect(responseContext).toEqual({ correlationId, userId: undefined })
    })
  })

  describe('without options', () => {
    beforeEach(async () => {
      await createServer()
    })

    it('should not register a tracing plugin', async () => {
      const { result } = await server.inject({ method: 'GET', url: '/open' })

      expect(/** @type {Context} */ (result).traceId).toBeUndefined()
    })

    it('should generate a correlation ID and ignore the header', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/secure',
        headers: { [tracingHeader]: correlationId }
      })
      const result = /** @type {Context} */ (response.result)

      expect(result.correlationId).toMatch(/^[0-9a-f-]{36}$/)
      expect(result.correlationId).not.toBe(correlationId)
      expect(result.userId).toBeUndefined()
      expect(responseContext).toEqual({
        correlationId: result.correlationId,
        userId: undefined
      })
    })
  })
})

/**
 * @import { Server } from '@hapi/hapi'
 * @import { RequestTracingOptions } from '~/src/tracing/request-tracing.js'
 */
