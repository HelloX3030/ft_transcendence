import { describe, expect, it } from 'vitest';
import chatWindowSource from './ChatWindow.vue?raw';
import chatListBoxSource from './ChatListBox.vue?raw';
import { LONG_MESSAGE_FIXTURES } from '@/lib/chat-fixtures';

/**
 * These assert the presence of three layout classes, not the layout itself.
 *
 * The bug they guard against — an unbreakable token propagating its min-content
 * width up the flex chain until the conversation list collapses — is invisible
 * to jsdom, which does no layout at all: every width there is zero and overflow
 * cannot be observed. It was verified in a real browser engine instead, at 1280
 * and 375 px, across all three fixtures below.
 *
 * What is worth keeping in CI is that nobody quietly drops the classes during a
 * later refactor, since the symptom only shows up with content most test data
 * never contains. Do not mistake this for coverage of the bug.
 */
describe('chat column layout guards', () => {
  it('keeps min-w-0 on the chat window, so it can shrink below its content', () => {
    expect(chatWindowSource).toContain('flex-1 min-w-0 flex-col relative min-h-0');
  });

  it('keeps overflow-x-hidden on the scroll viewport', () => {
    expect(chatWindowSource).toContain('overflow-y-auto overflow-x-hidden');
  });

  it('keeps sm:shrink-0 on the conversation list, so it is never what gives way', () => {
    // Bare shrink-0 would be wrong: below sm the aside is w-full and must stay so.
    expect(chatListBoxSource).toContain('sm:w-80 sm:shrink-0');
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
