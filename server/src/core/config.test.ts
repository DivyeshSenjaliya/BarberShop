import { ConfigError, loadConfig, parseEnvFile } from './config';

const productionishEnv = { NODE_ENV: 'production', AUTH_SECRET: 'x'.repeat(40) };

describe('parseEnvFile', () => {
  it('parses key/value pairs and ignores comments and blank lines', () => {
    const parsed = parseEnvFile(
      ['# comment', '', 'PORT=4000', 'HOST="0.0.0.0"', "LOG_LEVEL='warn'", 'BROKEN'].join('\n'),
    );
    expect(parsed).toEqual({
      PORT: '4000',
      HOST: '0.0.0.0',
      LOG_LEVEL: 'warn',
    });
  });

  it('keeps = characters that appear inside the value', () => {
    expect(parseEnvFile('AUTH_SECRET=a=b=c')).toEqual({ AUTH_SECRET: 'a=b=c' });
  });

  it('ignores keys that are not valid identifiers', () => {
    expect(parseEnvFile('1BAD=value')).toEqual({});
  });
});

describe('loadConfig', () => {
  it('applies development defaults', () => {
    const config = loadConfig({});
    expect(config.env).toBe('development');
    expect(config.port).toBe(4000);
    expect(config.auth.accessTokenTtlSeconds).toBe(900);
    expect(config.auth.secret.length).toBeGreaterThanOrEqual(32);
    expect(config.cors.origins).toEqual(['*']);
    expect(config.logLevel).toBe('debug');
  });

  it('coerces numeric strings from the environment', () => {
    const config = loadConfig({ PORT: '8080', RATE_LIMIT_MAX: '50' });
    expect(config.port).toBe(8080);
    expect(config.rateLimit.max).toBe(50);
  });

  it('rejects an out-of-range port with a ConfigError', () => {
    expect(() => loadConfig({ PORT: '70000' })).toThrow(ConfigError);
    expect(() => loadConfig({ PORT: '70000' })).toThrow(/PORT/);
  });

  it('splits and trims the CORS allow-list', () => {
    const config = loadConfig({ CORS_ORIGINS: 'https://a.com, https://b.com ,' });
    expect(config.cors.origins).toEqual(['https://a.com', 'https://b.com']);
  });

  it('requires a strong secret in production', () => {
    expect(() => loadConfig({ NODE_ENV: 'production' })).toThrow(/AUTH_SECRET/);
    expect(() =>
      loadConfig({ NODE_ENV: 'production', AUTH_SECRET: 'short' }),
    ).toThrow(/at least 32/);
  });

  it('refuses wildcard CORS in production', () => {
    expect(() => loadConfig(productionishEnv)).toThrow(/CORS_ORIGINS/);
    expect(() =>
      loadConfig({ ...productionishEnv, CORS_ORIGINS: 'https://app.example.com' }),
    ).not.toThrow();
  });

  it('returns a frozen object so callers cannot mutate config', () => {
    const config = loadConfig({});
    expect(Object.isFrozen(config)).toBe(true);
  });

  it('reports every invalid field at once', () => {
    try {
      loadConfig({ PORT: 'abc', LOG_LEVEL: 'loud', RATE_LIMIT_MAX: '-1' });
      throw new Error('expected loadConfig to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError);
      const message = (error as Error).message;
      expect(message).toContain('PORT');
      expect(message).toContain('LOG_LEVEL');
      expect(message).toContain('RATE_LIMIT_MAX');
    }
  });
});
