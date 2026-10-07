import { createLogger, createSilentLogger, redact } from './logger';

function collect(level: 'debug' | 'info' | 'warn' | 'error' = 'debug') {
  const lines: Array<{ line: string; level: string }> = [];
  const logger = createLogger({
    level,
    write: (line, emitted) => lines.push({ line, level: emitted }),
    now: () => new Date('2026-10-07T10:00:00.000Z'),
  });
  return { lines, logger };
}

describe('createLogger', () => {
  it('emits one JSON object per line with timestamp, level and message', () => {
    const { lines, logger } = collect();
    logger.info('booking.created', { bookingId: 'bk_1' });

    expect(lines).toHaveLength(1);
    const record = JSON.parse(lines[0]!.line);
    expect(record).toEqual({
      timestamp: '2026-10-07T10:00:00.000Z',
      level: 'info',
      message: 'booking.created',
      bookingId: 'bk_1',
    });
  });

  it('drops records below the configured level', () => {
    const { lines, logger } = collect('warn');
    logger.debug('noisy');
    logger.info('also noisy');
    logger.warn('important');
    logger.error('broken');
    expect(lines.map((entry) => entry.level)).toEqual(['warn', 'error']);
  });

  it('merges child fields into every record', () => {
    const { lines, logger } = collect();
    logger.child({ requestId: 'req_1' }).child({ userId: 'usr_1' }).info('done');
    expect(JSON.parse(lines[0]!.line)).toMatchObject({ requestId: 'req_1', userId: 'usr_1' });
  });

  it('never writes sensitive values', () => {
    const { lines, logger } = collect();
    logger.info('auth.login', {
      email: 'kim@example.com',
      password: 'hunter2',
      authorization: 'Bearer abc.def.ghi',
      nested: { refreshToken: 'rt_secret', cvv: '123' },
    });
    const line = lines[0]!.line;
    expect(line).not.toContain('hunter2');
    expect(line).not.toContain('rt_secret');
    expect(line).not.toContain('Bearer abc');
    expect(line).not.toContain('"123"');
    expect(line).toContain('kim@example.com');
    expect(line).toContain('[redacted]');
  });

  it('never throws when a field blows up while being read', () => {
    const { lines, logger } = collect();
    const hostile: Record<string, unknown> = {};
    Object.defineProperty(hostile, 'boom', {
      enumerable: true,
      get() {
        throw new Error('getter exploded');
      },
    });
    expect(() => logger.info('hostile', hostile)).not.toThrow();
    expect(JSON.parse(lines[0]!.line)).toMatchObject({
      message: 'hostile',
      logError: 'record not serialisable',
    });
  });

  it('survives circular references by depth-truncating them', () => {
    const { lines, logger } = collect();
    const circular: Record<string, unknown> = { id: 'bk_1' };
    circular.self = circular;
    expect(() => logger.info('circular', circular)).not.toThrow();
    expect(JSON.parse(lines[0]!.line)).toMatchObject({ id: 'bk_1' });
  });
});

describe('redact', () => {
  it('serialises errors with name and message', () => {
    const redacted = redact(new Error('boom')) as Record<string, unknown>;
    expect(redacted).toMatchObject({ name: 'Error', message: 'boom' });
    expect(redacted.stack).toContain('boom');
  });

  it('caps recursion depth', () => {
    let deep: Record<string, unknown> = { value: 'leaf' };
    for (let index = 0; index < 12; index += 1) deep = { nested: deep };
    expect(JSON.stringify(redact(deep))).toContain('[truncated]');
  });

  it('redacts keys that look sensitive regardless of nesting', () => {
    expect(redact({ apiKey: 'k' })).toEqual({ apiKey: '[redacted]' });
    expect(redact({ card_number: '4242' })).toEqual({ card_number: '[redacted]' });
  });
});

describe('createSilentLogger', () => {
  it('does not write anything', () => {
    const logger = createSilentLogger();
    expect(() => logger.error('anything', { secret: 'x' })).not.toThrow();
  });
});
