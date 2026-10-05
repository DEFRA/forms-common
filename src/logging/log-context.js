import { AsyncLocalStorage } from 'node:async_hooks'
import { randomUUID } from 'node:crypto'

/**
 * SNS and SQS message attribute names used to carry the log context
 */
export const CORRELATION_ID_ATTRIBUTE = 'correlationId'
export const USER_ID_ATTRIBUTE = 'userId'

const MAX_ID_LENGTH = 128
const UNSAFE_ID_CHARACTERS = /[^\w.:-]/g

/**
 * @typedef {object} LogContext
 * @property {string} correlationId - ID shared by every log line of one request, across services
 * @property {string} [userId] - Unique account ID of the signed in user
 */

/**
 * SNS or SQS message attributes that carry a log context
 * @typedef {Record<string, { DataType: 'String', StringValue: string }>} LogContextMessageAttributes
 */

/**
 * The part of a received SQS message that the log context is read from
 * @typedef {object} LogContextMessage
 * @property {Record<string, { StringValue?: string } | undefined>} [MessageAttributes] - Attributes set by the publisher
 */

/**
 * Holds the correlation ID and user ID of the request or queue message being
 * processed, so that every log line includes them without the caller passing
 * them in.
 * @type {AsyncLocalStorage<LogContext>}
 */
const storage = new AsyncLocalStorage()

/**
 * Restricts an ID to characters that are safe to write into a log message, an
 * HTTP header or a message attribute. IDs can arrive from outside the service.
 * @param {unknown} value
 * @returns {string | undefined}
 */
export function sanitiseId(value) {
  if (typeof value !== 'string') {
    return undefined
  }

  const id = value.replace(UNSAFE_ID_CHARACTERS, '_').slice(0, MAX_ID_LENGTH)

  return id || undefined
}

/**
 * Creates a log context. A correlation ID is generated when none is supplied.
 * @param {{ correlationId?: unknown, userId?: unknown }} [values]
 * @returns {LogContext}
 */
export function createLogContext(values = {}) {
  return {
    correlationId: sanitiseId(values.correlationId) ?? randomUUID(),
    userId: sanitiseId(values.userId)
  }
}

/**
 * Runs a function with the log context applied to every log line it writes,
 * including those written by the asynchronous work it starts
 * @template {unknown[]} Args
 * @template Result
 * @param {LogContext} context
 * @param {(...args: Args) => Result} fn
 * @param {Args} args
 * @returns {Result}
 */
export function runWithLogContext(context, fn, ...args) {
  return storage.run(context, fn, ...args)
}

/**
 * Runs a function with the log context carried by a received SQS message.
 * The message attributes are set by the publisher, see {@link getMessageAttributes}.
 * @template Result
 * @param {LogContextMessage} message
 * @param {() => Result} fn
 * @returns {Result}
 */
export function runWithMessageLogContext(message, fn) {
  const attributes = message.MessageAttributes
  const context = createLogContext({
    correlationId: attributes?.[CORRELATION_ID_ATTRIBUTE]?.StringValue,
    userId: attributes?.[USER_ID_ATTRIBUTE]?.StringValue
  })

  return runWithLogContext(context, fn)
}

/**
 * @returns {string | undefined}
 */
export function getCorrelationId() {
  return storage.getStore()?.correlationId
}

/**
 * @returns {string | undefined}
 */
export function getUserId() {
  return storage.getStore()?.userId
}

/**
 * Sets the user ID on the current log context. Use the user's unique account
 * ID, never their email address.
 * @param {unknown} userId
 */
export function setUserId(userId) {
  const context = storage.getStore()
  const id = sanitiseId(userId)

  if (context && id) {
    context.userId = id
  }
}

/**
 * Gets the SNS or SQS message attributes that carry the current log context
 * to the consumer of a message
 * @returns {LogContextMessageAttributes | undefined}
 */
export function getMessageAttributes() {
  const context = storage.getStore()

  if (!context) {
    return undefined
  }

  /** @type {LogContextMessageAttributes} */
  const attributes = {
    [CORRELATION_ID_ATTRIBUTE]: {
      DataType: 'String',
      StringValue: context.correlationId
    }
  }

  if (context.userId) {
    attributes[USER_ID_ATTRIBUTE] = {
      DataType: 'String',
      StringValue: context.userId
    }
  }

  return attributes
}

/**
 * Gets the text written at the start of every log message. The correlation
 * ID is left out because CDP keeps the structured `trace.id` property.
 * @returns {string}
 */
export function getLogMessagePrefix() {
  const userId = storage.getStore()?.userId

  return userId ? `[uid:${userId}] ` : ''
}
