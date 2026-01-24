const { withXcodeProject, withInfoPlist } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

/**
 * Expo config plugin to add iOS App Intents support.
 * This enables iOS Shortcuts integration for the app.
 */
const withAppIntents = (config) => {
  // Add URL scheme for deep linking
  config = withInfoPlist(config, (config) => {
    // Add custom URL scheme
    if (!config.modResults.CFBundleURLTypes) {
      config.modResults.CFBundleURLTypes = [];
    }

    // Check if donewith scheme already exists
    const hasScheme = config.modResults.CFBundleURLTypes.some(
      (urlType) => urlType.CFBundleURLSchemes?.includes("donewith")
    );

    if (!hasScheme) {
      config.modResults.CFBundleURLTypes.push({
        CFBundleURLName: "com.donewithemail.app",
        CFBundleURLSchemes: ["donewith"],
      });
    }

    // Add Siri usage description
    config.modResults.NSSiriUsageDescription =
      "DoneWith uses Siri to help you process text and extract calendar events and action items.";

    return config;
  });

  // Add Swift files and configure Xcode project
  config = withXcodeProject(config, async (config) => {
    const xcodeProject = config.modResults;
    const projectRoot = config.modRequest.projectRoot;
    const iosPath = path.join(projectRoot, "ios");
    const appName = config.modRequest.projectName;
    const targetPath = path.join(iosPath, appName);

    // Source files
    const sourceDir = path.join(projectRoot, "native", "AppIntents");
    const intentFile = "SendToDoneWithIntent.swift";

    // Create AppIntents directory in iOS project
    const destDir = path.join(targetPath, "AppIntents");
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    // Copy Swift file
    const sourcePath = path.join(sourceDir, intentFile);
    const destPath = path.join(destDir, intentFile);

    if (fs.existsSync(sourcePath)) {
      fs.copyFileSync(sourcePath, destPath);
      console.log(`[AppIntents] Copied ${intentFile}`);

      // Add file to Xcode project
      const mainGroup = xcodeProject.getFirstProject().firstProject.mainGroup;
      const appGroup = xcodeProject.pbxGroupByName(appName);

      if (appGroup) {
        // Create AppIntents group if it doesn't exist
        let appIntentsGroup = xcodeProject.pbxGroupByName("AppIntents");
        if (!appIntentsGroup) {
          appIntentsGroup = xcodeProject.addPbxGroup([], "AppIntents", "AppIntents");
          xcodeProject.addToPbxGroup(appIntentsGroup.uuid, appGroup.uuid);
        }

        // Add the Swift file to the group and build phases
        const file = xcodeProject.addSourceFile(
          `${appName}/AppIntents/${intentFile}`,
          { target: xcodeProject.getFirstTarget().uuid },
          appIntentsGroup.uuid
        );

        console.log(`[AppIntents] Added ${intentFile} to Xcode project`);
      }
    } else {
      console.warn(`[AppIntents] Source file not found: ${sourcePath}`);
    }

    return config;
  });

  return config;
};

module.exports = withAppIntents;
