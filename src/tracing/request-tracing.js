import {
  createLogContext,
  runWithLogContext,
  setUserId
} from '~/src/logging/log-context.js'

/**
 * @typedef {object} RequestTracingOptions
 * @property {string | null} [tracingHeader] - Name of the header that carries the correlation ID between services. A correlation ID is still generated for each request when there is none.
 * @property {Plugin<{ tracingHeader?: string }>} [tracingPlugin] - The `tracing.plugin` of `@defra/hapi-tracing`. It is registered after the log context is started, so `getTraceId` returns the same correlation ID. The service passes in its own copy because the module holds the trace ID.
 * @property {(request: Request) => string | undefined} [getUserId] - Gets the unique account ID of the authenticated user, never their email address. Called for each request on a route with authentication, once the credentials are known.
 */

/**
 * Runs part of the request cycle inside the log context. hapi has no public
 * hook for this, `@defra/hapi-tracing` wraps the request cycle the same way.
 * @param {Request} request
 * @param {'_lifecycle' | '_reply'} cycle
 * @param {LogContext} context
 */
function wrapCycle(request, cycle, context) {
  const internals =
    /** @type {Record<string, (...args: unknown[]) => unknown>} */ (
      /** @type {unknown} */ (request)
    )
  const requestCycle = internals[cycle].bind(request)

  internals[cycle] = (...args) =>
    runWithLogContext(context, requestCycle, ...args)
}

/**
 * Starts a log context for every request, holding the correlation ID from the
 * tracing header (or a new ID when the caller sent none) and the ID of the
 * authenticated user. A logger set up with `logContextMixin` and
 * `addLogContextToMessage` writes both on every log line.
 * @type {Plugin<RequestTracingOptions | undefined>}
 */
export const requestTracing = {
  name: 'request-tracing',
  async register(server, options = {}) {
    const { tracingHeader, tracingPlugin, getUserId } = options

    server.ext('onRequest', (request, h) => {
      const context = createLogContext({
        correlationId: tracingHeader
          ? request.headers[tracingHeader]
          : undefined
      })

      // `@defra/hapi-tracing` reads the header, so it reports the same ID
      // when the caller did not send one
      if (tracingHeader) {
        request.headers[tracingHeader] = context.correlationId
      }

      // The response and request error logs are written during `_reply`
      wrapCycle(request, '_lifecycle', context)
      wrapCycle(request, '_reply', context)

      return h.continue
    })

    if (getUserId) {
      server.ext('onCredentials', (request, h) => {
        setUserId(getUserId(request))

        return h.continue
      })
    }

    if (tracingPlugin) {
      await server.register({
        plugin: tracingPlugin,
        options: { tracingHeader: tracingHeader ?? undefined }
      })
    }
  }
}

/**
 * @import { Plugin, Request } from '@hapi/hapi'
 * @import { LogContext } from '~/src/logging/log-context.js'
 */
