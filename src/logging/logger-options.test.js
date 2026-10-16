import { pino } from 'pino'

import {
  createLogContext,
  runWithLogContext
} from '~/src/logging/log-context.js'
import {
  addLogContextToMessage,
  logContextMixin
} from '~/src/logging/logger-options.js'

describe('logger-options', () => {
  const correlationId = '1066e8cc-8e1e-4671-8ad7-b4cd9c95bb94'
  const userId = '86758ba9-92e7-4287-9751-7705e449f0a5'

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
  })

  describe('addLogContextToMessage', () => {
    const prefix = `[uid:${userId}]`
    const logger = /** @type {Logger} */ ({})
    const method = jest.fn()

    /**
     * @param {...unknown} args
     */
    function log(...args) {
      const inputArgs = /** @type {Parameters<LogFn>} */ (args)

      runWithLogContext(createLogContext({ correlationId, userId }), () => {
        addLogContextToMessage.call(logger, inputArgs, method)
      })

      return method.mock.calls.at(-1)
    }

    it('should leave the arguments unchanged outside of a context', () => {
      addLogContextToMessage.call(logger, ['message'], method)

      expect(method.mock.contexts[0]).toBe(logger)
      expect(method).toHaveBeenCalledWith('message')
    })

    it('should leave the arguments unchanged when there is no user ID', () => {
      runWithLogContext(createLogContext({ correlationId }), () => {
        addLogContextToMessage.call(logger, ['message'], method)
      })

      expect(method).toHaveBeenCalledWith('message')
    })

    it('should prefix a message', () => {
      expect(log('message %s', 'value')).toEqual([
        `${prefix} message %s`,
        'value'
      ])
    })

    it('should prefix a message that follows an object', () => {
      const obj = { key: 'value' }

      expect(log(obj, 'message')).toEqual([obj, `${prefix} message`])
    })

    it('should prefix the message of an error', () => {
      const err = new Error('failure')

      expect(log(err)).toEqual([err, `${prefix} failure`])
      expect(log({ err })).toEqual([{ err }, `${prefix} failure`])
    })

    it('should add a message to an object without one', () => {
      const obj = { key: 'value' }

      expect(log(obj)).toEqual([obj, prefix])
    })

    it('should leave an object with its own message unchanged', () => {
      expect(log({ msg: 'message' })).toEqual([{ msg: 'message' }])
      expect(log({ message: 'message' })).toEqual([{ message: 'message' }])
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
          mixin: logContextMixin,
          hooks: { logMethod: addLogContextToMessage }
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
          msg: `[uid:${userId}] inside context`
        }
      ])
    })
  })
})

/**
 * @import { LogFn, Logger } from 'pino'
 */
