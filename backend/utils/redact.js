// Mask credentials that can appear in query strings before a URL is logged.
const SENSITIVE = /([?&](?:token|key|password|apikey|api_key)=)[^&#]*/gi;

function redactUrl(url = '') {
  return String(url).replace(SENSITIVE, '$1[REDACTED]');
}

module.exports = { redactUrl };
