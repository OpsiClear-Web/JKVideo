const base = require("./app.json");

function isProductionEnv(env = process.env) {
  return (
    env.EXPO_PUBLIC_APP_ENV === "production" ||
    env.EAS_BUILD_PROFILE === "production" ||
    env.NODE_ENV === "production"
  );
}

function resolveExpoConfig(env = process.env, incomingConfig = {}) {
  const production = isProductionEnv(env);
  const baseExpo = base.expo ?? {};
  const incomingAndroid = incomingConfig.android ?? {};
  const baseAndroid = baseExpo.android ?? {};

  return {
    ...baseExpo,
    ...incomingConfig,
    android: {
      ...baseAndroid,
      ...incomingAndroid,
      usesCleartextTraffic: production ? false : baseAndroid.usesCleartextTraffic === true
    }
  };
}

module.exports = ({ config } = {}) => resolveExpoConfig(process.env, config ?? {});
module.exports.resolveExpoConfig = resolveExpoConfig;
module.exports.isProductionEnv = isProductionEnv;
