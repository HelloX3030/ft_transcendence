import { describe, expect, it } from 'vitest';
import chatMessageSource from './ChatMessage.vue?raw';
import { LONG_MESSAGE_FIXTURES } from '@/lib/chat-fixtures';

/**
 * The layout itself is not testable here: jsdom does no layout, and this suite
 * runs in plain node with no DOM to mount into. Wrapping, the sidebar gap and the
 * conversation list are verified in a real browser engine at 1280 and 375 px. The
 * one guard kept here is the property all of that rests on.
 */
describe('chat message wrapping', () => {
  it('breaks inside an unbreakable token', () => {
    // overflow-wrap: break-word, what the vendored BubbleContent applies, does
    // not reduce min-content width, so a 2000-character token keeps its full
    // width in layout and is merely clipped. Only `anywhere` actually wraps it.
    expect(chatMessageSource).toContain('wrap-anywhere');
  });
});

describe('long-message fixtures', () => {
  it('stay within the 2000-character column the backend accepts', () => {
    for (const body of Object.values(LONG_MESSAGE_FIXTURES)) {
      expect(body.length).toBeLessThanOrEqual(2000);
    }
  });

  it('covers both a breakable and an unbreakable 2000-character message', () => {
    expect(LONG_MESSAGE_FIXTURES.words).toHaveLength(2000);
    expect(LONG_MESSAGE_FIXTURES.noSpaces).toHaveLength(2000);
    expect(LONG_MESSAGE_FIXTURES.noSpaces).not.toContain(' ');
    expect(LONG_MESSAGE_FIXTURES.longUrl).not.toContain(' ');
  });
});
