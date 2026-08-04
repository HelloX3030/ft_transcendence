/**
 * Long-message reproduction inputs for the chat layout.
 *
 * Development aid, deliberately not imported by application code: paste one into
 * the message box (as both the signed-in user and the peer — the alignment is
 * what decides which direction the overflow travels) to re-check the layout in
 * seconds instead of reconstructing the inputs.
 *
 * `messages.body` is VarChar(2000) and MESSAGE_MAX_LENGTH allows all of it, so
 * every string here is a legitimate, storable message rather than an abuse case.
 *
 * `words` must always wrap cleanly — spaces give the text a small min-content
 * width. `noSpaces` and `longUrl` are the ones that used to break the layout:
 * an unbreakable token's min-content width is the whole token, and that figure
 * propagated up to the chat column and squeezed the conversation list.
 */
const LOREM = 'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor ';

export const LONG_MESSAGE_FIXTURES = {
  words: LOREM.repeat(40).slice(0, 2000),
  noSpaces: 'a'.repeat(2000),
  longUrl: `https://example.com/${'x'.repeat(280)}`,
};
