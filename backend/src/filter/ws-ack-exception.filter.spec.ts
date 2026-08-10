import { ArgumentsHost, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { WsAckExceptionFilter } from './ws-ack-exception.filter';

/**
 * The argument list a gateway handler is called with: the socket.io adapter
 * invokes it as `callback(data, ack)` with the client bound, and Nest's proxy
 * appends the message pattern.
 */
function hostWith(ack: unknown) {
  const client = { emit: jest.fn() };
  const host = {
    getArgByIndex: (index: number) => [client, { msg: 'hi' }, ack, 'chat'][index],
    switchToWs: () => ({
      getClient: () => client,
      getData: () => ({ msg: 'hi' }),
      getPattern: () => 'chat',
    }),
  } as unknown as ArgumentsHost;

  return { client, host };
}

describe('WsAckExceptionFilter', () => {
  const filter = new WsAckExceptionFilter();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  });

  it('answers the acknowledgement the handler never got to send', () => {
    const ack = jest.fn();

    filter.catch(new ForbiddenException('You are not friends with this user.'), hostWith(ack).host);

    expect(ack).toHaveBeenCalledWith({
      ok: false,
      error: 'You are not friends with this user.',
    });
  });

  it('reports the validation message, not the humanised class name', () => {
    const ack = jest.fn();
    // The shape the validation pipe throws: the useful text is in the response
    // body, while `message` is only ever "Bad Request Exception".
    const exception = new BadRequestException(['A message cannot exceed 2000 characters.']);

    filter.catch(exception, hostWith(ack).host);

    expect(ack).toHaveBeenCalledWith({
      ok: false,
      error: 'A message cannot exceed 2000 characters.',
    });
  });

  it('keeps an unexpected failure vague to the sender', () => {
    const ack = jest.fn();

    filter.catch(new Error('column "body" does not exist'), hostWith(ack).host);

    expect(ack).toHaveBeenCalledWith({
      ok: false,
      error: 'An unknown error occurred while sending this message.',
    });
  });

  it('logs what it cannot classify, since it is answering in Nest’s place', () => {
    const logged = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    const failure = new Error('column "body" does not exist');

    filter.catch(failure, hostWith(jest.fn()).host);

    expect(logged).toHaveBeenCalledWith(failure);
  });

  it('falls back to emitting an exception for an event sent without one', () => {
    const { client, host } = hostWith(undefined);

    filter.catch(new ForbiddenException('nope'), host);

    expect(client.emit).toHaveBeenCalledWith('exception', expect.anything());
  });
});
