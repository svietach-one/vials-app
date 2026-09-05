'use strict';

/**
 * Combines two upstream custom resolvers that Jest can only apply one of at
 * a time (the "resolver" preset key is a single slot, not a chain):
 *
 * - @react-native/jest-preset's resolver.js: strips `exports` from
 *   react-native's package.json so subpath mocking keeps working (RFC0894
 *   backwards compat).
 * - react-native-worklets/jest/resolver.js: for any module under
 *   react-native-worklets, drops the `.native` extension so Jest resolves
 *   the JS mock implementation instead of the real native turbo module
 *   (which throws "Cannot read properties of undefined (reading
 *   'loadUnpackers')" outside a real native runtime).
 */
module.exports = (request, options) => {
  let resolverOptions = options;

  if (
    options.basedir.includes('react-native-worklets') ||
    request.includes('react-native-worklets')
  ) {
    resolverOptions = {
      ...resolverOptions,
      extensions: resolverOptions.extensions?.filter((ext) => !ext.includes('native')),
    };
  }

  const originalPackageFilter = resolverOptions.packageFilter;
  resolverOptions = {
    ...resolverOptions,
    packageFilter: (pkg) => {
      const filteredPkg = originalPackageFilter ? originalPackageFilter(pkg) : pkg;
      if (filteredPkg.name === 'react-native') {
        delete filteredPkg.exports;
      }
      return filteredPkg;
    },
  };

  return options.defaultResolver(request, resolverOptions);
};
