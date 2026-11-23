// The story of LA VEGA. Jax Vega, a driver fresh off the ferry, works for
// La Rosa, the fixer who runs the club on Marlin Row. Five jobs, all original.

const MISSIONS = [
  {
    id: 1,
    name: 'First Wheels',
    giver: 'La Rosa',
    intro: "La Rosa: 'Jax, baby, you need wheels. Lift a parked car and bring it to Manny's Garage. Don't scratch it... much.'",
    reward: 300,
    steps: [
      { type: 'steal', text: 'Steal a parked car (press E near one)', marker: null },
      { type: 'deliver', text: "Drive it to Manny's Garage", marker: PLACES.garage, needCar: true },
    ],
    onComplete: 'Nice wheels. La Rosa slips you a pistol and $300. Welcome to La Vega.',
  },
  {
    id: 2,
    name: 'Dock Run',
    giver: 'La Rosa',
    intro: "La Rosa: 'A package is waiting at Pier 9. Fetch it, bring it to the club. The bay cops are jumpy today — expect company.'",
    reward: 500,
    steps: [
      { type: 'reach', text: 'Pick up the package at Pier 9', marker: PLACES.pierPickup },
      { type: 'deliver', text: "Deliver the package to La Rosa's Club", marker: PLACES.club },
    ],
    onComplete: 'Package delivered. $500, and La Rosa owes you one.',
  },
  {
    id: 3,
    name: 'Shake the Tail',
    giver: 'La Rosa',
    intro: "La Rosa: 'You are HOT, Jax. Two stars and climbing. Lose the cops — hide, lay low, make them give up.'",
    reward: 400,
    steps: [
      { type: 'evade', text: 'Lose your wanted level — stay out of sight', marker: null },
    ],
    onComplete: 'Clean. The heat is off. $400 for keeping your cool.',
  },
  {
    id: 4,
    name: 'Warehouse Payback',
    giver: 'La Rosa',
    intro: "La Rosa: 'The Vultures torched my warehouse. Go to the old cannery and settle it. Bring the pistol — bring all of it.'",
    reward: 700,
    steps: [
      { type: 'reach', text: 'Get to the Old Cannery Warehouse', marker: PLACES.warehouse },
      { type: 'killAll', text: 'Deal with the Vultures (4 rivals)', marker: PLACES.warehouse },
    ],
    onComplete: 'Warehouse payback, done. $700 and the Vultures are yesterday\'s news.',
  },
  {
    id: 5,
    name: 'The La Vega Score',
    giver: 'La Rosa',
    intro: "La Rosa: 'One last run, Jax. Five drops across the whole city before the clock runs out. Drive like the sun is chasing you.'",
    reward: 1200,
    steps: [
      { type: 'checkpoint', text: 'Checkpoint 1/5 — Marina Gate', marker: { x: 520, y: 520 }, time: 150 },
      { type: 'checkpoint', text: 'Checkpoint 2/5 — Palm Court Park', marker: { x: 1040, y: 780 }, time: 150 },
      { type: 'checkpoint', text: 'Checkpoint 3/5 — La Vega General', marker: { x: 2080, y: 520 }, time: 150 },
      { type: 'checkpoint', text: 'Checkpoint 4/5 — South Docks', marker: { x: 520, y: 2340 }, time: 150 },
      { type: 'checkpoint', text: 'Final drop — La Rosa\'s Club', marker: PLACES.club, time: 150 },
    ],
    onComplete: 'THE LA VEGA SCORE! $1,200. You own this city, Jax Vega.',
  },
];

function currentStep(mission) {
  if (!mission || mission.index < 0) return null;
  const def = MISSIONS[mission.index];
  return def.steps[mission.step] ?? null;
}

function objectiveText(state) {
  if (state.mission.index < 0) {
    if (state.missionAvailable >= MISSIONS.length) return 'All jobs done — La Vega is yours. Free roam!';
    const next = MISSIONS[state.missionAvailable];
    return `Next job: ${next.name} — visit La Rosa at the club (press E)`;
  }
  const def = MISSIONS[state.mission.index];
  const step = currentStep(state.mission);
  return `${def.name} — ${step ? step.text : ''}`;
}
