const { withPodfile, withXcodeProject } = require('@expo/config-plugins');

const MARKER = 'EXCLUDED_ARCHS[sdk=iphonesimulator*]';

/**
 * expo-sqlite's vendored libsql.xcframework only ships an arm64 simulator
 * slice (no x86_64) - see node_modules/expo-sqlite/ios/libsql.xcframework/Info.plist.
 * The default RN Podfile still builds iphonesimulator for "arm64 x86_64",
 * so compiling the x86_64 slice fails with "no such module 'libsql'".
 * Excluding x86_64 from simulator builds matches what the xcframework
 * actually supports (Apple Silicon simulators only).
 *
 * Both the Pods project AND the main app's Xcode project need this: if only
 * Pods excludes x86_64, the Pods targets stop producing x86_64 module maps,
 * but the main app target still tries to compile itself for x86_64 and
 * then fails with "module map file ... not found" / "no such module 'Expo'"
 * for every dependency, since it never got a matching x86_64 slice either.
 */
const withLibSQLSimulatorArchFix = (config) => {
  config = withPodfile(config, (config) => {
    if (config.modResults.contents.includes(MARKER)) return config;

    config.modResults.contents = config.modResults.contents.replace(
      /post_install do \|installer\|\n/,
      `post_install do |installer|\n    installer.pods_project.build_configurations.each do |build_configuration|\n      build_configuration.build_settings["${MARKER}"] = "x86_64"\n    end\n\n`,
    );

    return config;
  });

  config = withXcodeProject(config, (config) => {
    // Build setting keys with special chars ([ ] *) must be pre-quoted -
    // the `xcode` package writes object keys verbatim, and an unquoted
    // key here produces a .pbxproj the same package can't re-parse later.
    const quotedKey = `"${MARKER}"`;
    const configurations = config.modResults.pbxXCBuildConfigurationSection();
    for (const key in configurations) {
      if (key.endsWith('_comment')) continue;
      const buildSettings = configurations[key].buildSettings;
      if (buildSettings) buildSettings[quotedKey] = '"x86_64"';
    }
    return config;
  });

  return config;
};

module.exports = withLibSQLSimulatorArchFix;
