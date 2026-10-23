import { toE164 } from './phone';

describe('toE164', () => {
  it.each([
    ['9876543210', '+919876543210'],
    ['09876543210', '+919876543210'],
    ['+91 98765 43210', '+919876543210'],
    ['+919876543210', '+919876543210'], // WhatsApp sender "919876543210" after we prefix "+"
    ['0044 20 7946 0958', '+442079460958'],
  ])('%s → %s', (input, expected) => {
    expect(toE164(input)).toBe(expected);
  });

  it('rejects junk', () => {
    expect(toE164('abc')).toBeNull();
    expect(toE164('12345')).toBeNull();
  });
});
