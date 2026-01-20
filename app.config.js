// Dynamic config that uses different bundle identifiers for dev vs production
const IS_DEV = process.env.APP_VARIANT === "development";

module.exports = ({ config }) => {
  const bundleIdentifier = IS_DEV ? "com.tokmail.app.dev" : "com.tokmail.app";
  const appName = IS_DEV ? "DoneWith (Dev)" : "DoneWith";

  return {
    ...config,
    name: appName,
    ios: {
      ...config.ios,
      bundleIdentifier,
    },
    android: {
      ...config.android,
      package: bundleIdentifier,
    },
  };
};
