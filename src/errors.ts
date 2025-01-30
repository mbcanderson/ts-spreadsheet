/**
 * Error thrown when a circular dependency is detected in the formula graph
 */
export class CircularDependencyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CircularDependencyError';
  }
}
