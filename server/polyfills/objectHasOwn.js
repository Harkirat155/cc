const hasOwnProperty = Object.prototype.hasOwnProperty;

export function ensureObjectHasOwn() {
  if (typeof Object.hasOwn === 'function') {
    return Object.hasOwn;
  }

  const hasOwn = function hasOwn(obj, key) {
    return hasOwnProperty.call(Object(obj), key);
  };

  Object.defineProperty(Object, 'hasOwn', {
    value: hasOwn,
    configurable: true,
    enumerable: false,
    writable: true,
  });

  return hasOwn;
}

ensureObjectHasOwn();

export default Object.hasOwn;
