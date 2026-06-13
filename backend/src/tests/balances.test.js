const { simplifyDebts } = require('../services/balances');

describe('Debt Simplification Algorithm', () => {
  test('should simplify A owes B and B owes C into A owes C', () => {
    // A: -100, B: 0, C: +100
    const mockBalances = {
      1: { id: 1, name: 'Alice', netBalance: -100.0 },
      2: { id: 2, name: 'Bob', netBalance: 0.0 },
      3: { id: 3, name: 'Charlie', netBalance: 100.0 }
    };

    const settlements = simplifyDebts(mockBalances);
    expect(settlements).toHaveLength(1);
    expect(settlements[0]).toEqual({
      payerId: 1,
      payerName: 'Alice',
      payeeId: 3,
      payeeName: 'Charlie',
      amount: 100.0
    });
  });

  test('should handle complex multi-user balances correctly', () => {
    // Alice owes Bob $50, Bob owes Charlie $30, Charlie owes Alice $10
    // Net: Alice: -40, Bob: +20, Charlie: +20
    const mockBalances = {
      1: { id: 1, name: 'Alice', netBalance: -40.0 },
      2: { id: 2, name: 'Bob', netBalance: 20.0 },
      3: { id: 3, name: 'Charlie', netBalance: 20.0 }
    };

    const settlements = simplifyDebts(mockBalances);
    // Alice should pay Bob $20 and Charlie $20
    expect(settlements).toHaveLength(2);
    
    const aliceToBob = settlements.find(s => s.payeeName === 'Bob');
    const aliceToCharlie = settlements.find(s => s.payeeName === 'Charlie');
    
    expect(aliceToBob.amount).toBe(20.0);
    expect(aliceToBob.payerName).toBe('Alice');
    
    expect(aliceToCharlie.amount).toBe(20.0);
    expect(aliceToCharlie.payerName).toBe('Alice');
  });

  test('should ignore close-to-zero balances', () => {
    const mockBalances = {
      1: { id: 1, name: 'Alice', netBalance: -0.005 },
      2: { id: 2, name: 'Bob', netBalance: 0.005 }
    };

    const settlements = simplifyDebts(mockBalances);
    expect(settlements).toHaveLength(0);
  });
});
