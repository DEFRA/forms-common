import {
  createLogContext,
  getCorrelationId,
  getMessageAttributes,
  getReferenceNumber,
  getSessionId,
  getUserId,
  runWithLogContext,
  runWithMessageLogContext,
  sanitiseId,
  setReferenceNumber,
  setSessionId,
  setUserId
} from '~/src/logging/log-context.js'

describe('log-context', () => {
  const correlationId = '1066e8cc-8e1e-4671-8ad7-b4cd9c95bb94'
  const userId = '86758ba9-92e7-4287-9751-7705e449f0a5'
  const sessionId = 'c3a2e5f4-2b8e-4e1f-9a8d-3f6b7c1d2e9a'
  const referenceNumber = 'ABC-123-DEF'

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
      expect(
        createLogContext({ correlationId, userId, sessionId, referenceNumber })
      ).toEqual({
        correlationId,
        userId,
        sessionId,
        referenceNumber
      })
    })

    it('should generate a correlation ID when none is supplied', () => {
      expect(createLogContext()).toEqual({
        correlationId: expect.stringMatching(/^[0-9a-f-]{36}$/),
        userId: undefined,
        sessionId: undefined,
        referenceNumber: undefined
      })
    })
  })

  describe('runWithLogContext', () => {
    it('should have no context outside of a run', () => {
      expect(getCorrelationId()).toBeUndefined()
      expect(getUserId()).toBeUndefined()
      expect(getSessionId()).toBeUndefined()
      expect(getReferenceNumber()).toBeUndefined()
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

  describe('setSessionId', () => {
    it('should set the session ID on the current context', () => {
      runWithLogContext(createLogContext({ correlationId }), () => {
        setSessionId(sessionId)

        expect(getSessionId()).toBe(sessionId)
      })
    })

    it('should keep the session ID when given no value', () => {
      runWithLogContext(createLogContext({ correlationId, sessionId }), () => {
        setSessionId(null)

        expect(getSessionId()).toBe(sessionId)
      })
    })

    it('should do nothing outside of a context', () => {
      setSessionId(sessionId)

      expect(getSessionId()).toBeUndefined()
    })
  })

  describe('setReferenceNumber', () => {
    it('should set the reference number on the current context', () => {
      runWithLogContext(createLogContext({ correlationId }), () => {
        setReferenceNumber(referenceNumber)

        expect(getReferenceNumber()).toBe(referenceNumber)
      })
    })

    it('should replace unsafe characters', () => {
      runWithLogContext(createLogContext({ correlationId }), () => {
        setReferenceNumber('ABC 123')

        expect(getReferenceNumber()).toBe('ABC_123')
      })
    })

    it('should keep the reference number when given no value', () => {
      runWithLogContext(
        createLogContext({ correlationId, referenceNumber }),
        () => {
          setReferenceNumber(undefined)

          expect(getReferenceNumber()).toBe(referenceNumber)
        }
      )
    })

    it('should do nothing outside of a context', () => {
      setReferenceNumber(referenceNumber)

      expect(getReferenceNumber()).toBeUndefined()
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

    it('should return the session ID and reference number when there are some', () => {
      const context = createLogContext({
        correlationId,
        sessionId,
        referenceNumber
      })

      runWithLogContext(context, () => {
        expect(getMessageAttributes()).toEqual({
          correlationId: { DataType: 'String', StringValue: correlationId },
          sessionId: { DataType: 'String', StringValue: sessionId },
          referenceNumber: { DataType: 'String', StringValue: referenceNumber }
        })
      })
    })
  })

  describe('runWithMessageLogContext', () => {
    it('should use the IDs in the message attributes', () => {
      const message = {
        MessageAttributes: {
          correlationId: { DataType: 'String', StringValue: correlationId },
          userId: { DataType: 'String', StringValue: userId },
          sessionId: { DataType: 'String', StringValue: sessionId },
          referenceNumber: { DataType: 'String', StringValue: referenceNumber }
        }
      }

      const result = runWithMessageLogContext(message, () => [
        getCorrelationId(),
        getUserId(),
        getSessionId(),
        getReferenceNumber()
      ])

      expect(result).toEqual([
        correlationId,
        userId,
        sessionId,
        referenceNumber
      ])
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
})
