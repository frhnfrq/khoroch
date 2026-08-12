type DateValue = Date | string;

function toDate(value: DateValue) {
  return value instanceof Date ? new Date(value.getTime()) : new Date(value);
}

export function occurredBeforeBalanceTracking(
  occurredAtValue: DateValue,
  openingBalanceAtValue: DateValue,
) {
  const occurredAt = toDate(occurredAtValue);
  const inputPrecisionBoundary = toDate(openingBalanceAtValue);
  if (
    !Number.isFinite(occurredAt.getTime()) ||
    !Number.isFinite(inputPrecisionBoundary.getTime())
  ) {
    return false;
  }

  inputPrecisionBoundary.setSeconds(0, 0);
  return occurredAt < inputPrecisionBoundary;
}
