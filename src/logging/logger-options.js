import {
  getCorrelationId,
  getReferenceNumber,
  getSessionId,
  getUserId
} from '~/src/logging/log-context.js'

/**
 * Structured log properties that carry the log context
 * @typedef {object} LogContextMixin
 * @property {{ id: string }} [trace] - Correlation ID of the log context
 * @property {{ id: string }} [user] - User ID of the log context
 * @property {{ id: string }} [transaction] - Session ID of the log context
 * @property {{ id: string }} [span] - Form reference number of the log context
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
    mixinValues.trace = { id: traceId }
  }

  const userId = getUserId()
  if (userId) {
    mixinValues.user = { id: userId }
  }

  const sessionId = getSessionId()
  if (sessionId) {
    mixinValues.transaction = { id: sessionId }
  }

  const referenceNumber = getReferenceNumber()
  if (referenceNumber) {
    mixinValues.span = { id: referenceNumber }
  }

  return mixinValues
}
