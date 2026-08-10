import { ArgumentsHost, Catch, HttpException, Logger } from '@nestjs/common';
import { BaseWsExceptionFilter } from '@nestjs/websockets';
import { ChatAck } from '@cinemates/shared';

/**
 * Answers a socket.io acknowledgement when a gateway handler never got to run.
 *
 * Nest keeps two exception pipelines, and `useGlobalFilters` only fills the HTTP
 * one — the websocket `ExceptionFiltersContext` returns no global metadata, so
 * `HttpExceptionFilter` is invisible to a gateway. Whatever a handler throws for
 * itself it can also catch for itself, but anything thrown *before* the body
 * runs (the validation pipe, a guard) escapes into Nest's default ws filter,
 * which emits an `exception` event and never calls the acknowledgement.
 *
 * A caller awaiting that acknowledgement then waits forever: socket.io only
 * notifies a pending callback on disconnect if it was registered with a timeout,
 * and even a client that does so is left with a timeout in place of the reason.
 * So this converts the escape into the same `{ ok: false, error }` the handlers
 * return, and the send fails visibly instead of hanging.
 */
@Catch()
export class WsAckExceptionFilter extends BaseWsExceptionFilter {
  private readonly logger = new Logger(WsAckExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    // The socket.io adapter invokes a handler as `callback(data, ack)` with the
    // client already bound, and the proxy appends the message pattern — so the
    // arguments are [client, data, ack, pattern]. Events emitted without an
    // acknowledgement have no function here, and there is nothing to answer.
    const ack = host.getArgByIndex<unknown>(2);
    if (typeof ack !== 'function') {
      super.catch(exception, host);
      return;
    }

    if (!(exception instanceof HttpException)) {
      // Nest's own filter logs what it cannot classify; taking over the response
      // means taking over that too, or an unexpected throw leaves no trace.
      this.logger.error(exception);
    }

    const response: ChatAck = { ok: false, error: describe(exception) };
    (ack as (payload: ChatAck) => void)(response);
  }
}

/**
 * The sender-facing reason. `HttpException.message` is not it: the validation
 * pipe passes an array of messages, which leaves `message` as the humanised
 * class name ("Bad Request Exception"), so the useful text has to come out of
 * the response body — the same place `HttpExceptionFilter` reads it from.
 */
function describe(exception: unknown): string {
  if (!(exception instanceof HttpException)) {
    return 'An unknown error occurred while sending this message.';
  }

  const response = exception.getResponse();
  if (typeof response === 'string') return response;

  const message = (response as { message?: unknown }).message;
  if (typeof message === 'string') return message;
  if (Array.isArray(message) && typeof message[0] === 'string') return message.join(' ');

  return exception.message;
}
