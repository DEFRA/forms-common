import {
  getCorrelationId,
  getReferenceNumber,
  getSessionId,
  getUserId
} from '~/src/logging/log-context.js'

/**
 * Header that tells a forms service the account ID of the user the calling
 * service is acting for. Only trust it on a request from an authenticated
 * service.
 */
export const USER_ID_HEADER = 'x-forms-user-id'

/**
 * Header that tells a forms service the session ID of the user the calling
 * service is acting for. Only send it to another forms service.
 */
export const SESSION_ID_HEADER = 'x-forms-session-id'

/**
 * Header that tells a forms service the reference number of the form the
 * calling service is handling. Only send it to another forms service.
 */
export const REFERENCE_NUMBER_HEADER = 'x-forms-reference-number'

/**
 * Adds the correlation ID of the current log context to the headers of an
 * outbound HTTP request, so the receiving service logs the same ID
 * @template {Record<string, unknown>} Headers
 * @param {Headers | undefined} headers - the existing headers
 * @param {string | null | undefined} tracingHeader - name of the header that carries the correlation ID
 * @returns {Headers | undefined}
 */
export function applyTraceHeaders(headers, tracingHeader) {
  const correlationId = getCorrelationId()

  if (!tracingHeader || !correlationId) {
    return headers
  }

  /** @type {Record<string, unknown>} */
  const result = {
    ...headers,
    [tracingHeader]: correlationId
  }

  return /** @type {Headers} */ (result)
}

/**
 * Adds the user ID of the current log context to the headers of an outbound
 * HTTP request to another forms service, see {@link USER_ID_HEADER}
 * @template {Record<string, unknown>} Headers
 * @param {Headers | undefined} headers - the existing headers
 * @returns {Headers | undefined}
 */
export function applyUserIdHeader(headers) {
  const userId = getUserId()

  if (!userId) {
    return headers
  }

  /** @type {Record<string, unknown>} */
  const result = {
    ...headers,
    [USER_ID_HEADER]: userId
  }

  return /** @type {Headers} */ (result)
}

/**
 * Adds the session ID and the form reference number of the current log
 * context to the headers of an outbound HTTP request to another forms
 * service, see {@link SESSION_ID_HEADER} and {@link REFERENCE_NUMBER_HEADER}.
 * Do not use it for a request to a service outside forms, because the
 * session ID identifies the user's session.
 * @template {Record<string, unknown>} Headers
 * @param {Headers | undefined} headers - the existing headers
 * @returns {Headers | undefined}
 */
export function applyLogContextHeaders(headers) {
  const sessionId = getSessionId()
  const referenceNumber = getReferenceNumber()

  if (!sessionId && !referenceNumber) {
    return headers
  }

  /** @type {Record<string, unknown>} */
  const result = { ...headers }

  if (sessionId) {
    result[SESSION_ID_HEADER] = sessionId
  }

  if (referenceNumber) {
    result[REFERENCE_NUMBER_HEADER] = referenceNumber
  }

  return /** @type {Headers} */ (result)
}
