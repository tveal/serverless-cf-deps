const { CF_DEPS_DEBUG, BIN } = require('./options');

module.exports.log = {

  info: (msg, extra) => {
    logit(`[${BIN} INFO]`, msg, extra);
  },

  debug: (msg, extra) => {
    if (CF_DEPS_DEBUG) {
      logit(`[${BIN} DEBUG]`, msg, extra);
    }
  },

  error: (msg, extra) => {
    logit(`[${BIN} ERROR]`, msg, extra);
  },

};

function logit(prefix, msg, extra) {
  if (extra) {
    console.log(prefix, msg, extra);
  } else {
    console.log(prefix, msg);
  }
}