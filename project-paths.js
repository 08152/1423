/*
 * Flat-project path registry.
 * This release has no subfolders; planned locations are files in Welten/ once the folders are introduced.
 */
export const PROJECT_PATHS = Object.freeze({
  mapImage: './island-map.jpeg',
  modelBaseNow: './',
  modelBasePlanned: './Models/',
  worldsBaseNow: './',
  worldsBasePlanned: './Welten/',
  futureRegionFiles: Object.freeze([
    'FrostyPeaks.js', 'VerdantValley.js', 'SnowfallRidge.js', 'TheForge.js',
    'StormyShores.js', 'RavenCove.js', 'ShadowWoods.js', 'LostIsle.js',
    'RiftRocks.js', 'WillowHeights.js', 'SunflowerFields.js', 'DustyDunes.js',
    'NeonHeights.js', 'IronHarbor.js', 'IronWoods.js', 'CrownsRest.js'
  ])
});

export function assetUrl(filename, kind = 'root') {
  const base = kind === 'model' ? PROJECT_PATHS.modelBaseNow : kind === 'world' ? PROJECT_PATHS.worldsBaseNow : './';
  return `${base}${String(filename).replace(/^\/+/, '')}`;
}
