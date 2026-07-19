// Auto-applied Jest manual mock for AsyncStorage (official integration).
// Without it, importing the native module throws "AsyncStorage is null" at
// module load, breaking any suite that transitively imports src/services/storage.
module.exports = require('@react-native-async-storage/async-storage/jest/async-storage-mock');
