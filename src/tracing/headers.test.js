import {
  createLogContext,
  runWithLogContext
} from '~/src/logging/log-context.js'
import {
  REFERENCE_NUMBER_HEADER,
  SESSION_ID_HEADER,
  USER_ID_HEADER,
  applyLogContextHeaders,
  applyTraceHeaders,
  applyUserIdHeader
} from '~/src/tracing/headers.js'

describe('headers', () => {
  const tracingHeader = 'x-cdp-request-id'
  const correlationId = '1066e8cc-8e1e-4671-8ad7-b4cd9c95bb94'
  const userId = '86758ba9-92e7-4287-9751-7705e449f0a5'
  const sessionId = 'c3a2e5f4-2b8e-4e1f-9a8d-3f6b7c1d2e9a'
  const referenceNumber = 'ABC-123-DEF'
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

  describe('applyLogContextHeaders', () => {
    it('should return the headers unchanged outside of a log context', () => {
      expect(applyLogContextHeaders(headers)).toBe(headers)
    })

    it('should return the headers unchanged when there is no session ID or reference number', () => {
      runWithLogContext(createLogContext({ correlationId, userId }), () => {
        expect(applyLogContextHeaders(headers)).toBe(headers)
      })
    })

    it('should add the session ID and reference number to the headers', () => {
      const context = createLogContext({
        correlationId,
        userId,
        sessionId,
        referenceNumber
      })

      runWithLogContext(context, () => {
        expect(applyLogContextHeaders(headers)).toEqual({
          accept: 'application/json',
          [SESSION_ID_HEADER]: sessionId,
          [REFERENCE_NUMBER_HEADER]: referenceNumber
        })
        expect(headers).toEqual({ accept: 'application/json' })
      })
    })

    it('should add only the session ID when there is no reference number', () => {
      runWithLogContext(createLogContext({ correlationId, sessionId }), () => {
        expect(applyLogContextHeaders(undefined)).toEqual({
          [SESSION_ID_HEADER]: sessionId
        })
      })
    })

    it('should add only the reference number when there is no session ID', () => {
      runWithLogContext(
        createLogContext({ correlationId, referenceNumber }),
        () => {
          expect(applyLogContextHeaders(undefined)).toEqual({
            [REFERENCE_NUMBER_HEADER]: referenceNumber
          })
        }
      )
    })
  })
})
