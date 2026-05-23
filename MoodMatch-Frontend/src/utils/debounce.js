/**
 * Returns a debounced version of the given function.
 * Delays invocation until `delay`ms have passed since last call.
 *
 * @param {Function} fn  - Function to debounce
 * @param {number}   delay - Milliseconds to wait (default 400ms)
 */
export function debounce(fn, delay = 400) {
  let timerId = null;

  function debounced(...args) {
    if (timerId) clearTimeout(timerId);
    timerId = setTimeout(() => {
      fn.apply(this, args);
      timerId = null;
    }, delay);
  }

  debounced.cancel = () => {
    if (timerId) {
      clearTimeout(timerId);
      timerId = null;
    }
  };

  return debounced;
}
