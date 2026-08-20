import { registerDecorator, ValidationArguments, ValidationOptions } from 'class-validator';

/**
 * Cross-field check: fails when this date is later than the one in
 * `otherProperty`. Both sides are YYYY-MM-DD strings of equal width, so a
 * lexicographic compare is also a chronological one and no parsing is needed.
 *
 * Passes when either side is missing or not a string, those cases belong to the
 * per-field validators, and reporting them twice would only muddy the 400.
 */
export function IsNotAfter(
  otherProperty: string,
  validationOptions?: ValidationOptions,
): (object: object, propertyName: string) => void {
  return (object: object, propertyName: string): void => {
    registerDecorator({
      name: 'isNotAfter',
      target: object.constructor,
      propertyName,
      constraints: [otherProperty],
      options: validationOptions,
      validator: {
        validate(value: unknown, args: ValidationArguments): boolean {
          const [other] = args.constraints as [string];
          const otherValue = (args.object as Record<string, unknown>)[other];
          if (typeof value !== 'string' || typeof otherValue !== 'string') return true;
          return value <= otherValue;
        },
        defaultMessage(args: ValidationArguments): string {
          return `${args.property} must not be after ${String(args.constraints[0])}`;
        },
      },
    });
  };
}
