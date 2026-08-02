export class FlexpriceError extends Error {
  constructor(message, status = 500, code = 'FLEXPRICE_ERROR', details = null) {
    super(message);
    this.name = 'FlexpriceError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export class FlexpriceValidationError extends FlexpriceError {
  constructor(message, details = null) {
    super(message, 400, 'VALIDATION_ERROR', details);
    this.name = 'FlexpriceValidationError';
  }
}

export class FlexpriceUnauthorizedError extends FlexpriceError {
  constructor(message = 'Unauthorized access to Flexprice API. Check your API key.') {
    super(message, 401, 'UNAUTHORIZED');
    this.name = 'FlexpriceUnauthorizedError';
  }
}

export class FlexpriceNotFoundError extends FlexpriceError {
  constructor(message = 'Requested resource not found in Flexprice') {
    super(message, 404, 'NOT_FOUND');
    this.name = 'FlexpriceNotFoundError';
  }
}

export class FlexpriceNetworkError extends FlexpriceError {
  constructor(message = 'Network error communicating with Flexprice server') {
    super(message, 503, 'NETWORK_ERROR');
    this.name = 'FlexpriceNetworkError';
  }
}

/**
 * Normalizes axios error data into a standard FlexpriceError instance.
 * @param {object} err - The error object returned from client interceptor or catch block.
 * @returns {FlexpriceError} A subclass of FlexpriceError.
 */
export function normalizeFlexpriceError(err) {
  if (err instanceof FlexpriceError) {
    return err;
  }

  const status = err.status || 500;
  const message = err.message || 'Unknown error occurred';
  const details = err.details || null;
  const code = err.code || 'UNKNOWN_ERROR';

  if (code === 'NETWORK_ERROR') {
    return new FlexpriceNetworkError(message);
  }

  switch (status) {
    case 400:
      return new FlexpriceValidationError(message, details);
    case 401:
      return new FlexpriceUnauthorizedError(message);
    case 404:
      return new FlexpriceNotFoundError(message);
    default:
      return new FlexpriceError(message, status, code, details);
  }
}
