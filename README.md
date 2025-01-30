# typesheet

A type-safe spreadsheet calculation engine with schema validation. This library provides a framework for defining and executing spreadsheet-like calculations with strong TypeScript type checking.

## Why?

Software engineers spend too much time translating spreadsheets into code. This library helps bridge the gap.

My goal was to build something readable enough that an accountant, lawyer, tax professional, or whichever other person made the spreadsheet and asked it to be implemented in the codebase, could understand it. And, they could go in and modify it themselves if they needed to.

It has some important design decisions and constraints:

- Readability > Performance.
  - It is intended primarily to be easy to understand and translate between spreadsheet and code. It is not primarily intended to be performant.
  - This is probably not the right choice if you are processing millions of rows.
- One template for every row.
  - Every row follows the same template. Each cell in a column has the same formula.
  - You can't have row 5 use a different formula than row 6. You can't have a totals row.
  - If you'd like to add a totals row, do so yourself after calling `processRows`.
- A row must only depend on the prevRow and the currRow.
  - You can't do a vlookup or sum across multiple other rows or other things like that.

## Features

- 🔒 Full TypeScript type safety
- 📐 Schema-based validation for cells and inputs
- 🔄 Automatic execution order based on dependencies
- ⚡ Circular dependency detection
- 💾 A single template, defined and updated just like a spreadsheet is

## Installation

```bash
npm install typesheet
```

## Usage

Here's a basic example:

```typescript
import { processRows } from 'typesheet';

const schema = [
  { name: 'a', type: 'number' },
  { name: 'b', type: 'number' },
] as const;

const inputs = {
  initialValue: 5,
};

const template: RowTemplate<typeof schema, typeof inputs> = {
  a: {
    type: 'number',
    formula: ({ currRow }) => currRow.b,
    currRowDependencies: ['b'],
  },
  b: {
    type: 'number',
    formula: ({ prevRow, inputs: { initialValue } }) =>
      prevRow ? prevRow.b + 1 : initialValue,
    currRowDependencies: [],
  },
};

const rows = processRows(schema, template, inputs, 10);
console.log(rows);
```

And a more complex example:

```typescript
import { processRows } from 'typesheet';

// Calculate monthly loan payments and remaining balance
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
    formula: ({ prevRow }) => (prevRow?.month ?? 0) + 1,
    currRowDependencies: [],
  },
  payment: {
    type: 'number',
    formula: ({ prevRow, inputs: { loanAmount, annualRate, termMonths } }) => {
      if (prevRow) {
        return prevRow.payment;
      }
      const monthlyRate = annualRate / 12;
      return (
        (loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, termMonths))) /
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

const schedule = processRows(
  loanSchema,
  loanTemplate,
  { loanAmount: 200000, annualRate: 0.045, termMonths: 360 },
  360
);
console.log(schedule);
```

## API Documentation

### Types

#### `CellSchema` and `InputSchema`

Define the structure of cells and inputs:

```typescript
interface CellSchema {
  name: string;
  type: 'number' | 'string' | 'boolean';
}

interface InputSchema {
  name: string;
  type: 'number' | 'string' | 'boolean';
}
```

#### `CellDefinition`

Defines a cell's behavior:

```typescript
interface CellDefinition<Schema, ISchema, Name> {
  type: 'number' | 'string' | 'boolean';
  formula: (context: FormulaContext<Schema, ISchema>) => CellType;
  currRowDependencies: Array<CellNames<Schema>>;
}
```

#### `FormulaContext`

Context object passed to formulas. The currRow is a `Partial`, because it is being built up cell by cell.

```typescript
type FormulaContext<Schema, ISchema> = {
  prevRow: RowState<Schema> | null;
  currRow: Partial<RowState<Schema>>;
  inputs: TypedInputs<ISchema>;
};
```

### Functions

#### `processRows`

This is the main function you will call. It processes multiple rows using the provided template and inputs.

```typescript
function processRows<Schema, ISchema>(
  schema: Schema,
  template: RowTemplate<Schema, ISchema>,
  inputs: TypedInputs<ISchema>,
  numRows: number
): RowState<Schema>[];
```

#### `compileExecutionOrder`

You don't need to worry about ordering your cells, typesheet handles it. This function determines the order of cell evaluation based on dependencies. You won't need to call this directly, it is called internally by `processRows`.

```typescript
function compileExecutionOrder<Schema, ISchema>(
  template: RowTemplate<Schema, ISchema>,
  schema: Schema
): Array<CellNames<Schema>>;
```

## Advanced Usage

### Dependency Management

typesheet automatically manages cell dependencies and detects circular references:

```typescript
// This will throw a CircularDependencyError
const circularTemplate = {
  a: {
    type: 'number',
    formula: ({ currRow }) => currRow.b,
    currRowDependencies: ['b']
  },
  b: {
    type: 'number',
    formula: ({ currRow }) => currRow.a,
    currRowDependencies: ['a']
  }
};
```

### Type Safety

typesheet provides strong type checking:

```typescript
// TypeScript will catch these errors:
const invalidTemplate = {
  id: {
    type: 'number',
    formula: () => 'not a number', // Type error!
    currRowDependencies: ['nonexistent'], // Type error!
  },
};

const invalidInputs = {
  multiplier: '2', // Type error: should be number
  notInSchema: true, // Type error: not in schema
};
```

## Error Handling

typesheet includes built-in error types:

```typescript
import { CircularDependencyError } from 'typesheet';

try {
  const results = processRows(schema, inputSchema, template, inputs, 3);
} catch (error) {
  if (error instanceof CircularDependencyError) {
    console.error('Circular dependency detected:', error.message);
  }
}
```

## Contributing

Please feel free to submit a Pull Request or open an issue to discuss what you would like to change.

If you think a lot about spreadsheets and how to embed them in your code, shoot me a DM on LinkedIn. I'd love to work with you.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
