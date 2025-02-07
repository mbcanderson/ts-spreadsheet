import { processRows, CircularDependencyError, RowTemplate, toCsv } from '../';

describe('ts-spreadsheet', () => {
  type BasicInputSchema = [{ name: 'multiplier'; type: number }];

  describe('Basic Example', () => {
    const cellSchema = [
      { name: 'a', type: 'number' },
      { name: 'b', type: 'number' },
    ] as const;

    type InputSchema = [{ name: 'initialValue'; type: number }];

    const template: RowTemplate<typeof cellSchema, InputSchema> = {
      a: {
        type: 'number',
        formula: ({ currRow }) => currRow.b!,
        currRowDependencies: ['b'],
      },
      b: {
        type: 'number',
        formula: ({ prevRow, inputs: { initialValue } }) =>
          prevRow ? prevRow.b + 1 : initialValue,
        currRowDependencies: [],
      },
    };

    test('processes rows correctly', () => {
      const rows = processRows(cellSchema, template, { initialValue: 5 }, 3);
      expect(rows).toEqual([
        { a: 5, b: 5 },
        { a: 6, b: 6 },
        { a: 7, b: 7 },
      ]);
    });
  });

  describe('Advanced Example', () => {
    const loanSchema = [
      { name: 'month', type: 'number' },
      { name: 'payment', type: 'number' },
      { name: 'interestPayment', type: 'number' },
      { name: 'principalPayment', type: 'number' },
      { name: 'remainingBalance', type: 'number' },
    ] as const;

    type LoanInputs = [
      { name: 'loanAmount'; type: number },
      { name: 'annualRate'; type: number },
      { name: 'termMonths'; type: number }
    ];

    const loanTemplate: RowTemplate<typeof loanSchema, LoanInputs> = {
      month: {
        type: 'number',
        formula: ({ prevRow }) => (prevRow?.month ?? 0) + 1,
        currRowDependencies: [],
      },
      payment: {
        type: 'number',
        formula: ({
          prevRow,
          inputs: { loanAmount, annualRate, termMonths },
        }) => {
          if (prevRow) {
            return prevRow.payment;
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
          const balance = prevRow ? prevRow.remainingBalance : loanAmount;
          return (balance * annualRate) / 12;
        },
        currRowDependencies: [],
      },
      principalPayment: {
        type: 'number',
        formula: ({ currRow }) => {
          return currRow.payment! - currRow.interestPayment!;
        },
        currRowDependencies: ['payment', 'interestPayment'],
      },
      remainingBalance: {
        type: 'number',
        formula: ({ prevRow, currRow, inputs: { loanAmount } }) => {
          const previousBalance = prevRow?.remainingBalance ?? loanAmount;
          return previousBalance - currRow.principalPayment!;
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

      expect(schedule).toHaveLength(360);

      expect(schedule[0].month).toEqual(1);
      expect(schedule[0].payment).toBeCloseTo(1013.37, 2);
      expect(schedule[0].interestPayment).toBeCloseTo(750, 2);
      expect(schedule[0].principalPayment).toBeCloseTo(263.37, 2);
      expect(schedule[0].remainingBalance).toBeCloseTo(199736.63, 2);

      expect(schedule[359].month).toEqual(360);
      expect(schedule[359].payment).toBeCloseTo(1013.37, 2);
      expect(schedule[359].interestPayment).toBeCloseTo(3.79, 2);
      expect(schedule[359].principalPayment).toBeCloseTo(1009.58, 2);
      expect(schedule[359].remainingBalance).toBeCloseTo(0, 2);
    });
  });

  describe('Complex Input Type', () => {
    test('handles complex input types correctly', () => {
      const cellSchema = [
        { name: 'col1', type: 'number' },
        { name: 'col2', type: 'string' },
      ] as const;

      interface CustomInterface {
        num: number;
        str: string;
      }
      type InputSchema = [
        { name: 'enumInput'; type: 'a' | 'b' },
        { name: 'customInput'; type: CustomInterface }
      ];

      const template: RowTemplate<typeof cellSchema, InputSchema> = {
        col1: {
          type: 'number',
          formula: ({ inputs: { enumInput, customInput } }) =>
            enumInput === 'a' ? customInput.num : customInput.num * 2,
          currRowDependencies: [],
        },
        col2: {
          type: 'string',
          formula: ({ inputs: { enumInput, customInput } }) =>
            enumInput === 'a' ? customInput.str : customInput.str.toUpperCase(),
          currRowDependencies: [],
        },
      };

      const resultsA = processRows(
        cellSchema,
        template,
        { enumInput: 'a', customInput: { num: 1, str: 'hello' } },
        1
      );
      expect(resultsA[0]).toEqual({ col1: 1, col2: 'hello' });

      const resultsB = processRows(
        cellSchema,
        template,
        { enumInput: 'b', customInput: { num: 1, str: 'hello' } },
        1
      );
      expect(resultsB[0]).toEqual({ col1: 2, col2: 'HELLO' });
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
        BasicInputSchema
      > = {
        base: {
          type: 'number',
          formula: ({ inputs: { multiplier } }) => multiplier * 5,
          currRowDependencies: [],
        },
        intermediate: {
          type: 'number',
          formula: ({ currRow }) => currRow.base! * 2,
          currRowDependencies: ['base'],
        },
        final: {
          type: 'number',
          formula: ({ currRow }) => currRow.intermediate! + currRow.base!,
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
        base: 10,
        intermediate: 20,
        final: 30,
      });
    });

    test('detects circular dependencies', () => {
      const circularSchema = [
        { name: 'a', type: 'number' },
        { name: 'b', type: 'number' },
      ] as const;

      const circularTemplate: RowTemplate<
        typeof circularSchema,
        BasicInputSchema
      > = {
        a: {
          type: 'number',
          formula: ({ currRow }) => currRow.b! + 1,
          currRowDependencies: ['b'],
        },
        b: {
          type: 'number',
          formula: ({ currRow }) => currRow.a! + 1,
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
        BasicInputSchema
      > = {
        current: {
          type: 'number',
          formula: ({ inputs: { multiplier } }) => multiplier * 10,
          currRowDependencies: [],
        },
        withPrevious: {
          type: 'number',
          formula: ({ prevRow, currRow }) => {
            const prevValue = prevRow?.withPrevious || 0;
            const currentValue = currRow.current!;
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

      expect(results.map((row) => row.withPrevious)).toEqual([20, 40, 60, 80]);
    });
  });

  describe('Type Safety', () => {
    test('handles different cell types correctly', () => {
      const mixedSchema = [
        { name: 'number', type: 'number' },
        { name: 'string', type: 'string' },
        { name: 'boolean', type: 'boolean' },
      ] as const;

      type MixedInputSchema = [
        { name: 'textPrefix'; type: string },
        { name: 'threshold'; type: number }
      ];

      const mixedTemplate: RowTemplate<typeof mixedSchema, MixedInputSchema> = {
        number: {
          type: 'number',
          formula: () => 42,
          currRowDependencies: [],
        },
        string: {
          type: 'string',
          formula: ({ inputs: { textPrefix }, currRow }) =>
            `${textPrefix}-${currRow.number!}`,
          currRowDependencies: ['number'],
        },
        boolean: {
          type: 'boolean',
          formula: ({ inputs: { threshold }, currRow }) =>
            currRow.number! > threshold,
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
        number: 42,
        string: 'test-42',
        boolean: true,
      });
    });
  });

  describe('toCsv', () => {
    test('outputs headers in order of cellSchema and rows in the correct order', () => {
      const cellSchema = [
        { name: 'month', type: 'number' },
        { name: 'payment', type: 'number' },
      ] as const;
      const rows = [
        { payment: 100, month: 1 },
        { payment: 200, month: 2 },
        { payment: 350, month: 3 },
      ];

      const csv = toCsv(cellSchema, rows);
      expect(csv).toEqual('month,payment\n1,100\n2,200\n3,350');
    });
  });
});
