import { pino } from 'pino'

import {
  createLogContext,
  runWithLogContext
} from '~/src/logging/log-context.js'
import { logContextMixin } from '~/src/logging/logger-options.js'

describe('logger-options', () => {
  const correlationId = '1066e8cc-8e1e-4671-8ad7-b4cd9c95bb94'
  const userId = '86758ba9-92e7-4287-9751-7705e449f0a5'
  const sessionId = 'c3a2e5f4-2b8e-4e1f-9a8d-3f6b7c1d2e9a'
  const referenceNumber = 'ABC-123-DEF'

  describe('logContextMixin', () => {
    it('should add nothing outside of a log context', () => {
      expect(logContextMixin()).toEqual({})
    })

    it('should add the correlation ID', () => {
      runWithLogContext(createLogContext({ correlationId }), () => {
        expect(logContextMixin()).toEqual({ trace: { id: correlationId } })
      })
    })

    it('should add the user ID when there is one', () => {
      runWithLogContext(createLogContext({ correlationId, userId }), () => {
        expect(logContextMixin()).toEqual({
          trace: { id: correlationId },
          user: { id: userId }
        })
      })
    })

    it('should add the session ID and reference number when there are some', () => {
      const context = createLogContext({
        correlationId,
        userId,
        sessionId,
        referenceNumber
      })

      runWithLogContext(context, () => {
        expect(logContextMixin()).toEqual({
          trace: { id: correlationId },
          user: { id: userId },
          transaction: { id: sessionId },
          span: { id: referenceNumber }
        })
      })
    })
  })

  describe('pino logger', () => {
    it('should write the log context on every log line', () => {
      /** @type {string[]} */
      const lines = []
      const logger = pino(
        {
          base: null,
          timestamp: false,
          mixin: logContextMixin
        },
        { write: (line) => lines.push(line) }
      )

      logger.info('outside')
      runWithLogContext(createLogContext({ correlationId, userId }), () => {
        logger.info('inside %s', 'context')
      })

      expect(lines.map((line) => JSON.parse(line))).toEqual([
        { level: 30, msg: 'outside' },
        {
          level: 30,
          trace: { id: correlationId },
          user: { id: userId },
          msg: 'inside context'
        }
      ])
    })
  })
})
