// LA VEGA — configuration. All original: a sun-baked coastal city, La Vega.
// No external assets, no network requests, plain canvas 2D.
const STEP = 1 / 60;
const SAVE_KEY = 'la-vega-save-v1';

const WORLD = {
  size: 2600,
  seaX: 150, // x < 150 is sea
  sandX: 300, // 150..300 is sand beach
  roadWidth: 70,
  sidewalk: 16,
};

// Road centre lines (both axes). Blocks sit between consecutive roads.
const ROADS = [390, 650, 910, 1170, 1430, 1690, 1950, 2210, 2470];

// Warm daytime palette.
const PALETTE = {
  grass: '#8fce62',
  grassDark: '#7cc155',
  sand: '#f2d492',
  sandWet: '#e3c07e',
  sea: '#2f9fd8',
  seaDeep: '#1e7fc0',
  road: '#3d4149',
  roadLine: '#f5d76e',
  sidewalk: '#c9c2b4',
  curb: '#a89f8d',
  buildingRoofs: ['#e2725b', '#f2a541', '#5b8dd9', '#e25f7a', '#7fb069', '#c96fd6', '#f27d4a', '#4ecdc4', '#ffd166', '#ef476f'],
  buildingWall: '#f5efe4',
  park: '#69b455',
  pond: '#5fb8d9',
  pier: '#a97c50',
  pierDark: '#8a5f3c',
};

// Key places in La Vega (all original names).
const PLACES = {
  club: { x: 1560, y: 1040, name: "La Rosa's Club" },
  garage: { x: 780, y: 1560, name: "Manny's Garage" },
  warehouse: { x: 520, y: 2080, name: 'Old Cannery Warehouse' },
  hospital: { x: 2080, y: 520, name: 'La Vega General' },
  pierPickup: { x: 82, y: 1300, name: 'Pier 9 Drop' },
  dock: { x: 235, y: 1300, name: 'The Docks' },
  park: { x: 1040, y: 780, name: 'Palm Court Park' },
  beach: { x: 230, y: 780, name: 'La Vega Beach' },
};

// Car models: length, width, accel, top speed, turn rate, base colours.
const CAR_MODELS = {
  sedan: { len: 50, wid: 23, accel: 300, top: 330, turn: 2.7, colors: ['#d94f3d', '#3d7dd9', '#e8e8e8', '#5a5a66', '#e0a13c'] },
  taxi: { len: 50, wid: 23, accel: 290, top: 320, turn: 2.7, colors: ['#f7c948'] },
  truck: { len: 66, wid: 27, accel: 190, top: 250, turn: 1.9, colors: ['#7a8a99', '#b0653a', '#4e7a51'] },
  sport: { len: 47, wid: 22, accel: 430, top: 450, turn: 3.2, colors: ['#e01e37', '#ff8c1a', '#22c3aa'] },
  police: { len: 52, wid: 24, accel: 360, top: 420, turn: 3.0, colors: ['#20242c'] },
};

const PLAYER = {
  radius: 13,
  walk: 175,
  run: 290,
  punchRange: 46,
  punchDamage: 34,
};

const WANTED_MAX = 5;
