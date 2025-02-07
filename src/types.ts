/**
 * Basic value types that can be stored in cells
 */
export type CellType = number | string | boolean;

/**
 * Schema definition for a cell
 */
export interface CellSchema {
  name: string;
  type: 'number' | 'string' | 'boolean';
}

/**
 * Schema definition for an input parameter with generic type support
 */
export interface InputSchema<T> {
  name: string;
  type: T;
}

/**
 * Extract cell names from a schema
 */
export type CellNames<CSchema extends readonly CellSchema[]> =
  CSchema[number]['name'];

/**
 * Extract input names from a schema
 */
export type InputNames<ISchema extends readonly InputSchema<unknown>[]> =
  ISchema[number]['name'];

/**
 * Convert schema type string to concrete TypeScript type
 */
export type ConcreteType<T extends 'number' | 'string' | 'boolean'> =
  T extends 'number'
    ? number
    : T extends 'string'
    ? string
    : T extends 'boolean'
    ? boolean
    : never;

/**
 * Get concrete type for a specific cell from schema
 */
export type CellTypeFromSchema<
  CSchema extends readonly CellSchema[],
  Name extends CellNames<CSchema>
> = ConcreteType<Extract<CSchema[number], { name: Name }>['type']>;

/**
 * Get concrete type from an input schema entry
 */
export type InputTypeFromSchema<
  ISchema extends readonly InputSchema<unknown>[],
  Name extends InputNames<ISchema>
> = Extract<ISchema[number], { name: Name }>['type'];

/**
 * Type-safe inputs object based on input schema
 */
export type TypedInputs<ISchema extends readonly InputSchema<unknown>[]> = {
  [Name in InputNames<ISchema>]: InputTypeFromSchema<ISchema, Name>;
};

/**
 * Runtime state of a cell
 */
export type CellState<T extends CellType = CellType> = T;

/**
 * Context object passed to formulas
 */
export type FormulaContext<
  CSchema extends readonly CellSchema[],
  ISchema extends readonly InputSchema<unknown>[]
> = {
  prevRow: RowState<CSchema> | null;
  currRow: Partial<RowState<CSchema>>;
  inputs: TypedInputs<ISchema>;
};

/**
 * Definition of a cell's behavior
 */
export interface CellDefinition<
  CSchema extends readonly CellSchema[],
  ISchema extends readonly InputSchema<unknown>[],
  Name extends CellNames<CSchema>
> {
  type: Extract<CSchema[number], { name: Name }>['type'];
  formula: (
    context: FormulaContext<CSchema, ISchema>
  ) => CellTypeFromSchema<CSchema, Name>;
  currRowDependencies: Array<CellNames<CSchema>>;
}

/**
 * Template defining the structure of all rows
 */
export type RowTemplate<
  CSchema extends readonly CellSchema[],
  ISchema extends readonly InputSchema<unknown>[]
> = {
  [Name in CellNames<CSchema>]: CellDefinition<CSchema, ISchema, Name>;
};

/**
 * Runtime state of a row
 */
export type RowState<CSchema extends readonly CellSchema[]> = {
  [Name in CellNames<CSchema>]: CellState<CellTypeFromSchema<CSchema, Name>>;
};
