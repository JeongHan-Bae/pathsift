/** A relative path that names a parent segment needs an explicit opt-in. */
export function requiresForce(value: string, isAbsolute: (value: string) => boolean) {
  return !isAbsolute(value) && value.split(/[\\/]/).includes('..');
}
