/**
 * Projects how long it takes to pay off a debt under a fixed monthly payment,
 * using standard month-by-month amortization over integer cents.
 *
 * Interest each month = round(balance * monthlyRate), where monthlyRate derives
 * from the APR (basis points). If the payment doesn't cover the first month's
 * interest, the balance never shrinks — reported as infeasible.
 *
 * @param {number} balanceCents current balance (>= 0)
 * @param {number} aprBps annual percentage rate in basis points (e.g. 1999 = 19.99%)
 * @param {number} paymentCents fixed monthly payment (> 0)
 * @returns {{feasible: boolean, months: number|null, totalInterestCents: number|null, totalPaidCents: number|null}}
 */
export function projectPayoff(balanceCents, aprBps, paymentCents) {
  if (balanceCents <= 0) {
    return { feasible: true, months: 0, totalInterestCents: 0, totalPaidCents: 0 };
  }
  if (paymentCents <= 0) {
    return { feasible: false, months: null, totalInterestCents: null, totalPaidCents: null };
  }

  const monthlyRate = aprBps / 10000 / 12;
  let balance = balanceCents;
  let totalInterest = 0;
  let totalPaid = 0;
  let months = 0;
  const MAX_MONTHS = 1200; // 100 years — guards against a non-amortizing payment

  while (balance > 0 && months < MAX_MONTHS) {
    const interest = Math.round(balance * monthlyRate);
    // Payment can't cover interest → principal never falls → infeasible.
    if (paymentCents <= interest) {
      return { feasible: false, months: null, totalInterestCents: null, totalPaidCents: null };
    }
    const pay = Math.min(paymentCents, balance + interest);
    balance = balance + interest - pay;
    totalInterest += interest;
    totalPaid += pay;
    months += 1;
  }

  if (balance > 0) {
    return { feasible: false, months: null, totalInterestCents: null, totalPaidCents: null };
  }

  return { feasible: true, months, totalInterestCents: totalInterest, totalPaidCents: totalPaid };
}
