import {
  createLogContext,
  runWithLogContext
} from '~/src/logging/log-context.js'
import {
  USER_ID_HEADER,
  applyTraceHeaders,
  applyUserIdHeader
} from '~/src/tracing/headers.js'

describe('headers', () => {
  const tracingHeader = 'x-cdp-request-id'
  const correlationId = '1066e8cc-8e1e-4671-8ad7-b4cd9c95bb94'
  const userId = '86758ba9-92e7-4287-9751-7705e449f0a5'
  const headers = { accept: 'application/json' }

  describe('applyTraceHeaders', () => {
    it('should return the headers unchanged outside of a log context', () => {
      expect(applyTraceHeaders(headers, tracingHeader)).toBe(headers)
      expect(applyTraceHeaders(undefined, tracingHeader)).toBeUndefined()
    })

    it.each([undefined, null, ''])(
      'should return the headers unchanged when the tracing header is %p',
      (header) => {
        runWithLogContext(createLogContext({ correlationId }), () => {
          expect(applyTraceHeaders(headers, header)).toBe(headers)
        })
      }
    )

    it('should add the correlation ID to the headers', () => {
      runWithLogContext(createLogContext({ correlationId }), () => {
        expect(applyTraceHeaders(headers, tracingHeader)).toEqual({
          accept: 'application/json',
          [tracingHeader]: correlationId
        })
        expect(applyTraceHeaders(undefined, tracingHeader)).toEqual({
          [tracingHeader]: correlationId
        })
      })
    })

    it('should not change the headers it is given', () => {
      runWithLogContext(createLogContext({ correlationId }), () => {
        applyTraceHeaders(headers, tracingHeader)

        expect(headers).toEqual({ accept: 'application/json' })
      })
    })
  })

  describe('applyUserIdHeader', () => {
    it('should return the headers unchanged outside of a log context', () => {
      expect(applyUserIdHeader(headers)).toBe(headers)
    })

    it('should return the headers unchanged when there is no user ID', () => {
      runWithLogContext(createLogContext({ correlationId }), () => {
        expect(applyUserIdHeader(headers)).toBe(headers)
      })
    })

    it('should add the user ID to the headers', () => {
      runWithLogContext(createLogContext({ correlationId, userId }), () => {
        expect(applyUserIdHeader(headers)).toEqual({
          accept: 'application/json',
          [USER_ID_HEADER]: userId
        })
        expect(applyUserIdHeader(undefined)).toEqual({
          [USER_ID_HEADER]: userId
        })
      })
    })
  })
})
