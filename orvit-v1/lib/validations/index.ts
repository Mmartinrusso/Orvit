// Validation helpers
export { validateRequest } from './helpers';
export {
  trimmedString,
  optionalTrimmedString,
  boundedString,
  sanitizedBoundedString,
  sanitizedOptionalString,
  emailSchema,
  positiveInt,
  optionalPositiveInt,
  positiveNumber,
  nonNegativeNumber,
  isoDateString,
  optionalIsoDateString,
  coercePositiveInt,
  coerceOptionalPositiveInt,
  coerceOptionalNonNegative,
  percentageSchema,
  optionalUrl,
  monthSchema,
} from './helpers';

// Domain schemas
export * from './machines';
export * from './work-orders';
export * from './users';
export * from './products';
export * from './production';
export * from './feedback';
export * from './permissions';
export * from './areas';
export * from './sectors';
export * from './agenda-tasks';
export * from './auth';
export * from './dashboard';
export * from './daily-sessions';
// costs.ts already exists with its own exports
