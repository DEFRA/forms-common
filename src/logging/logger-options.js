import {
  getCorrelationId,
  getLogMessagePrefix,
  getUserId
} from '~/src/logging/log-context.js'

/**
 * Structured log properties that carry the log context
 * @typedef {object} LogContextMixin
 * @property {{ id: string }} [trace] - Correlation ID of the log context
 * @property {{ id: string }} [user] - User ID of the log context
 */

/**
 * pino `mixin` that adds the correlation ID (`trace.id`) and the user ID
 * (`user.id`) of the current log context to every log line
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

  return mixinValues
}

/**
 * Gets the message pino would write for a log call that has no message
 * argument, or undefined when the log object supplies its own message
 * @param {object | null} obj - the first argument of the log call
 * @returns {string | undefined}
 */
function getDefaultMessage(obj) {
  if (obj instanceof Error) {
    return obj.message
  }

  if (obj && 'err' in obj && obj.err instanceof Error) {
    return obj.err.message
  }

  if (obj && ('msg' in obj || 'message' in obj)) {
    return undefined
  }

  return ''
}

/**
 * pino `logMethod` hook that writes the user ID into the text of every log
 * message. CDP drops the structured `user.id` property, so the message text
 * is the only place the user ID can be found in the CDP log viewer.
 * @this {Logger}
 * @param {Parameters<LogFn>} inputArgs
 * @param {LogFn} method
 */
export function addLogContextToMessage(inputArgs, method) {
  const prefix = getLogMessagePrefix()

  if (prefix) {
    /** @type {unknown[]} */
    const args = inputArgs
    const [first, second] = args

    if (typeof first === 'string') {
      args[0] = prefix + first
    } else if (typeof second === 'string') {
      args[1] = prefix + second
    } else if (typeof first === 'object' && second === undefined) {
      const message = getDefaultMessage(first)

      if (message !== undefined) {
        args[1] = (prefix + message).trimEnd()
      }
    }
  }

  method.apply(this, inputArgs)
}

/**
 * @import { LogFn, Logger } from 'pino'
 */
