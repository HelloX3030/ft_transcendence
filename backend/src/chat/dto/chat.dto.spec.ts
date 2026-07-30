import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { ChatMsgDto, MESSAGE_MAX_LENGTH } from './chat.dto';

function validate(payload: Record<string, unknown>) {
  const dto = plainToInstance(ChatMsgDto, payload);
  return { dto, errors: validateSync(dto) };
}

const base = { peerUserId: 2, clientMsgId: 'c-1' };

describe('ChatMsgDto', () => {
  it('accepts a normal message', () => {
    const { errors } = validate({ ...base, msg: 'hello' });

    expect(errors).toHaveLength(0);
  });

  it('trims the body before storing it', () => {
    const { dto, errors } = validate({ ...base, msg: '  hello  ' });

    expect(errors).toHaveLength(0);
    expect(dto.msg).toBe('hello');
  });

  it('rejects an empty body', () => {
    expect(validate({ ...base, msg: '' }).errors).not.toHaveLength(0);
  });

  it('rejects a whitespace-only body, which is empty once trimmed', () => {
    expect(validate({ ...base, msg: '   \n\t ' }).errors).not.toHaveLength(0);
  });

  it(`accepts a body of exactly ${MESSAGE_MAX_LENGTH} characters`, () => {
    expect(validate({ ...base, msg: 'a'.repeat(MESSAGE_MAX_LENGTH) }).errors).toHaveLength(0);
  });

  it('rejects one character over the column width, before the database can', () => {
    expect(validate({ ...base, msg: 'a'.repeat(MESSAGE_MAX_LENGTH + 1) }).errors).not.toHaveLength(
      0,
    );
  });

  it('requires a clientMsgId, without which the sender cannot dedup its own echo', () => {
    expect(validate({ peerUserId: 2, msg: 'hello' }).errors).not.toHaveLength(0);
  });
});
