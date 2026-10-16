import {
  createLogContext,
  getCorrelationId,
  getLogMessagePrefix,
  getMessageAttributes,
  getUserId,
  runWithLogContext,
  runWithMessageLogContext,
  sanitiseId,
  setUserId
} from '~/src/logging/log-context.js'

describe('log-context', () => {
  const correlationId = '1066e8cc-8e1e-4671-8ad7-b4cd9c95bb94'
  const userId = '86758ba9-92e7-4287-9751-7705e449f0a5'

  describe('sanitiseId', () => {
    it('should keep a safe ID', () => {
      expect(sanitiseId(correlationId)).toBe(correlationId)
    })

    it('should replace unsafe characters', () => {
      expect(sanitiseId('abc] %s\n[def')).toBe('abc___s__def')
    })

    it('should limit the length', () => {
      expect(sanitiseId('a'.repeat(200))).toHaveLength(128)
    })

    it.each([undefined, null, '', 123, ['abc']])(
      'should return undefined for %p',
      (value) => {
        expect(sanitiseId(value)).toBeUndefined()
      }
    )
  })

  describe('createLogContext', () => {
    it('should use the supplied IDs', () => {
      expect(createLogContext({ correlationId, userId })).toEqual({
        correlationId,
        userId
      })
    })

    it('should generate a correlation ID when none is supplied', () => {
      expect(createLogContext()).toEqual({
        correlationId: expect.stringMatching(/^[0-9a-f-]{36}$/),
        userId: undefined
      })
    })
  })

  describe('runWithLogContext', () => {
    it('should have no context outside of a run', () => {
      expect(getCorrelationId()).toBeUndefined()
      expect(getUserId()).toBeUndefined()
      expect(getLogMessagePrefix()).toBe('')
      expect(getMessageAttributes()).toBeUndefined()
    })

    it('should make the context available to asynchronous work', async () => {
      const context = createLogContext({ correlationId, userId })

      const result = await runWithLogContext(context, async () => {
        await new Promise((resolve) => setImmediate(resolve))

        return [getCorrelationId(), getUserId()]
      })

      expect(result).toEqual([correlationId, userId])
    })

    it('should pass arguments to the function', () => {
      const context = createLogContext({ correlationId })
      const fn = jest.fn(
        /**
         * @param {...string} _args
         */
        (..._args) => 'result'
      )

      expect(runWithLogContext(context, fn, 'a', 'b')).toBe('result')
      expect(fn).toHaveBeenCalledWith('a', 'b')
    })
  })

  describe('setUserId', () => {
    it('should set the user ID on the current context', () => {
      runWithLogContext(createLogContext({ correlationId }), () => {
        setUserId(userId)

        expect(getUserId()).toBe(userId)
      })
    })

    it('should keep the user ID when given no value', () => {
      runWithLogContext(createLogContext({ correlationId, userId }), () => {
        setUserId(undefined)

        expect(getUserId()).toBe(userId)
      })
    })

    it('should do nothing outside of a context', () => {
      setUserId(userId)

      expect(getUserId()).toBeUndefined()
    })
  })

  describe('getMessageAttributes', () => {
    it('should return the correlation ID', () => {
      runWithLogContext(createLogContext({ correlationId }), () => {
        expect(getMessageAttributes()).toEqual({
          correlationId: { DataType: 'String', StringValue: correlationId }
        })
      })
    })

    it('should return the user ID when there is one', () => {
      runWithLogContext(createLogContext({ correlationId, userId }), () => {
        expect(getMessageAttributes()).toEqual({
          correlationId: { DataType: 'String', StringValue: correlationId },
          userId: { DataType: 'String', StringValue: userId }
        })
      })
    })
  })

  describe('runWithMessageLogContext', () => {
    it('should use the IDs in the message attributes', () => {
      const message = {
        MessageAttributes: {
          correlationId: { DataType: 'String', StringValue: correlationId },
          userId: { DataType: 'String', StringValue: userId }
        }
      }

      const result = runWithMessageLogContext(message, () => [
        getCorrelationId(),
        getUserId()
      ])

      expect(result).toEqual([correlationId, userId])
    })

    it('should generate a correlation ID for a message without attributes', () => {
      const result = runWithMessageLogContext({}, () => [
        getCorrelationId(),
        getUserId()
      ])

      expect(result).toEqual([
        expect.stringMatching(/^[0-9a-f-]{36}$/),
        undefined
      ])
    })
  })

  describe('getLogMessagePrefix', () => {
    it('should be empty when there is no user ID', () => {
      runWithLogContext(createLogContext({ correlationId }), () => {
        expect(getLogMessagePrefix()).toBe('')
      })
    })

    it('should include the user ID when there is one', () => {
      runWithLogContext(createLogContext({ correlationId, userId }), () => {
        expect(getLogMessagePrefix()).toBe(`[uid:${userId}] `)
      })
    })
  })
})
