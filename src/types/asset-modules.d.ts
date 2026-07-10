/** Metro resolves bundled binary assets to a numeric asset-module id. */
declare module '*.db' {
  const assetId: number;
  export default assetId;
}
