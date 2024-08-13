const { CF_DEPS_DEBUG, BIN } = require('./options');

module.exports.log = {

  info: (msg, ...extra) => {
    console.log(`[${BIN} INFO] ${msg}`, ...extra);
  },

  debug: (msg, ...extra) => {
    if (CF_DEPS_DEBUG) {
      console.log(`[${BIN} DEBUG] ${msg}`, ...extra);
    }
  },

  error: (msg, ...extra) => {
    console.log(`[${BIN} ERROR] ${msg}`, ...extra);
  },

};
