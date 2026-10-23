import { pickRule } from './routing.logic';

// Path for GR Block / Floor 2 / Lab 205, most specific first.
const path = ['lab205', 'floor2', 'grBlock', 'campus'];

describe('routing — most specific rule wins (PDF §9)', () => {
  it('exact lab rule beats the building rule', () => {
    const rules = [
      { id: 'building', locationId: 'grBlock' },
      { id: 'lab', locationId: 'lab205' },
    ];
    expect(pickRule(path, rules)?.id).toBe('lab');
  });

  it('falls back to the building when the lab has no rule', () => {
    expect(pickRule(['lab206', 'floor2', 'grBlock', 'campus'], [{ id: 'building', locationId: 'grBlock' }])?.id).toBe('building');
  });

  it('falls back to the campus', () => {
    expect(pickRule(path, [{ id: 'campus', locationId: 'campus' }])?.id).toBe('campus');
  });

  it('no match → null (unassigned queue)', () => {
    expect(pickRule(path, [{ id: 'other', locationId: 'gehuBlock' }])).toBeNull();
  });
});
