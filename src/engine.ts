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

/**
 * Compiles execution order for cells based on dependencies
 */
export function compileExecutionOrder<
  CSchema extends readonly CellSchema[],
  ISchema extends readonly InputSchema<unknown>[]
>(
  template: RowTemplate<CSchema, ISchema>,
  cellSchema: CSchema
): Array<CellNames<CSchema>> {
  const executionOrder: Array<CellNames<CSchema>> = [];
  const visited = new Set<CellNames<CSchema>>();
  const visiting = new Set<CellNames<CSchema>>();

  function visit(cellName: CellNames<CSchema>) {
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

  for (const { name } of cellSchema) {
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
  CSchema extends readonly CellSchema[],
  ISchema extends readonly InputSchema<unknown>[]
>(
  template: RowTemplate<CSchema, ISchema>,
  executionOrder: Array<CellNames<CSchema>>,
  rowState: Partial<RowState<CSchema>>,
  prevRowState: RowState<CSchema> | null,
  inputs: TypedInputs<ISchema>
): void {
  const context: FormulaContext<CSchema, ISchema> = {
    prevRow: prevRowState,
    currRow: rowState,
    inputs,
  };

  for (const cellName of executionOrder) {
    const cellDef = template[cellName];
    const result = cellDef.formula(context);
    rowState[cellName] = result;
  }
}

/**
 * Main function to process multiple rows
 */
export function processRows<
  CSchema extends readonly CellSchema[],
  ISchema extends readonly InputSchema<unknown>[]
>(
  cellSchema: CSchema,
  template: RowTemplate<CSchema, ISchema>,
  inputs: TypedInputs<ISchema>,
  numRows: number
): RowState<CSchema>[] {
  const executionOrder = compileExecutionOrder(template, cellSchema);
  const rows: RowState<CSchema>[] = [];
  let prevRowState: RowState<CSchema> | null = null;

  for (let i = 0; i < numRows; i++) {
    const newRowState: Partial<RowState<CSchema>> = {};
    evaluateRow(template, executionOrder, newRowState, prevRowState, inputs);
    const evaluatedRowState = newRowState as RowState<CSchema>;
    rows.push(evaluatedRowState);
    prevRowState = evaluatedRowState;
  }

  return rows;
}

/**
 * Converts rows to a CSV string. Maintains the order of the cells as defined in the cellSchema.
 */
export function toCsv<CSchema extends readonly CellSchema[] = readonly CellSchema[]>(
  cellSchema: CSchema,
  rows: RowState<CSchema>[]
) {
  const headers = cellSchema.map((cell) => cell.name) as CellNames<CSchema>[];
  return [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => row[header]).join(',')),
  ].join('\n');
}
