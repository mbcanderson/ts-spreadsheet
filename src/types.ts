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
 * Schema definition for an input parameter
 */
export interface InputSchema {
  name: string;
  type: 'number' | 'string' | 'boolean';
}

/**
 * Extract cell names from a schema
 */
export type CellNames<Schema extends readonly CellSchema[]> =
  Schema[number]['name'];

/**
 * Extract input names from a schema
 */
export type InputNames<ISchema extends readonly InputSchema[]> =
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
  Schema extends readonly CellSchema[],
  Name extends CellNames<Schema>
> = ConcreteType<Extract<Schema[number], { name: Name }>['type']>;

/**
 * Get concrete type for a specific input from schema
 */
export type InputTypeFromSchema<
  ISchema extends readonly InputSchema[],
  Name extends InputNames<ISchema>
> = ConcreteType<Extract<ISchema[number], { name: Name }>['type']>;

/**
 * Type-safe inputs object based on input schema
 */
export type TypedInputs<ISchema extends readonly InputSchema[]> = {
  [Name in InputNames<ISchema>]: InputTypeFromSchema<ISchema, Name>;
};

/**
 * Runtime state of a cell
 */
export interface CellState<T extends CellType = CellType> {
  evaluatedValue: T;
}

/**
 * Context object passed to formulas
 */
export type FormulaContext<
  Schema extends readonly CellSchema[],
  ISchema extends readonly InputSchema[]
> = {
  prevRow: RowState<Schema> | null;
  currRow: Partial<RowState<Schema>>;
  inputs: TypedInputs<ISchema>;
};

/**
 * Definition of a cell's behavior
 */
export interface CellDefinition<
  Schema extends readonly CellSchema[],
  ISchema extends readonly InputSchema[],
  Name extends CellNames<Schema>
> {
  type: Extract<Schema[number], { name: Name }>['type'];
  formula: (
    context: FormulaContext<Schema, ISchema>
  ) => CellTypeFromSchema<Schema, Name>;
  currRowDependencies: Array<CellNames<Schema>>;
}

/**
 * Template defining the structure of all rows
 */
export type RowTemplate<
  Schema extends readonly CellSchema[],
  ISchema extends readonly InputSchema[]
> = {
  [Name in CellNames<Schema>]: CellDefinition<Schema, ISchema, Name>;
};

/**
 * Runtime state of a row
 */
export type RowState<Schema extends readonly CellSchema[]> = {
  [Name in CellNames<Schema>]: CellState<CellTypeFromSchema<Schema, Name>>;
};
