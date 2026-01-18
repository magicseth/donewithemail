const { withXcodeProject, withInfoPlist } = require("@expo/config-plugins");
const path = require("path");
const fs = require("fs");

/**
 * Expo config plugin to add iOS Notification Service Extension
 * This enables rich push notifications with sender avatars
 */
const withNotificationServiceExtension = (config) => {
  // Add the extension to the Xcode project
  config = withXcodeProject(config, async (config) => {
    const xcodeProject = config.modResults;
    const projectName = config.modRequest.projectName;
    const bundleIdentifier = config.ios?.bundleIdentifier || "com.sayless.app";
    const extensionName = "NotificationServiceExtension";
    const extensionBundleId = `${bundleIdentifier}.${extensionName}`;
    
    // Check if the extension target already exists
    const existingTarget = xcodeProject.pbxTargetByName(extensionName);
    if (existingTarget) {
      console.log(`[NotificationServiceExtension] Target already exists, skipping...`);
      return config;
    }

    // Create the extension target
    const extensionTarget = xcodeProject.addTarget(
      extensionName,
      "app_extension",
      extensionName,
      extensionBundleId
    );

    // Add source files to the target
    const extensionSourcePath = path.join(
      config.modRequest.platformProjectRoot,
      extensionName
    );

    // Add build phases
    const sourceFiles = ["NotificationService.swift"];
    
    // Create a group for the extension
    const groupKey = xcodeProject.pbxCreateGroup(extensionName, extensionName);
    
    // Get the main group
    const mainGroupKey = xcodeProject.getFirstProject().firstProject.mainGroup;
    xcodeProject.addToPbxGroup(groupKey, mainGroupKey);

    // Add files to the group and build phase
    for (const file of sourceFiles) {
      const filePath = path.join(extensionName, file);
      xcodeProject.addSourceFile(
        filePath,
        { target: extensionTarget.uuid },
        groupKey
      );
    }

    // Add Info.plist
    xcodeProject.addFile(
      `${extensionName}/Info.plist`,
      groupKey,
      { lastKnownFileType: "text.plist.xml" }
    );

    // Configure build settings for the extension
    const configurations = xcodeProject.pbxXCBuildConfigurationSection();
    
    for (const key in configurations) {
      if (typeof configurations[key] === "object" && 
          configurations[key].buildSettings?.PRODUCT_NAME === `"${extensionName}"`) {
        const buildSettings = configurations[key].buildSettings;
        
        buildSettings.SWIFT_VERSION = "5.0";
        buildSettings.TARGETED_DEVICE_FAMILY = '"1,2"';
        buildSettings.INFOPLIST_FILE = `${extensionName}/Info.plist`;
        buildSettings.CODE_SIGN_STYLE = "Automatic";
        buildSettings.DEVELOPMENT_TEAM = "$(DEVELOPMENT_TEAM)";
        buildSettings.IPHONEOS_DEPLOYMENT_TARGET = "13.0";
        buildSettings.PRODUCT_BUNDLE_IDENTIFIER = extensionBundleId;
        buildSettings.SKIP_INSTALL = "YES";
        buildSettings.GENERATE_INFOPLIST_FILE = "NO";
      }
    }

    // Add the extension to the main app's embed frameworks build phase
    xcodeProject.addBuildPhase(
      [],
      "PBXCopyFilesBuildPhase",
      "Embed App Extensions",
      xcodeProject.getFirstTarget().uuid,
      "app_extension"
    );

    return config;
  });

  return config;
};

module.exports = withNotificationServiceExtension;
