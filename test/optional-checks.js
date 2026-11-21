// ---------- ts-code-checks is an optional dependency: a test that needs it skips where it isn't installed ----------
// Load it by a dynamic import, `await import('ts-code-checks/tools/<tool>.js').catch(whenMissing)`: null where it's missing.
export const NOT_INSTALLED = "ts-code-checks isn't installed";

// the error of an import that fails for want of the package → null; any other error is thrown
export function whenMissing(error) {
  if (error.code === 'ERR_MODULE_NOT_FOUND' && error.message.includes('ts-code-checks')) {
    return null;
  }
  throw error;
}
