/**
 * Extends app.json. When VIALS_CORPUS_BUNDLED=1 (set by the EAS `development`
 * simulator profile in eas.json), the expo-sqlite plugin drops libSQL and the
 * simulator arch fix is removed, so the iOS build keeps an x86_64 slice and
 * runs on Intel-Mac simulators. The JS side must then be served with
 * EXPO_PUBLIC_CORPUS_MODE=bundled so CorpusProvider opens the bundled
 * snapshot instead of the Turso embedded replica.
 */
module.exports = ({ config }) => {
  if (process.env.VIALS_CORPUS_BUNDLED === '1') {
    config.plugins = (config.plugins ?? [])
      .filter((plugin) => plugin !== './plugins/withLibSQLSimulatorArchFix')
      .map((plugin) =>
        Array.isArray(plugin) && plugin[0] === 'expo-sqlite'
          ? ['expo-sqlite', { useLibSQL: false }]
          : plugin,
      );
  }
  return config;
};
