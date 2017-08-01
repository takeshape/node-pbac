module.exports = function ensureArray(obj) {
  return Array.isArray(obj) ? obj : [obj];
};