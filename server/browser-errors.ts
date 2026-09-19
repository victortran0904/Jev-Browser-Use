/** A trusted browser precondition failed before any page action was dispatched. */
export class StaleObservationError extends Error {
  readonly dispatched = false;
  constructor() {
    super('Stale browser document or focus; observe again');
    this.name = 'StaleObservationError';
  }
}

/** The model selected no current target; validation sent nothing to the browser. */
export class InvalidActionTargetError extends Error {
  readonly dispatched = false;
  constructor() {
    super('Target is not in the current observation; select an available current item');
    this.name = 'InvalidActionTargetError';
  }
}
