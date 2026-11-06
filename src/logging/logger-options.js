import {
  getCorrelationId,
  getReferenceNumber,
  getSessionId,
  getUserId
} from '~/src/logging/log-context.js'

/**
 * Structured log properties that carry the log context.
 *
 * The CDP log pipeline only keeps `trace.id`, `transaction.id` and `span.id`
 * as dotted keys (`{ "span.id": "..." }`) and `user.id` as a nested object
 * (`{ "user": { "id": "..." } }`), and drops the other form of each, so the
 * properties are written in the form that CDP keeps.
 * @typedef {{
 *   'trace.id'?: string,
 *   user?: { id: string },
 *   'transaction.id'?: string,
 *   'span.id'?: string
 * }} LogContextMixin
 */

/**
 * pino `mixin` that adds the correlation ID (`trace.id`), the user ID
 * (`user.id`), the session ID (`transaction.id`) and the form reference number
 * (`span.id`) of the current log context to every log line
 * @returns {LogContextMixin}
 */
export function logContextMixin() {
  /** @type {LogContextMixin} */
  const mixinValues = {}

  const traceId = getCorrelationId()
  if (traceId) {
    mixinValues['trace.id'] = traceId
  }

  const userId = getUserId()
  if (userId) {
    mixinValues.user = { id: userId }
  }

  const sessionId = getSessionId()
  if (sessionId) {
    mixinValues['transaction.id'] = sessionId
  }

  const referenceNumber = getReferenceNumber()
  if (referenceNumber) {
    mixinValues['span.id'] = referenceNumber
  }

  return mixinValues
}
