import { describe, expect, it } from 'vitest';
import { normalizeInstagramInput } from './normalize';

describe('normalizeInstagramInput', () => {
  it('normalizes plain usernames and @handles', () => {
    expect(normalizeInstagramInput('Viewora.Studio')).toEqual({
      ok: true,
      username: 'viewora.studio',
      profileUrl: 'https://www.instagram.com/viewora.studio/',
      inputType: 'username',
    });

    expect(normalizeInstagramInput('  @Aurora_Coffee  ')).toEqual({
      ok: true,
      username: 'aurora_coffee',
      profileUrl: 'https://www.instagram.com/aurora_coffee/',
      inputType: 'handle',
    });
  });

  it('extracts usernames from full and shorthand Instagram URLs', () => {
    expect(
      normalizeInstagramInput('https://www.instagram.com/Nordic.Design/?hl=en')
    ).toEqual({
      ok: true,
      username: 'nordic.design',
      profileUrl: 'https://www.instagram.com/nordic.design/',
      inputType: 'url',
    });

    expect(normalizeInstagramInput('instagram.com/solaris.fitness/')).toEqual({
      ok: true,
      username: 'solaris.fitness',
      profileUrl: 'https://www.instagram.com/solaris.fitness/',
      inputType: 'url',
    });
  });

  it('rejects non-Instagram hosts and reserved paths', () => {
    const wrongHost = normalizeInstagramInput('https://example.com/viewora');
    expect(wrongHost.ok).toBe(false);
    if (!wrongHost.ok) expect(wrongHost.code).toBe('UNSUPPORTED_HOST');

    const postUrl = normalizeInstagramInput('https://instagram.com/p/Cx12345/');
    expect(postUrl.ok).toBe(false);
    if (!postUrl.ok) expect(postUrl.code).toBe('RESERVED_PATH');

    const storyUrl = normalizeInstagramInput('https://instagram.com/stories/viewora/');
    expect(storyUrl.ok).toBe(false);
    if (!storyUrl.ok) expect(storyUrl.code).toBe('RESERVED_PATH');
  });

  it('rejects malformed usernames', () => {
    expect(normalizeInstagramInput('').ok).toBe(false);
    expect(normalizeInstagramInput('.leadingdot').ok).toBe(false);
    expect(normalizeInstagramInput('trailingdot.').ok).toBe(false);
    expect(normalizeInstagramInput('double..dot').ok).toBe(false);
    expect(normalizeInstagramInput('a'.repeat(31)).ok).toBe(false);
    expect(normalizeInstagramInput('bad-hyphen').ok).toBe(false);
  });
});
