# Defra forms common

Cross-cutting framework code shared by the Defra forms services. It is published as `@defra/forms-common`.

## Scope

This project is for cross-cutting framework or framework-like code: code that every service needs in the same form and that knows nothing about forms as a business domain. Request logging and request tracing are examples.

**This project must not depend on any other `forms-*` library**, such as `@defra/forms-model` or `@defra/forms-engine-plugin`. Other forms libraries and services may depend on this project, so a dependency in the other direction would create a cycle.

Code belongs here when all of the following are true:

- it is used, or will be used, by more than one forms service
- it has no knowledge of form definitions, submissions or other domain types
- it needs no other `forms-*` package to work

Code that describes forms (definitions, components, conditions, validation) belongs in `@defra/forms-model`.

## Installation

```shell
npm install @defra/forms-common
```

The service must also install the peer dependencies:

- `@hapi/hapi`
- `pino`

The package is published as ES modules. A service that runs its tests through Babel must add `@defra/forms-common` to the `transformIgnorePatterns` allow list in its Jest configuration.

## What it provides

### Log context

A log context holds the correlation ID and the user ID of the request or queue message being processed. It is kept in an `AsyncLocalStorage`, so code does not have to pass the IDs around or add them to each log call.

Every log line written inside a log context has:

- a `trace.id` property with the correlation ID
- a `user.id` property with the user ID, when a user is known
- the user ID at the start of the message text, as `[uid:<user ID>]`

The user ID is written into the message text because the CDP platform keeps `trace.id` but drops `user.id`. The message text is the only place the user ID can be found in the CDP log viewer.

Always use the user's unique account ID as the user ID. Never use an email address, because it is redacted from the logs.

### Logger set up

Add the mixin and the hook to the pino options of the service:

```javascript
import { addLogContextToMessage, logContextMixin } from '@defra/forms-common'

export const loggerOptions = {
  // ...the service's other pino options
  mixin: logContextMixin,
  hooks: { logMethod: addLogContextToMessage }
}
```

### HTTP requests received by a service

Register the `requestTracing` hapi plugin after the request logger. It starts a log context for every request.

```javascript
import { requestTracing } from '@defra/forms-common'
import { tracing } from '@defra/hapi-tracing'

await server.register({
  plugin: requestTracing,
  options: {
    // Header that carries the correlation ID between services
    tracingHeader: 'x-cdp-request-id',

    // The service's copy of the `@defra/hapi-tracing` plugin
    tracingPlugin: tracing.plugin,

    // Account ID of the authenticated user
    getUserId: (request) => request.auth.credentials.user?.id
  }
})
```

- The correlation ID is read from the tracing header. A new ID is generated when the caller did not send one.
- `tracingPlugin` is registered by this plugin, so the service must not register `@defra/hapi-tracing` itself. `getTraceId` then returns the same correlation ID, including an ID this plugin generated. It is optional.
- `getUserId` is called once the credentials of a request are known. It is optional.
- Call `setUserId(accountId)` when the user only becomes known while the request is handled, for example at sign in.

The plugin wraps two private hapi request methods (`_lifecycle` and `_reply`), the same way `@defra/hapi-tracing` does. Run the tests of this project when upgrading hapi.

### HTTP requests sent to another service

```javascript
import { applyTraceHeaders, applyUserIdHeader } from '@defra/forms-common'

// Adds the correlation ID, so the receiving service logs the same ID
const headers = applyTraceHeaders(options.headers, 'x-cdp-request-id')

// Also tells another forms service which user the call is made for
const headersWithUser = applyUserIdHeader(headers)
```

`applyUserIdHeader` adds the `x-forms-user-id` header (`USER_ID_HEADER`). A receiving service must only trust this header on a request from an authenticated service.

### SNS and SQS messages

The publisher adds the log context to the message attributes:

```javascript
import { getMessageAttributes } from '@defra/forms-common'

await snsClient.send(
  new PublishCommand({
    TopicArn: topicArn,
    Message: JSON.stringify(message),
    MessageAttributes: getMessageAttributes()
  })
)
```

The consumer requests all message attributes and handles each message inside the log context of the message:

```javascript
import { runWithMessageLogContext } from '@defra/forms-common'

const { Messages = [] } = await sqsClient.send(
  new ReceiveMessageCommand({
    QueueUrl: queueUrl,
    MessageAttributeNames: ['All']
  })
)

for (const message of Messages) {
  await runWithMessageLogContext(message, () => handleMessage(message))
}
```

A new correlation ID is generated for a message that has no attributes.

An SQS queue subscribed to an SNS topic only receives the message attributes when raw message delivery is enabled on the subscription.

### Other functions

| Function                         | Purpose                                                            |
| -------------------------------- | ------------------------------------------------------------------ |
| `createLogContext(values)`       | Creates a log context, generating a correlation ID when needed     |
| `runWithLogContext(context, fn)` | Runs a function inside a log context, for example a scheduled task |
| `getCorrelationId()`             | Correlation ID of the current log context                          |
| `getUserId()`                    | User ID of the current log context                                 |
| `setUserId(userId)`              | Sets the user ID on the current log context                        |
| `getLogMessagePrefix()`          | Text added to the start of each log message                        |
| `sanitiseId(value)`              | Restricts an ID to characters that are safe to log and send        |

## Development

The project needs the Node.js version in [.nvmrc](.nvmrc).

```shell
npm ci
```

| Command                | Purpose                                                    |
| ---------------------- | ---------------------------------------------------------- |
| `npm run build`        | Builds the JavaScript and the type declarations to `dist/` |
| `npm test`             | Runs the unit tests with coverage                          |
| `npm run test:watch`   | Runs the unit tests when files change                      |
| `npm run lint`         | Runs EditorConfig, ESLint and the TypeScript compiler      |
| `npm run lint:fix`     | Fixes the ESLint errors that can be fixed automatically    |
| `npm run format`       | Formats the code with Prettier                             |
| `npm run format:check` | Checks the formatting                                      |

Source files are in `src/`, with each test next to the file it tests. Use the `~/src/` alias for imports inside the project. Export everything that services may use from `src/index.js`.

The source is JavaScript. Add types with JSDoc annotations (`@param`, `@returns`, `@typedef`, `@template`) and import types with an `@import` JSDoc block at the end of the file. The TypeScript compiler checks the types and builds the type declarations in `dist/types/`. Type definitions for packages that have none go in `typings/`.

### Dependencies

- Do not add a dependency on another `forms-*` package.
- Do not import a package that keeps state in the module, such as `@defra/hapi-tracing`. Take what is needed from the service as an option instead. A second copy of the package, for example when this project is linked with `npm link`, would have its own state.
- Add a package as a peer dependency when its types are part of the API of this project.
- Keep runtime dependencies to a minimum. Every forms service installs them.

### Using a local copy in a service

```shell
# In this project
npm run build
npm link

# In the service
npm link @defra/forms-common
```

The service uses the files in `dist/`, so run `npm run build` after each change. `npm install` or `npm ci` in the service removes the link.

### Publishing

The [publish workflow](.github/workflows/publish.yml) runs when a change to the source reaches `main`. It increases the patch version, commits the new version and publishes the package to npm.

## Licence

THIS INFORMATION IS LICENSED UNDER THE CONDITIONS OF THE OPEN GOVERNMENT LICENCE found at:

http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3

The following attribution statement MUST be cited in your products and applications when using this information.

> Contains public sector information licensed under the Open Government licence v3

### About the licence

The Open Government Licence (OGL) was developed by the Controller of Her Majesty's Stationery Office (HMSO) to enable information providers in the public sector to license the use and re-use of their information under a common open licence.

It is designed to encourage use and re-use of information freely and flexibly, with only a few conditions.
