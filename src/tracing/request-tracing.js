import {
  createLogContext,
  runWithLogContext,
  setSessionId,
  setUserId
} from '~/src/logging/log-context.js'
import {
  REFERENCE_NUMBER_HEADER,
  SESSION_ID_HEADER
} from '~/src/tracing/headers.js'

/**
 * Name of the `@hapi/yar` plugin, which loads the session in `onPreAuth`
 */
const YAR_PLUGIN_NAME = '@hapi/yar'

/**
 * @typedef {object} RequestTracingOptions
 * @property {string | null} [tracingHeader] - Name of the header that carries the correlation ID between services. A correlation ID is still generated for each request when there is none.
 * @property {Plugin<{ tracingHeader?: string }>} [tracingPlugin] - The `tracing.plugin` of `@defra/hapi-tracing`. It is registered after the log context is started, so `getTraceId` returns the same correlation ID. The service passes in its own copy because the module holds the trace ID.
 * @property {(request: Request) => string | undefined} [getUserId] - Gets the unique account ID of the authenticated user, never their email address. Called for each request on a route with authentication, once the credentials are known.
 * @property {(request: Request) => string | null | undefined} [getSessionId] - Gets the ID of the user's session, such as `request.yar.id`. Called for each request in `onPreAuth`, after `@hapi/yar` has loaded the session.
 * @property {boolean} [readLogContextHeaders] - Reads the session ID and the form reference number from the headers sent by another forms service. Only enable it on a service that is called by other services, never on a service that browsers call.
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
 * tracing header (or a new ID when the caller sent none), the ID of the
 * authenticated user and the ID of the user's session. A logger set up with
 * `logContextMixin` writes them on every log line.
 * @type {Plugin<RequestTracingOptions | undefined>}
 */
export const requestTracing = {
  name: 'request-tracing',
  async register(server, options = {}) {
    const {
      tracingHeader,
      tracingPlugin,
      getUserId,
      getSessionId,
      readLogContextHeaders
    } = options

    server.ext('onRequest', (request, h) => {
      const { headers } = request
      const context = createLogContext({
        correlationId: tracingHeader ? headers[tracingHeader] : undefined,
        sessionId: readLogContextHeaders
          ? headers[SESSION_ID_HEADER]
          : undefined,
        referenceNumber: readLogContextHeaders
          ? headers[REFERENCE_NUMBER_HEADER]
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

    if (getSessionId) {
      // yar may be registered before or after this plugin
      server.ext(
        'onPreAuth',
        (request, h) => {
          setSessionId(getSessionId(request))

          return h.continue
        },
        { after: [YAR_PLUGIN_NAME] }
      )
    }

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
