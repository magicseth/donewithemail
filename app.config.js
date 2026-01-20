// Dynamic config that uses different bundle identifiers for dev vs production
const { execSync } = require("child_process");

const IS_DEV = process.env.APP_VARIANT === "development";

// Get current git commit hash
let gitCommit = "unknown";
try {
  gitCommit = execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
} catch (e) {
  // Ignore if git not available
}

module.exports = ({ config }) => {
  const bundleIdentifier = IS_DEV ? "com.donewithemail.app.dev" : "com.donewithemail.app";
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
    extra: {
      ...config.extra,
      gitCommit,
    },
  };
};
