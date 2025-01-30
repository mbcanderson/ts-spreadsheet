import { processRows, CircularDependencyError, RowTemplate } from '../';

describe('typesheet', () => {
  const basicInputSchema = [{ name: 'multiplier', type: 'number' }] as const;

  describe('Basic Functionality', () => {
    const loanSchema = [
      { name: 'month', type: 'number' },
      { name: 'payment', type: 'number' },
      { name: 'interestPayment', type: 'number' },
      { name: 'principalPayment', type: 'number' },
      { name: 'remainingBalance', type: 'number' },
    ] as const;

    const loanInputs = [
      { name: 'loanAmount', type: 'number' },
      { name: 'annualRate', type: 'number' },
      { name: 'termMonths', type: 'number' },
    ] as const;

    const loanTemplate: RowTemplate<typeof loanSchema, typeof loanInputs> = {
      month: {
        type: 'number',
        formula: ({ prevRow }) => (prevRow?.month.evaluatedValue ?? 0) + 1,
        currRowDependencies: [],
      },
      payment: {
        type: 'number',
        formula: ({
          prevRow,
          inputs: { loanAmount, annualRate, termMonths },
        }) => {
          if (prevRow) {
            return prevRow.payment.evaluatedValue;
          }
          const monthlyRate = annualRate / 12;
          return (
            (loanAmount *
              (monthlyRate * Math.pow(1 + monthlyRate, termMonths))) /
            (Math.pow(1 + monthlyRate, termMonths) - 1)
          );
        },
        currRowDependencies: [],
      },
      interestPayment: {
        type: 'number',
        formula: ({ prevRow, inputs: { annualRate, loanAmount } }) => {
          const balance = prevRow
            ? prevRow.remainingBalance.evaluatedValue
            : loanAmount;
          return (balance * annualRate) / 12;
        },
        currRowDependencies: [],
      },
      principalPayment: {
        type: 'number',
        formula: ({ currRow }) => {
          const payment = currRow.payment?.evaluatedValue ?? 0;
          const interestPayment = currRow.interestPayment?.evaluatedValue ?? 0;
          return payment - interestPayment;
        },
        currRowDependencies: ['payment', 'interestPayment'],
      },
      remainingBalance: {
        type: 'number',
        formula: ({ prevRow, currRow, inputs: { loanAmount } }) => {
          const previousBalance =
            prevRow?.remainingBalance.evaluatedValue ?? loanAmount;
          return previousBalance - currRow.principalPayment!.evaluatedValue!;
        },
        currRowDependencies: ['principalPayment'],
      },
    };

    test('processes rows correctly', () => {
      const schedule = processRows(
        loanSchema,
        loanTemplate,
        { loanAmount: 200000, annualRate: 0.045, termMonths: 360 },
        360
      );


      console.log(schedule);
      expect(schedule).toHaveLength(360);

      expect(schedule[0].month.evaluatedValue).toEqual(1);
      expect(schedule[0].payment.evaluatedValue).toBeCloseTo(1013.37, 2);
      expect(schedule[0].interestPayment.evaluatedValue).toBeCloseTo(750, 2);
      expect(schedule[0].principalPayment.evaluatedValue).toBeCloseTo(263.37, 2);
      expect(schedule[0].remainingBalance.evaluatedValue).toBeCloseTo(199736.63, 2);

      expect(schedule[359].month.evaluatedValue).toEqual(360);
      expect(schedule[359].payment.evaluatedValue).toBeCloseTo(1013.37, 2);
      expect(schedule[359].interestPayment.evaluatedValue).toBeCloseTo(3.79, 2);
      expect(schedule[359].principalPayment.evaluatedValue).toBeCloseTo(1009.58, 2);
      expect(schedule[359].remainingBalance.evaluatedValue).toBeCloseTo(0, 2);
    });
  });

  describe('Dependencies', () => {
    test('handles complex dependencies correctly', () => {
      const complexSchema = [
        { name: 'base', type: 'number' },
        { name: 'intermediate', type: 'number' },
        { name: 'final', type: 'number' },
      ] as const;

      const complexTemplate: RowTemplate<
        typeof complexSchema,
        typeof basicInputSchema
      > = {
        base: {
          type: 'number',
          formula: ({ inputs: { multiplier } }) => multiplier * 5,
          currRowDependencies: [],
        },
        intermediate: {
          type: 'number',
          formula: ({ currRow }) => currRow.base!.evaluatedValue! * 2,
          currRowDependencies: ['base'],
        },
        final: {
          type: 'number',
          formula: ({ currRow }) =>
            currRow.intermediate!.evaluatedValue! +
            currRow.base!.evaluatedValue!,
          currRowDependencies: ['intermediate', 'base'],
        },
      };

      const results = processRows(
        complexSchema,
        complexTemplate,
        { multiplier: 2 },
        1
      );

      expect(results[0]).toEqual({
        base: { evaluatedValue: 10 },
        intermediate: { evaluatedValue: 20 },
        final: { evaluatedValue: 30 },
      });
    });

    test('detects circular dependencies', () => {
      const circularSchema = [
        { name: 'a', type: 'number' },
        { name: 'b', type: 'number' },
      ] as const;

      const circularTemplate: RowTemplate<
        typeof circularSchema,
        typeof basicInputSchema
      > = {
        a: {
          type: 'number',
          formula: ({ currRow }) => currRow.b!.evaluatedValue! + 1,
          currRowDependencies: ['b'],
        },
        b: {
          type: 'number',
          formula: ({ currRow }) => currRow.a!.evaluatedValue! + 1,
          currRowDependencies: ['a'],
        },
      };

      expect(() => {
        processRows(circularSchema, circularTemplate, { multiplier: 2 }, 1);
      }).toThrow(CircularDependencyError);
    });
  });

  describe('Previous Row References', () => {
    test('correctly references previous row values', () => {
      const prevRowSchema = [
        { name: 'current', type: 'number' },
        { name: 'withPrevious', type: 'number' },
      ] as const;

      const prevRowTemplate: RowTemplate<
        typeof prevRowSchema,
        typeof basicInputSchema
      > = {
        current: {
          type: 'number',
          formula: ({ inputs: { multiplier } }) => multiplier * 10,
          currRowDependencies: [],
        },
        withPrevious: {
          type: 'number',
          formula: ({ prevRow, currRow }) => {
            const prevValue = prevRow?.withPrevious.evaluatedValue || 0;
            const currentValue = currRow.current!.evaluatedValue!;
            return prevValue + currentValue;
          },
          currRowDependencies: ['current'],
        },
      };

      const results = processRows(
        prevRowSchema,
        prevRowTemplate,
        { multiplier: 2 },
        4
      );

      expect(results.map((row) => row.withPrevious.evaluatedValue)).toEqual([
        20, 40, 60, 80,
      ]);
    });
  });

  describe('Type Safety', () => {
    test('handles different cell types correctly', () => {
      const mixedSchema = [
        { name: 'number', type: 'number' },
        { name: 'string', type: 'string' },
        { name: 'boolean', type: 'boolean' },
      ] as const;

      const mixedInputSchema = [
        { name: 'textPrefix', type: 'string' },
        { name: 'threshold', type: 'number' },
      ] as const;

      const mixedTemplate: RowTemplate<
        typeof mixedSchema,
        typeof mixedInputSchema
      > = {
        number: {
          type: 'number',
          formula: () => 42,
          currRowDependencies: [],
        },
        string: {
          type: 'string',
          formula: ({ inputs: { textPrefix }, currRow }) =>
            `${textPrefix}-${currRow.number!.evaluatedValue!}`,
          currRowDependencies: ['number'],
        },
        boolean: {
          type: 'boolean',
          formula: ({ inputs: { threshold }, currRow }) =>
            currRow.number!.evaluatedValue! > threshold,
          currRowDependencies: ['number'],
        },
      };

      const results = processRows(
        mixedSchema,
        mixedTemplate,
        { textPrefix: 'test', threshold: 40 },
        1
      );

      expect(results[0]).toEqual({
        number: { evaluatedValue: 42 },
        string: { evaluatedValue: 'test-42' },
        boolean: { evaluatedValue: true },
      });
    });
  });
});
