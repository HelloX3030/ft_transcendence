/**
 * Long-message inputs for checking the chat layout by hand; not imported by
 * application code. Every string fits MESSAGE_MAX_LENGTH, so all are storable
 * messages. `noSpaces` and `longUrl` are the ones that stress the layout: an
 * unbreakable token's min-content width propagates up to the chat column.
 */
const LOREM = 'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor ';

export const LONG_MESSAGE_FIXTURES = {
  words: LOREM.repeat(40).slice(0, 2000),
  noSpaces: 'a'.repeat(2000),
  longUrl: `https://example.com/${'x'.repeat(280)}`,
};
