const { getDefaultConfig } = require('expo/metro-config');
const { sendFilm } = require('./scripts/media.cjs');

const config = getDefaultConfig(__dirname);
const original = config.server.enhanceMiddleware;
config.server.enhanceMiddleware = (middleware, server) => {
  const next = original ? original(middleware, server) : middleware;
  return (req, res, fallback) => sendFilm(req, res, () => next(req, res, fallback));
};
module.exports = config;
