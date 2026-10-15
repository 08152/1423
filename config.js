export const MAP_SIZE = 1000;
export const HALF_MAP = MAP_SIZE / 2;
export const MAX_HEALTH = 100;
export const MAX_SHIELD = 50;
export const HOLD_SECONDS = 1.35;
export const DROP_SECONDS = 3;

// Coordinates are mapped from the supplied 1200x1229 island image to the 3D island.
export const LOCATIONS = [
  { name: 'Frosty Peaks', u: .16, v: .14, biome: 'snow', kind: 'mountain', buildings: 3 },
  { name: 'Snowfall Ridge', u: .77, v: .13, biome: 'snow', kind: 'mountain', buildings: 5 },
  { name: 'Verdant Valley', u: .49, v: .20, biome: 'grass', kind: 'town', buildings: 12 },
  { name: 'The Forge', u: .67, v: .32, biome: 'grass', kind: 'city', buildings: 16 },
  { name: 'Stormy Shores', u: .91, v: .31, biome: 'grass', kind: 'port', buildings: 9 },
  { name: 'Raven Cove', u: .13, v: .34, biome: 'grass', kind: 'port', buildings: 10 },
  { name: 'Shadow Woods', u: .36, v: .37, biome: 'forest', kind: 'forest', buildings: 2 },
  { name: 'Lost Isle', u: .50, v: .41, biome: 'grass', kind: 'island', buildings: 8 },
  { name: 'Rift Rocks', u: .73, v: .46, biome: 'rock', kind: 'rift', buildings: 4 },
  { name: 'Willow Heights', u: .19, v: .58, biome: 'grass', kind: 'village', buildings: 8 },
  { name: 'Sunflower Fields', u: .49, v: .60, biome: 'grass', kind: 'fields', buildings: 8 },
  { name: 'Dusty Dunes', u: .86, v: .57, biome: 'desert', kind: 'town', buildings: 12 },
  { name: 'Neon Heights', u: .13, v: .78, biome: 'grass', kind: 'city', buildings: 16 },
  { name: 'Iron Harbor', u: .44, v: .80, biome: 'industrial', kind: 'port', buildings: 15 },
  { name: 'Iron Woods', u: .70, v: .73, biome: 'forest', kind: 'forest', buildings: 3 },
  { name: 'Crowns Rest', u: .88, v: .86, biome: 'grass', kind: 'village', buildings: 8 }
].map(p => ({ ...p, x: (p.u - .5) * MAP_SIZE, z: (p.v - .5) * MAP_SIZE }));

export const KEY_LOCATIONS = new Set(['Frosty Peaks', 'Snowfall Ridge', 'The Forge', 'Neon Heights', 'Iron Harbor', 'Dusty Dunes']);
