import {
  CellSchema,
  InputSchema,
  RowTemplate,
  RowState,
  TypedInputs,
  FormulaContext,
  CellNames,
} from './types';
import { CircularDependencyError } from './errors';

// /**
//  * Creates an empty row state from a template
//  */
// export function createEmptyRowState<Schema extends readonly CellSchema[]>(
//   schema: Schema
// ): RowState<Schema> {
//   const state: Partial<RowState<Schema>> = {};
//   return state;
//   // for (const cell of schema) {
//   // const cellName = cell.name as keyof RowState<Schema>;
//   // state[cellName] = { evaluatedValue: null };
//   // }
//   // return state as RowState<Schema>;
// }

/**
 * Compiles execution order for cells based on dependencies
 */
export function compileExecutionOrder<
  Schema extends readonly CellSchema[],
  ISchema extends readonly InputSchema[]
>(
  template: RowTemplate<Schema, ISchema>,
  schema: Schema
): Array<CellNames<Schema>> {
  const executionOrder: Array<CellNames<Schema>> = [];
  const visited = new Set<CellNames<Schema>>();
  const visiting = new Set<CellNames<Schema>>();

  function visit(cellName: CellNames<Schema>) {
    if (visiting.has(cellName)) {
      throw new CircularDependencyError(
        `Circular dependency detected involving ${String(cellName)}`
      );
    }
    if (visited.has(cellName)) {
      return;
    }

    visiting.add(cellName);
    const cellDef = template[cellName];

    for (const dep of cellDef.currRowDependencies) {
      visit(dep);
    }

    visiting.delete(cellName);
    visited.add(cellName);
    executionOrder.push(cellName);
  }

  for (const { name } of schema) {
    if (!visited.has(name)) {
      visit(name);
    }
  }

  return executionOrder;
}

/**
 * Evaluates a single row based on the execution order
 */
export function evaluateRow<
  Schema extends readonly CellSchema[],
  ISchema extends readonly InputSchema[]
>(
  template: RowTemplate<Schema, ISchema>,
  executionOrder: Array<CellNames<Schema>>,
  rowState: Partial<RowState<Schema>>,
  prevRowState: RowState<Schema> | null,
  inputs: TypedInputs<ISchema>
): void {
  const context: FormulaContext<Schema, ISchema> = {
    prevRow: prevRowState,
    currRow: rowState,
    inputs,
  };

  for (const cellName of executionOrder) {
    const cellDef = template[cellName];
    const result = cellDef.formula(context);
    rowState[cellName] = { evaluatedValue: result };
  }
}

/**
 * Main function to process multiple rows
 */
export function processRows<
  Schema extends readonly CellSchema[],
  ISchema extends readonly InputSchema[]
>(
  schema: Schema,
  template: RowTemplate<Schema, ISchema>,
  inputs: TypedInputs<ISchema>,
  numRows: number
): RowState<Schema>[] {
  const executionOrder = compileExecutionOrder(template, schema);
  const rows: RowState<Schema>[] = [];
  let prevRowState: RowState<Schema> | null = null;

  for (let i = 0; i < numRows; i++) {
    // const newRowState = createEmptyRowState(schema);
    const newRowState: Partial<RowState<Schema>> = {};
    evaluateRow(template, executionOrder, newRowState, prevRowState, inputs);
    const evaluatedRowState = newRowState as RowState<Schema>;
    rows.push(evaluatedRowState);
    prevRowState = evaluatedRowState;
  }

  return rows;
}
