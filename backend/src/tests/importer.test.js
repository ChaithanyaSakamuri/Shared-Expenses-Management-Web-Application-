const { parseAndValidateDate, matchUser } = require('../services/importer');

describe('CSV Importer - Date Parsing & Validation', () => {
  test('should parse valid DMY date formats', () => {
    const res = parseAndValidateDate('01-02-2026');
    expect(res.date).toBeInstanceOf(Date);
    expect(res.date.getUTCDate()).toBe(1);
    expect(res.date.getUTCMonth()).toBe(1); // February is month 1 (0-indexed)
    expect(res.date.getUTCFullYear()).toBe(2026);
    expect(res.error).toBeNull();
  });

  test('should identify incomplete year format (e.g. Mar-14)', () => {
    const res = parseAndValidateDate('Mar-14');
    expect(res.date).toBeInstanceOf(Date);
    expect(res.date.getUTCDate()).toBe(14);
    expect(res.date.getUTCMonth()).toBe(2); // March is month 2
    expect(res.error).toBe('incomplete_year');
  });

  test('should flag ambiguous dates (e.g. 04-05-2026)', () => {
    const res = parseAndValidateDate('04-05-2026');
    expect(res.isAmbiguous).toBe(true);
  });

  test('should flag future dates', () => {
    const res = parseAndValidateDate('18-08-2026'); // Today is 13-06-2026
    expect(res.isFuture).toBe(true);
  });
});

describe('CSV Importer - User Name Matching', () => {
  const mockDbUsers = [
    { id: 1, name: 'Aisha', email: 'aisha@example.com' },
    { id: 2, name: 'Rohan', email: 'rohan@example.com' },
    { id: 3, name: 'Priya', email: 'priya@example.com' },
  ];

  test('should match exact name case insensitively', async () => {
    const { matchedUser, suggestion } = await matchUser('aisha', mockDbUsers);
    expect(matchedUser).toEqual(mockDbUsers[0]);
    expect(suggestion).toBeNull();
  });

  test('should clean and match names with trailing spaces', async () => {
    const { matchedUser, suggestion } = await matchUser('rohan ', mockDbUsers);
    expect(matchedUser).toEqual(mockDbUsers[1]);
    expect(suggestion).toBeNull();
  });

  test('should suggest match for name variations (e.g. Priya S)', async () => {
    const { matchedUser, suggestion } = await matchUser('Priya S', mockDbUsers);
    expect(matchedUser).toEqual(mockDbUsers[2]);
    expect(suggestion).toBe('Priya');
  });

  test('should suggest registration for completely new names', async () => {
    const { matchedUser, suggestion } = await matchUser('Kabir', mockDbUsers);
    expect(matchedUser).toBeNull();
    expect(suggestion).toBe('register_user');
  });
});
