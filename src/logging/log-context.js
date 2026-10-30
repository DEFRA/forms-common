import { AsyncLocalStorage } from 'node:async_hooks'
import { randomUUID } from 'node:crypto'

/**
 * SNS and SQS message attribute names used to carry the log context, which
 * includes the correlation (trace) ID, user ID, session ID and form reference
 * number
 */
export const CORRELATION_ID_ATTRIBUTE = 'correlationId'
export const USER_ID_ATTRIBUTE = 'userId'
export const SESSION_ID_ATTRIBUTE = 'sessionId'
export const REFERENCE_NUMBER_ATTRIBUTE = 'referenceNumber'

/**
 * Names of the {@link LogContext} properties that can be set after the log
 * context is created
 * NOTE: Allows divergence from the above SNS/SQS attribute names.
 */
const USER_ID_PROPERTY = 'userId'
const SESSION_ID_PROPERTY = 'sessionId'
const REFERENCE_NUMBER_PROPERTY = 'referenceNumber'

const MAX_ID_LENGTH = 128
const UNSAFE_ID_CHARACTERS = /[^\w.:-]/g

/**
 * @typedef {object} LogContext
 * @property {string} correlationId - ID shared by every log line of one request, across services
 * @property {string} [userId] - Unique account ID of the signed in user
 * @property {string} [sessionId] - ID of the user's session, such as the yar session ID
 * @property {string} [referenceNumber] - Reference number of the form being completed
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
 * Holds the correlation ID, user ID, session ID and form reference number of
 * the request or queue message being processed, so that every log line
 * includes them without the caller passing them in.
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
 * @param {{ correlationId?: unknown, userId?: unknown, sessionId?: unknown, referenceNumber?: unknown }} [values]
 * @returns {LogContext}
 */
export function createLogContext(values = {}) {
  return {
    correlationId: sanitiseId(values.correlationId) ?? randomUUID(),
    userId: sanitiseId(values.userId),
    sessionId: sanitiseId(values.sessionId),
    referenceNumber: sanitiseId(values.referenceNumber)
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
    userId: attributes?.[USER_ID_ATTRIBUTE]?.StringValue,
    sessionId: attributes?.[SESSION_ID_ATTRIBUTE]?.StringValue,
    referenceNumber: attributes?.[REFERENCE_NUMBER_ATTRIBUTE]?.StringValue
  })

  return runWithLogContext(context, fn)
}

/**
 * Sets an ID on the current log context. The value is ignored when there is
 * no current log context or the ID is not valid after sanitising.
 * @param {typeof USER_ID_PROPERTY | typeof SESSION_ID_PROPERTY | typeof REFERENCE_NUMBER_PROPERTY} property
 * @param {unknown} value
 */
function setLogContextId(property, value) {
  const context = storage.getStore()
  const id = sanitiseId(value)

  if (context && id) {
    context[property] = id
  }
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
  setLogContextId(USER_ID_PROPERTY, userId)
}

/**
 * @returns {string | undefined}
 */
export function getSessionId() {
  return storage.getStore()?.sessionId
}

/**
 * Sets the session ID on the current log context, for example when the
 * session is replaced while the request is handled
 * @param {unknown} sessionId
 */
export function setSessionId(sessionId) {
  setLogContextId(SESSION_ID_PROPERTY, sessionId)
}

/**
 * @returns {string | undefined}
 */
export function getReferenceNumber() {
  return storage.getStore()?.referenceNumber
}

/**
 * Sets the reference number of the form being completed on the current log
 * context
 * @param {unknown} referenceNumber
 */
export function setReferenceNumber(referenceNumber) {
  setLogContextId(REFERENCE_NUMBER_PROPERTY, referenceNumber)
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

  if (context.sessionId) {
    attributes[SESSION_ID_ATTRIBUTE] = {
      DataType: 'String',
      StringValue: context.sessionId
    }
  }

  if (context.referenceNumber) {
    attributes[REFERENCE_NUMBER_ATTRIBUTE] = {
      DataType: 'String',
      StringValue: context.referenceNumber
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
