import { describe, expect, it } from 'vitest';
import chatMessageSource from './ChatMessage.vue?raw';
import { LONG_MESSAGE_FIXTURES } from '@/lib/chat-fixtures';

/**
 * The layout itself is not testable here. jsdom does no layout — every width is
 * zero and overflow cannot be observed — and this suite runs in plain node, so
 * there is not even a DOM to mount into. Wrapping, the sidebar gap and the
 * conversation list are verified in a real browser engine at 1280 and 375 px.
 *
 * This file used to assert three exact class strings across two components. It
 * guarded a fix that turned out to be at the wrong layer: the app shell, not
 * the chat column, was what collapsed. Those assertions are gone.
 *
 * One guard is worth keeping, because it is the single property everything else
 * rests on and no ordinary test message would ever reveal its absence.
 */
describe('chat message wrapping', () => {
  it('breaks inside an unbreakable token', () => {
    // overflow-wrap: break-word — what the vendored BubbleContent applies — does
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
