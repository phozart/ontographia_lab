// Stand-in for Node built-ins in browser bundles (see next.config.js). pptxgenjs imports node:fs and node:https only
// behind a runtime "is this Node" check, so this module is never executed in the browser.
module.exports = {};
