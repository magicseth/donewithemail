const { withXcodeProject } = require("@expo/config-plugins");

/**
 * Expo config plugin to set DEVELOPMENT_TEAM on all targets
 * Set DEVELOPMENT_TEAM environment variable to your Apple team ID
 * e.g., DEVELOPMENT_TEAM=ABC123XYZ expo prebuild
 */
const withDevelopmentTeam = (config, { teamId } = {}) => {
  // Get team from config, env var, or leave empty
  const developmentTeam = teamId || process.env.DEVELOPMENT_TEAM || '';

  if (!developmentTeam) {
    console.log('[withDevelopmentTeam] No DEVELOPMENT_TEAM configured. Set via plugin config or DEVELOPMENT_TEAM env var.');
    return config;
  }

  config = withXcodeProject(config, async (config) => {
    const xcodeProject = config.modResults;

    console.log(`[withDevelopmentTeam] Setting DEVELOPMENT_TEAM to: ${developmentTeam}`);

    // Get all build configurations and set DEVELOPMENT_TEAM
    const buildConfigs = xcodeProject.pbxXCBuildConfigurationSection();

    for (const key in buildConfigs) {
      // Skip comment entries
      if (key.endsWith('_comment')) continue;

      const config = buildConfigs[key];
      if (config && config.buildSettings) {
        config.buildSettings.DEVELOPMENT_TEAM = developmentTeam;
      }
    }

    console.log(`[withDevelopmentTeam] DEVELOPMENT_TEAM set successfully`);
    return config;
  });

  return config;
};

module.exports = withDevelopmentTeam;
