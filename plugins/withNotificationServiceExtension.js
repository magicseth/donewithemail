const { withXcodeProject } = require("@expo/config-plugins");
const path = require("path");
const fs = require("fs");

// Generate a unique 24-character hex ID for Xcode
function generateUuid() {
  return [...Array(24)].map(() => Math.floor(Math.random() * 16).toString(16).toUpperCase()).join('');
}

/**
 * Expo config plugin to add iOS Notification Service Extension
 * This enables rich push notifications with sender avatars
 */
const withNotificationServiceExtension = (config) => {
  config = withXcodeProject(config, async (config) => {
    const xcodeProject = config.modResults;
    const bundleIdentifier = config.ios?.bundleIdentifier || "com.donewithemail.app";
    const appVersion = config.version || "1.0.0";
    const buildNumber = config.ios?.buildNumber || "1";
    const extensionName = "NotificationServiceExtension";
    const extensionBundleId = `${bundleIdentifier}.${extensionName}`;

    // Copy extension files from native/ to ios/
    const projectRoot = config.modRequest.projectRoot;
    const sourceDir = path.join(projectRoot, "native", extensionName);
    const destDir = path.join(config.modRequest.platformProjectRoot, extensionName);

    if (fs.existsSync(sourceDir)) {
      console.log(`[NotificationServiceExtension] Copying files from ${sourceDir} to ${destDir}`);
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }
      const files = fs.readdirSync(sourceDir);
      for (const file of files) {
        fs.copyFileSync(path.join(sourceDir, file), path.join(destDir, file));
        console.log(`[NotificationServiceExtension] Copied ${file}`);
      }
    } else {
      console.warn(`[NotificationServiceExtension] Source directory not found: ${sourceDir}`);
      return config;
    }

    // Check if the extension target already exists
    const existingTarget = xcodeProject.pbxTargetByName(extensionName);
    if (existingTarget) {
      console.log(`[NotificationServiceExtension] Target already exists, skipping...`);
      return config;
    }

    console.log(`[NotificationServiceExtension] Creating extension target...`);

    // Generate UUIDs for all the objects we need to create
    const productFileUuid = generateUuid();
    const swiftFileUuid = generateUuid();
    const swiftBuildFileUuid = generateUuid();
    const infoPlistFileUuid = generateUuid();
    const groupUuid = generateUuid();
    const sourcesBuildPhaseUuid = generateUuid();
    const targetUuid = generateUuid();
    const debugConfigUuid = generateUuid();
    const releaseConfigUuid = generateUuid();
    const configListUuid = generateUuid();
    const embedBuildPhaseUuid = generateUuid();
    const embedBuildFileUuid = generateUuid();
    const targetDependencyUuid = generateUuid();
    const containerItemProxyUuid = generateUuid();

    // Get project object
    const project = xcodeProject.getFirstProject().firstProject;
    const mainTarget = xcodeProject.getFirstTarget();
    const mainTargetUuid = mainTarget.uuid;

    // Get DEVELOPMENT_TEAM from main target's build configuration
    let developmentTeam = '';
    const mainConfigListUuid = mainTarget.firstTarget.buildConfigurationList;
    const configLists = xcodeProject.pbxXCConfigurationList();
    if (configLists && configLists[mainConfigListUuid]) {
      const mainConfigs = configLists[mainConfigListUuid].buildConfigurations;
      if (mainConfigs && mainConfigs.length > 0) {
        const buildConfigs = xcodeProject.pbxXCBuildConfigurationSection();
        const firstConfigUuid = mainConfigs[0].value;
        if (buildConfigs && buildConfigs[firstConfigUuid]) {
          developmentTeam = buildConfigs[firstConfigUuid].buildSettings.DEVELOPMENT_TEAM || '';
          console.log(`[NotificationServiceExtension] Using DEVELOPMENT_TEAM: ${developmentTeam}`);
        }
      }
    }

    // Access the internal hash structure directly
    const objects = xcodeProject.hash.project.objects;

    // 1. Add product reference (the .appex file)
    if (!objects.PBXFileReference) objects.PBXFileReference = {};
    objects.PBXFileReference[productFileUuid] = {
      isa: 'PBXFileReference',
      explicitFileType: 'wrapper.app-extension',
      includeInIndex: 0,
      path: `${extensionName}.appex`,
      sourceTree: 'BUILT_PRODUCTS_DIR',
    };
    objects.PBXFileReference[`${productFileUuid}_comment`] = `${extensionName}.appex`;

    // 2. Add Swift file reference
    objects.PBXFileReference[swiftFileUuid] = {
      isa: 'PBXFileReference',
      lastKnownFileType: 'sourcecode.swift',
      path: 'NotificationService.swift',
      sourceTree: '"<group>"',
    };
    objects.PBXFileReference[`${swiftFileUuid}_comment`] = 'NotificationService.swift';

    // 3. Add Info.plist file reference
    objects.PBXFileReference[infoPlistFileUuid] = {
      isa: 'PBXFileReference',
      lastKnownFileType: 'text.plist.xml',
      path: 'Info.plist',
      sourceTree: '"<group>"',
    };
    objects.PBXFileReference[`${infoPlistFileUuid}_comment`] = 'Info.plist';

    // 4. Create group for extension
    if (!objects.PBXGroup) objects.PBXGroup = {};
    objects.PBXGroup[groupUuid] = {
      isa: 'PBXGroup',
      children: [
        { value: swiftFileUuid, comment: 'NotificationService.swift' },
        { value: infoPlistFileUuid, comment: 'Info.plist' },
      ],
      path: extensionName,
      sourceTree: '"<group>"',
    };
    objects.PBXGroup[`${groupUuid}_comment`] = extensionName;

    // Add group to main group
    const mainGroupUuid = project.mainGroup;
    if (objects.PBXGroup[mainGroupUuid] && objects.PBXGroup[mainGroupUuid].children) {
      objects.PBXGroup[mainGroupUuid].children.push({
        value: groupUuid,
        comment: extensionName,
      });
    }

    // Add product to Products group
    const productsGroupKey = project.productRefGroup;
    if (objects.PBXGroup[productsGroupKey] && objects.PBXGroup[productsGroupKey].children) {
      objects.PBXGroup[productsGroupKey].children.push({
        value: productFileUuid,
        comment: `${extensionName}.appex`,
      });
    }

    // 5. Create build file for Swift (links file to build phase)
    if (!objects.PBXBuildFile) objects.PBXBuildFile = {};
    objects.PBXBuildFile[swiftBuildFileUuid] = {
      isa: 'PBXBuildFile',
      fileRef: swiftFileUuid,
      fileRef_comment: 'NotificationService.swift',
    };
    objects.PBXBuildFile[`${swiftBuildFileUuid}_comment`] = 'NotificationService.swift in Sources';

    // 6. Create Sources build phase with the Swift file
    if (!objects.PBXSourcesBuildPhase) objects.PBXSourcesBuildPhase = {};
    objects.PBXSourcesBuildPhase[sourcesBuildPhaseUuid] = {
      isa: 'PBXSourcesBuildPhase',
      buildActionMask: 2147483647,
      files: [
        { value: swiftBuildFileUuid, comment: 'NotificationService.swift in Sources' },
      ],
      runOnlyForDeploymentPostprocessing: 0,
    };
    objects.PBXSourcesBuildPhase[`${sourcesBuildPhaseUuid}_comment`] = 'Sources';

    // 7. Create build configurations
    console.log(`[NotificationServiceExtension] Using version: ${appVersion}, build: ${buildNumber}`);
    const baseBuildSettings = {
      CLANG_ENABLE_MODULES: 'YES',
      CODE_SIGN_STYLE: 'Automatic',
      CURRENT_PROJECT_VERSION: buildNumber,
      GENERATE_INFOPLIST_FILE: 'NO',
      INFOPLIST_FILE: `${extensionName}/Info.plist`,
      IPHONEOS_DEPLOYMENT_TARGET: '15.0',
      LD_RUNPATH_SEARCH_PATHS: '"$(inherited) @executable_path/Frameworks @executable_path/../../Frameworks"',
      MARKETING_VERSION: appVersion,
      PRODUCT_BUNDLE_IDENTIFIER: extensionBundleId,
      PRODUCT_NAME: '"$(TARGET_NAME)"',
      SKIP_INSTALL: 'YES',
      SWIFT_EMIT_LOC_STRINGS: 'YES',
      SWIFT_VERSION: '5.0',
      TARGETED_DEVICE_FAMILY: '"1,2"',
    };

    // Add DEVELOPMENT_TEAM if we found one
    if (developmentTeam) {
      baseBuildSettings.DEVELOPMENT_TEAM = developmentTeam;
    }

    if (!objects.XCBuildConfiguration) objects.XCBuildConfiguration = {};
    objects.XCBuildConfiguration[debugConfigUuid] = {
      isa: 'XCBuildConfiguration',
      buildSettings: { ...baseBuildSettings, DEBUG_INFORMATION_FORMAT: 'dwarf' },
      name: 'Debug',
    };
    objects.XCBuildConfiguration[`${debugConfigUuid}_comment`] = 'Debug';

    objects.XCBuildConfiguration[releaseConfigUuid] = {
      isa: 'XCBuildConfiguration',
      buildSettings: { ...baseBuildSettings, DEBUG_INFORMATION_FORMAT: '"dwarf-with-dsym"' },
      name: 'Release',
    };
    objects.XCBuildConfiguration[`${releaseConfigUuid}_comment`] = 'Release';

    // 8. Create configuration list
    if (!objects.XCConfigurationList) objects.XCConfigurationList = {};
    objects.XCConfigurationList[configListUuid] = {
      isa: 'XCConfigurationList',
      buildConfigurations: [
        { value: debugConfigUuid, comment: 'Debug' },
        { value: releaseConfigUuid, comment: 'Release' },
      ],
      defaultConfigurationIsVisible: 0,
      defaultConfigurationName: 'Release',
    };
    objects.XCConfigurationList[`${configListUuid}_comment`] = `Build configuration list for PBXNativeTarget "${extensionName}"`;

    // 9. Create the native target
    if (!objects.PBXNativeTarget) objects.PBXNativeTarget = {};
    objects.PBXNativeTarget[targetUuid] = {
      isa: 'PBXNativeTarget',
      buildConfigurationList: configListUuid,
      buildConfigurationList_comment: `Build configuration list for PBXNativeTarget "${extensionName}"`,
      buildPhases: [
        { value: sourcesBuildPhaseUuid, comment: 'Sources' },
      ],
      buildRules: [],
      dependencies: [],
      name: extensionName,
      productName: extensionName,
      productReference: productFileUuid,
      productReference_comment: `${extensionName}.appex`,
      productType: 'com.apple.product-type.app-extension',
    };
    objects.PBXNativeTarget[`${targetUuid}_comment`] = extensionName;

    // Add target to project
    project.targets.push({ value: targetUuid, comment: extensionName });

    // 10. Create container item proxy for dependency
    if (!objects.PBXContainerItemProxy) objects.PBXContainerItemProxy = {};
    objects.PBXContainerItemProxy[containerItemProxyUuid] = {
      isa: 'PBXContainerItemProxy',
      containerPortal: xcodeProject.getFirstProject().uuid,
      containerPortal_comment: 'Project object',
      proxyType: 1,
      remoteGlobalIDString: targetUuid,
      remoteInfo: extensionName,
    };
    objects.PBXContainerItemProxy[`${containerItemProxyUuid}_comment`] = 'PBXContainerItemProxy';

    // 11. Create target dependency
    if (!objects.PBXTargetDependency) objects.PBXTargetDependency = {};
    objects.PBXTargetDependency[targetDependencyUuid] = {
      isa: 'PBXTargetDependency',
      target: targetUuid,
      target_comment: extensionName,
      targetProxy: containerItemProxyUuid,
      targetProxy_comment: 'PBXContainerItemProxy',
    };
    objects.PBXTargetDependency[`${targetDependencyUuid}_comment`] = 'PBXTargetDependency';

    // Add dependency to main target
    const mainTargetObj = objects.PBXNativeTarget[mainTargetUuid];
    if (mainTargetObj && mainTargetObj.dependencies) {
      mainTargetObj.dependencies.push({
        value: targetDependencyUuid,
        comment: 'PBXTargetDependency',
      });
    }

    // 12. Create build file for embedding extension
    objects.PBXBuildFile[embedBuildFileUuid] = {
      isa: 'PBXBuildFile',
      fileRef: productFileUuid,
      fileRef_comment: `${extensionName}.appex`,
      settings: { ATTRIBUTES: ['RemoveHeadersOnCopy'] },
    };
    objects.PBXBuildFile[`${embedBuildFileUuid}_comment`] = `${extensionName}.appex in Embed App Extensions`;

    // 13. Create copy files build phase for embedding
    if (!objects.PBXCopyFilesBuildPhase) objects.PBXCopyFilesBuildPhase = {};
    objects.PBXCopyFilesBuildPhase[embedBuildPhaseUuid] = {
      isa: 'PBXCopyFilesBuildPhase',
      buildActionMask: 2147483647,
      dstPath: '""',
      dstSubfolderSpec: 13, // PlugIns folder
      files: [
        { value: embedBuildFileUuid, comment: `${extensionName}.appex in Embed App Extensions` },
      ],
      name: '"Embed App Extensions"',
      runOnlyForDeploymentPostprocessing: 0,
    };
    objects.PBXCopyFilesBuildPhase[`${embedBuildPhaseUuid}_comment`] = 'Embed App Extensions';

    // Add embed phase to main target
    if (mainTargetObj && mainTargetObj.buildPhases) {
      mainTargetObj.buildPhases.push({
        value: embedBuildPhaseUuid,
        comment: 'Embed App Extensions',
      });
    }

    console.log(`[NotificationServiceExtension] Extension target created successfully`);
    return config;
  });

  return config;
};

module.exports = withNotificationServiceExtension;
