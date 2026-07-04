function bindBtn(id, callback) {
    const el = document.getElementById(id);
    if (!el) return;
    const action = (e) => {
        if (e) { e.stopPropagation(); e.preventDefault(); }
        callback(e);
    };
    el.addEventListener('pointerdown', action);
    el.addEventListener('touchstart', action);
    el.addEventListener('click', action);
}

const width = window.innerWidth, height = window.innerHeight;
let score = 0, health = 5, maxHealth = 5, wave = 1, gameState = 'menu', frameCount = 0;
let liquidationCount = 0;
let hull = 500, maxHull = 500, people = 300000, maxPeople = 300000;
let shieldLayers = 1, maxShieldLayers = 3, specialShieldLayers = 0, usedContinueThisNode = false;
let spawnTimer = 0, fireTimer = 0, isFiring = false, firingPointerId = -1;
let combo = 1, lastKillTime = 0;
let invincible = 0;
let specialWeapon = null, cannonWeapon = null, weaponTimer = 0;
const LASER_GRID = new Map();
let boss = null, swarmTimer = 8 + Math.random() * 4, waveAnnounce = 0, waveTimer = 0, spawnAggression = 1, hardcoreBlockTimer = 0;
const killQueue = [];
const KILL_BATCH = 1000;
const bossMinis = [];
const bossSwarm = [];
const miniBosses = [];
const uniqueEnemyDefs = [];
const beamLasers = [];
const mines = [];
const zones = [];
const satellites = [];
const tethers = [];
let beamGraphic = null;
let bossTendril = null;
let difficulty = 'normal';
let superWaveTimer = 0;
let swarmStateRemaining = 0;
let swarmSpawnTimer = 0;
let gameOverTime = 0, deathScore = 0, deathWave = 0, deathTime = 0, deathDiff = 'normal';
let weaponLevels = { cannon:1, spread:0, rapid:0, pierce:0, blast:0, beam:0, bolt:0, homing:0, saber:0 };
let weaponAmmo = 0, weaponMaxAmmo = 0, weaponTimerMs = 0, weaponMaxTimerMs = 0;
let dialSide = 'L', zoom = 1, zoomScale = 1;
function bgmTrack(idx) { if (window.bgmEngine) try { window.bgmEngine.switchTrack(idx); } catch(e) {} }
let encounterScrollTimer = 0;
function setZoom(z) {
  zoom = z;
  zoomScale = z;
  if (gameC) {
    gameC.scale.set(z);
    gameC.x = width * (1 - z) / 2;
    gameC.y = height * (1 - z) / 2;
  }
}
let ownedWeapons = [], activeWeapon = null, dialScroll = 0;
let gameStartTime = 0, bossEncounter = 0, bossInterval = 5;
let leaderboard = [];
try { leaderboard = JSON.parse(localStorage.getItem('cb_leaderboard')) || []; } catch(e) {}
function saveLeaderboard() {
  leaderboard.sort((a,b) => b.score - a.score);
  if (leaderboard.length > 100) leaderboard.length = 100;
  try { localStorage.setItem('cb_leaderboard', JSON.stringify(leaderboard)); } catch(e) {}
}

const DIFF = {
    easy:   { dropChance:0.7, hpMul:0.02, spdMul:0.75, fireMul:1.5, spawnMul:0.5, maxEnemies:200, health:8, dmgMul:0.8, rangeMul:1.0, aggressiveness:0.7, enemyFireRate:0.8, weaponTime:5, waveMul:1.4, mapScale:0.1, desc:'easier but enemies still fight back' },
    normal: { dropChance:0.4, hpMul:0.15, spdMul:0.85, fireMul:0.8, spawnMul:0.9, maxEnemies:400, health:5,  dmgMul:1.0, rangeMul:1.0, aggressiveness:1.0, enemyFireRate:1.1, weaponTime:4, waveMul:1.0, mapScale:0.25, desc:'balanced challenge' },
    hard:   { dropChance:0.4, hpMul:0.15, spdMul:0.85, fireMul:0.8, spawnMul:0.9, maxEnemies:400,health:5,  dmgMul:1.0, rangeMul:1.0, aggressiveness:1.0, enemyFireRate:1.1, weaponTime:4, waveMul:0.8, mapScale:0.5, desc:'tougher enemies' },
    hardcore: { dropChance:0.375, hpMul:0.35, spdMul:1.0, fireMul:0.7, spawnMul:1.2, maxEnemies:600, health:3, dmgMul:1.2, rangeMul:0.8, aggressiveness:1.2, enemyFireRate:1.3, weaponTime:4, waveMul:0.65, mapScale:1.0, desc:'HARDCORE: dense advancing swarms' }
  };

let CANNON_BASE_Y = height - 44;
const CANNON_X = width / 2;
const CANNON_MARGIN = 40;
const AIM_SMOOTH = 0.06;
const LASER_SPEED = 650;
let MAX_ENEMIES = 600;
const MAX_LASERS = 3000;
const AIM_ARC_RANGE = Math.PI * 0.9;
const AIM_ARC_START = -Math.PI / 2 - AIM_ARC_RANGE / 2;
const AIM_ARC_END = -Math.PI / 2 + AIM_ARC_RANGE / 2;
const ENEMY_BULLET_SPEED = 140;
const CANNON_SLIDE_SPEED = 0.08;

const cannon = { x: CANNON_X, y: CANNON_BASE_Y, angle: -Math.PI / 2, targetAngle: -Math.PI / 2 };
let aimFocusX = width / 2, aimFocusY = CANNON_BASE_Y, touchOffsetY = 0;

const WEAPONS = {
  cannon: { name:'CANNON', color:0x44ffff, dur:999, desc:'Default blaster - auto-fire, levels with wave', wepMul:1, shieldMul:1 },
  spread: { name:'SPREAD', color:0xff8800, dur:12, desc:'Multi-shot spread', wepMul:0.8, shieldMul:1.5 },
  rapid:  { name:'RAPID',  color:0xff0088, dur:8,  desc:'Rapid multi-shot volley', wepMul:0.6, shieldMul:0.6 },
  pierce: { name:'PIERCE', color:0x00ff88, dur:14, desc:'Pierces through all enemies', wepMul:0.9, shieldMul:0.6 },
  blast:  { name:'BLAST',  color:0x8800ff, dur:8,  desc:'Wide explosive bolt', wepMul:0.9, shieldMul:1.8 },
  beam:   { name:'BEAM',   color:0x00ffff, dur:10, desc:'Continuous laser beam sweep', time:true, wepMul:0.8, shieldMul:0.6 },
  bolt:   { name:'BOLT',   color:0xffff00, dur:12, desc:'Bolt that chain-lightnings on hit', time:true, wepMul:1.0, shieldMul:0.5 },
  homing: { name:'HOMING', color:0xff66ff, dur:14, desc:'Homing projectiles track targets', wepMul:0.8, shieldMul:0.7 },
  saber:  { name:'SABER',  color:0x00ff44, dur:10, desc:'Lightsaber beam, unique per level', time:true, wepMul:1.0, shieldMul:0.7 },
  gravity:{ name:'GRAVITY',color:0xff4400, dur:12, desc:'Pulls enemies toward impact', time:true, wepMul:0.7, shieldMul:1.3 },
  nova:   { name:'NOVA',   color:0xff0066, dur:8,  desc:'Expanding ring of energy', time:true, wepMul:0.7, shieldMul:1.5 },
  swarm:  { name:'SWARM',  color:0x88ff00, dur:12, desc:'Splits into homing micro-drones', wepMul:0.6, shieldMul:0.5 },
  storm:  { name:'STORM',  color:0x4488ff, dur:10, desc:'Rapid lightning strikes', time:true, wepMul:0.7, shieldMul:0.5 },
  shard:  { name:'SHARD',  color:0xffaa00, dur:12, desc:'Fragments into many pieces', wepMul:0.7, shieldMul:0.7 },
  prism:  { name:'PRISM',  color:0xff00ff, dur:10, desc:'Splits into 3 colored beams', wepMul:0.7, shieldMul:0.5 },
  flare:  { name:'FLARE',  color:0xff6600, dur:10, desc:'Slows enemies hit', time:true, wepMul:0.7, shieldMul:0.7 },
  vortex: { name:'VORTEX', color:0x00aaff, dur:12, desc:'Spinning bullet spiral', wepMul:0.7, shieldMul:0.7 },
  echo:   { name:'ECHO',   color:0x44ffaa, dur:14, desc:'Bounces between enemies', time:true, wepMul:0.9, shieldMul:0.7 },
  tether: { name:'TETHER', color:0xff4488, dur:14, desc:'Links enemies, damage spreads', wepMul:0.9, shieldMul:0.5 },
  rift:   { name:'RIFT',   color:0x6644ff, dur:8,  desc:'Teleports behind enemy', wepMul:0.8, shieldMul:0.7 },
  pulse:  { name:'PULSE',  color:0x00ff88, dur:5, desc:'Expanding shockwave', time:true, wepMul:0.5, shieldMul:0.5 },
  pulsecannon:{name:'PULSE CANNON',color:0x66ffcc, dur:10, desc:'Double parallel beams straight ahead', wepMul:1.2, shieldMul:0.7 },
  vortexcannon:{name:'VORTEX CANNON',color:0x44ddff, dur:10, desc:'Double parallel beams straight ahead', wepMul:1.2, shieldMul:0.7 },
  mine:   { name:'BOUNCE',color:0x886644, dur:12, desc:'Ricocheting projectile bounces off walls', wepMul:1.0, shieldMul:1.8 },
  void:   { name:'VOID',   color:0x8800cc, dur:14, desc:'Dark energy damage zone', time:true, wepMul:0.8, shieldMul:0.9 },
  time:   { name:'TIME',   color:0x44ddff, dur:8,  desc:'Slows all enemies briefly', time:true, wepMul:1.0, shieldMul:1.0 },
  zenith: { name:'ZENITH', color:0xffdd00, dur:10, desc:'Orbital auto-fires satellite', time:true, wepMul:0.6, shieldMul:0.7 },
  singularity:{name:'SING',color:0x660066, dur:8,  desc:'Black hole implosion', time:true, wepMul:0.8, shieldMul:1.3 },
  phantom:{ name:'PHANTOM',color:0x8844ff, dur:12, desc:'Phases through enemies', time:true, wepMul:0.7, shieldMul:0.7 },
  glacier:{ name:'GLACIER',color:0x00ccff, dur:10, desc:'Freezes enemy on hit', time:true, wepMul:0.6, shieldMul:0.7 },
  nebula: { name:'NEBULA', color:0xff88aa, dur:14, desc:'Toxic cloud DOT area', time:true, wepMul:0.7, shieldMul:0.7 },
  laser:  { name:'LASER',  color:0xff4444, dur:10, desc:'Precise continuous beam, high single-target DPS', time:true, wepMul:0.8, shieldMul:0.5 },
  ion:    { name:'ION',    color:0x00ddff, dur:12, desc:'EMP burst - disables enemy weapons', wepMul:0.6, shieldMul:0.7 },
  siphon: { name:'SIPHON', color:0xff66aa, dur:12, desc:'Steals health from enemies', time:true, wepMul:0.7, shieldMul:0.6 },
  inferno:{ name:'INFERNO',color:0xff2200, dur:10, desc:'Fire blast that leaves plasma pools', wepMul:0.9, shieldMul:1.5 },
  railgun:{ name:'RAILGUN',color:0x44aaff, dur:10, desc:'Ultra-fast penetrator, chains on hit', time:true, wepMul:1.2, shieldMul:0.5 },
  starburst:{name:'STARBURST',color:0xffaa00, dur:10, desc:'Splits into seeking mini-stars', wepMul:0.7, shieldMul:0.6 },
  vortexstorm:{name:'VORTEXSTORM',color:0x44ddff, dur:10, desc:'Spinning lightning vortex', time:true, wepMul:0.8, shieldMul:0.6 },
  prismsaber:{name:'PRISMSABER',color:0xff22ff, dur:10, desc:'Splits into 3 saber beams', time:true, wepMul:0.8, shieldMul:0.6 },
  phantomflare:{name:'PHANTOMFLARE',color:0x8844ff, dur:10, desc:'Phase-shifting slowing bolts', time:true, wepMul:0.7, shieldMul:0.8 },
  oblivion:{name:'OBLIVION',color:0x440066, dur:8, desc:'Implosion pulls then explodes', time:true, wepMul:1.0, shieldMul:1.5 },
  ufo:    { name:'U.F.O.',  color:0xff0044, dur:12, desc:'Launches mini UFOs that explode on impact', wepMul:0.8, shieldMul:0.7 }
};

const COMMON_KEYS = ['spread','rapid','pierce','blast','beam','homing','bolt','vortex','pulse'];
const ALL_WEAPONS = ['spread','rapid','pierce','blast','beam','bolt','homing','saber','gravity','nova',
  'swarm','storm','shard','prism','flare','vortex','echo','tether','rift','pulse','mine','void','glacier','nebula',
  'laser','ion','siphon','time','zenith','singularity','phantom','inferno','railgun','starburst',
  'vortexstorm','prismsaber','phantomflare','oblivion','ufo',
  'pulsecannon','vortexcannon'
];
function spawnSpecialPowerup(x, y) {
  spawnPowerup(x, y, pickWeightedWeapon());
}

function pickWeightedWeapon() {
  return ALL_WEAPONS[Math.floor(Math.random() * ALL_WEAPONS.length)];
}

const ENEMY_SUBTYPES = [
  { id:'normal', name:'', hpMul:1, spdMul:1, dmgMul:1, colorShift:0, weight:70, desc:'standard' },
  { id:'shielded', name:'SHIELDED ', hpMul:1.2, spdMul:0.6, dmgMul:0.8, colorShift:0x00ffff, weight:10, shield:6, desc:'multi-hit energy shield, zigzags' },
  { id:'heavy', name:'HEAVY ', hpMul:3, spdMul:0.5, dmgMul:1.2, colorShift:0xff8800, weight:8, desc:'high HP, slow' },
  { id:'kamikaze', name:'KAMIKAZE ', hpMul:0.5, spdMul:2.0, dmgMul:2.0, colorShift:0xff0044, weight:6, explodeOnDeath:true, desc:'explodes on death' },
  { id:'sniper', name:'SNIPER ', hpMul:0.7, spdMul:0.8, dmgMul:1, colorShift:0x8800ff, weight:5, fireRateMul:0.3, rangeMul:2, desc:'long range, accurate' },
  { id:'splitter', name:'SPLITTER ', hpMul:1.5, spdMul:1.0, dmgMul:1, colorShift:0x00ff88, weight:5, splits:2, desc:'splits on death' },
  { id:'teleporter', name:'PHASE ', hpMul:1, spdMul:1.2, dmgMul:1, colorShift:0xff44ff, weight:4, teleportChance:0.02, desc:'randomly teleports' },
  { id:'drone', name:'DRONE ', hpMul:0.6, spdMul:1.5, dmgMul:0.8, colorShift:0xffff00, weight:6, fireRateMul:0.5, desc:'fast, fires rapidly' },
  { id:'berserker', name:'BERSERKER ', hpMul:2, spdMul:1.3, dmgMul:1.5, colorShift:0xff2200, weight:4, desc:'fast and tough' },
  { id:'minion', name:'MINION ', hpMul:0.3, spdMul:2.5, dmgMul:0.5, colorShift:0x88ff88, weight:12, sizeMul:0.4, desc:'tiny, swarms' },
  { id:'carrier', name:'CARRIER ', hpMul:4, spdMul:0.4, dmgMul:1, colorShift:0xffaa00, weight:3, spawnMinions:3, desc:'spawns minions on hit' },
  { id:'reflector', name:'MIRROR ', hpMul:1, spdMul:0.9, dmgMul:1, colorShift:0xaaaaaa, weight:3, reflectChance:0.3, desc:'reflects projectiles' },
  { id:'emp', name:'EMP ', hpMul:1.2, spdMul:0.8, dmgMul:0, colorShift:0x00aaff, weight:3, empOnDeath:true, empRadius:100, desc:'disables weapons on death' },
  { id:'vampiric', name:'VAMPIRIC ', hpMul:1, spdMul:1.1, dmgMul:1.2, colorShift:0xff00aa, weight:3, healOnHit:0.2, desc:'heals on hit' },
  { id:'quantum', name:'QUANTUM ', hpMul:1, spdMul:1, dmgMul:1, colorShift:0x88ffff, weight:2, phaseShift:0.15, desc:'phases through attacks' },
  { id:'raider', name:'RAIDER ', hpMul:2, spdMul:1.3, dmgMul:1.5, colorShift:0xff44aa, weight:4, sizeMul:1.2, desc:'rogue fighter, attacks player + enemies for powerups', enemyWeapon:'blaster', blasterRate:2.5 },
  { id:'dodger', name:'DODGER ', hpMul:1, spdMul:1.5, dmgMul:1, colorShift:0xffff00, weight:6, behavior:'dodger', desc:'evades incoming fire' },
  { id:'snakeHead', name:'SERPENT ', hpMul:3, spdMul:1.2, dmgMul:1, colorShift:0x44ff88, weight:10, behavior:'snake', desc:'slithering segmented enemy' },
  { id:'hoverShooter', name:'GUNSHIP ', hpMul:4, spdMul:0.8, dmgMul:1.5, colorShift:0xffaa44, weight:5, behavior:'hoverShooter', enemyWeapon:'pierce', desc:'hovers and fires complex patterns' },
  { id:'stealth', name:'STEALTH ', hpMul:0.8, spdMul:1.2, dmgMul:1, colorShift:0x333333, weight:4, stealth:true, desc:'pulsing alpha, no homing lock' },
  { id:'bomber', name:'BOMBER ', hpMul:1.5, spdMul:0.7, dmgMul:1.5, colorShift:0xff8800, weight:4, dropMines:true, desc:'drops proximity mines' },
  { id:'pinata', name:'LOOT ', hpMul:2, spdMul:2.5, dmgMul:0, colorShift:0xffffff, weight:1, pinata:true, desc:'flees quickly, drops tons of loot' }
];

// --- Unique Enemy Generation ---
const UNIQUE_BEHAVIORS = [
  'spiral','burst','weave','orbit','charge','retreat','pulsate','flank','ambush','swarmLeader',
  'snipe','kamikaze','shieldWall','vampire','timeWarp','gravityWell','chainLightning','poison',
  'splitter','bomber','teleport','reflect','phase','mimic','berserk','healer','decoy','mineLayer',
  'laserTurret','tractorBeam'
];
const UNIQUE_WEAPONS = [
  'spread','rapid','pierce','blast','beam','bolt','homing','saber','gravity','nova',
  'swarm','storm','shard','prism','flare','vortex','echo','tether','pulse','mine','void','glacier','nebula',
  'laser','ion','siphon','pulsecannon','vortexcannon'
];
let uniqueEnemyIdCounter = 0;

function generateUniqueEnemy(tierIndex) {
  const t = TIERS[Math.min(tierIndex, TIERS.length - 1)];
  const behavior = UNIQUE_BEHAVIORS[Math.floor(Math.random() * UNIQUE_BEHAVIORS.length)];
  const weapon = UNIQUE_WEAPONS[Math.floor(Math.random() * UNIQUE_WEAPONS.length)];
  const rarities = ['common','uncommon','rare','epic','legendary'];
  const rarity = rarities[Math.min(Math.floor(Math.random() * rarities.length + tierIndex * 0.08), rarities.length - 1)];
  const rarityMul = 1 + rarities.indexOf(rarity) * 0.3;
  const colorHue = Math.floor(Math.random() * 360);
  const color = ((Math.floor(colorHue / 60) % 6) * 0x330000 + 0x440044 + Math.floor(Math.random() * 0x666666)) & 0xFFFFFF;
  uniqueEnemyIdCounter++;
  const def = {
    id: 'unique_' + uniqueEnemyIdCounter,
    name: (rarity.charAt(0).toUpperCase() + rarity.slice(1) + ' ' + behavior.charAt(0).toUpperCase() + behavior.slice(1)).substring(0, 14),
    hpMul: (1.5 + Math.random() * 2) * rarityMul,
    spdMul: 0.8 + Math.random() * 0.8,
    dmgMul: 1.0 + Math.random() * 1.5,
    colorShift: color,
    weight: 1,
    sizeMul: 1.2 + Math.random() * 0.5,
    shield: Math.ceil(Math.random() * 5),
    behavior,
    uniqueWeapon: weapon,
    fireRateMul: 0.3 + Math.random() * 1.5,
    enemyWeapon: Math.random() < 0.4 ? 'blaster' : null,
    blasterRate: 1.5 + Math.random() * 2,
    rarity,
    isUnique: true,
    phaseShift: Math.random() < 0.15 ? 0.1 + Math.random() * 0.15 : 0,
    reflectChance: Math.random() < 0.1 ? 0.15 + Math.random() * 0.25 : 0,
    teleportChance: Math.random() < 0.08 ? 0.015 + Math.random() * 0.02 : 0,
    healOnHit: Math.random() < 0.12 ? 0.1 + Math.random() * 0.2 : 0,
    explodeOnDeath: Math.random() < 0.12,
    splits: Math.random() < 0.1 ? Math.ceil(Math.random() * 3) : 0,
    spawnMinions: Math.random() < 0.08 ? Math.ceil(Math.random() * 3) : 0,
    empRadius: Math.random() < 0.06 ? 60 + Math.random() * 80 : 0,
    slowResist: Math.random() < 0.3 ? 0.3 + Math.random() * 0.4 : 0
  };
  uniqueEnemyDefs.push(def); if (uniqueEnemyDefs.length > 200) uniqueEnemyDefs.shift();
  return def;
}

const TIERS = (() => {
  const names = ['Shard','Crystal','Asteroid','Nova','Void','Ember','Storm','Phantom','Rift','Chaos',
                 'Prism','Flare','Zenith','Blitz','Core','Titan','Tempest','Omega','Fury','Raven',
                 'Mirage','Shiva','Nexus','Binary','Avatar','Cosmos','Infinity','Singularity','Oblivion','Vortex',
                 'Quasar','Pulsar','Nebula','Magnetar','Blackhole','Supernova','Hypernova','Kilonova','Blazar','Microquasar',
                 'Cosmos','Aether','Voidborn','Stardust','Darkmatter','Antimatter','Exotic','Primordial','Entropy','Singularity Prime'];
  const palettes = [
    [0xffe300,0xffd700,0xffcc44,0xff8c00,0xffee88],
    [0x00e5ff,0x7cff00,0x33ffcc,0x66ffff,0x00ff99],
    [0xb967ff,0xff00ff,0xaa44ff,0xff66aa],
    [0x00ffff,0xff0088,0x88ff00,0xff8800],
    [0xffffff,0xffdd00,0xff66ff,0x66ffff]
  ];
  const arr = [];
  for (let i = 0; i < 50; i++) {
    const sm = i < 10 ? (0.8 + i * 0.3) : (i < 20 ? 3.5 + (i - 10) * 0.4 : (i < 35 ? 7.5 + (i - 20) * 0.6 : 18 + (i - 35) * 0.8));
    const sx = i < 10 ? (3 + i * 0.8) : (i < 20 ? 11 + (i - 10) * 1.2 : (i < 35 ? 23 + (i - 20) * 1.5 : 48 + (i - 35) * 2.0));
    let w = 80 - i * 1.5;
    if (i >= 15) w -= 15;
    if (i >= 30) w -= 25;
    if (i >= 40) w -= 20;
    arr.push({
      name: names[i],
      sm: +sm.toFixed(1), sx: +sx.toFixed(1),
      pt: 1 + i * 2, hp: 1 + Math.floor(i / 1.8),
      spdLow: Math.round(Math.max(10, 65 - i * 1.2)),
      spdHigh: Math.round(Math.max(18, 90 - i * 1.5)),
      wt: Math.max(1, Math.round(w)),
      fireRate: i < 2 ? 0 : Math.max(0.4, +(4.5 - i * 0.09).toFixed(2)),
      cl: palettes[i % 5]
    });
  }
  return arr;
})();


const STARS_TOP_OFFSET = 50; // stars start below phone status bar
const STARS_LAYER = [
  { count:120, sz:0.5,  alpha:0.12, spd:0.08, fg:false },
  { count:80,  sz:0.7,  alpha:0.18, spd:0.12, fg:false },
  { count:40,  sz:1.0,  alpha:0.24, spd:0.18, fg:false },
  { count:20,  sz:1.4,  alpha:0.32, spd:0.25, fg:false },
  { count:10,  sz:1.8,  alpha:0.4,  spd:0.35, fg:false },
  { count:6,   sz:2.2,  alpha:0.5,  spd:0.5,  fg:true  },
  { count:3,   sz:2.8,  alpha:0.6,  spd:0.7,  fg:true  }
];

const STAR_COLORS = [0xffffff, 0xeeeeff, 0xffffff, 0xffffff, 0xeeeeff, 0xffffff, 0xffffff, 0xddddff];

const scoreEl = document.getElementById('scoreDisplay');
const healthLabel = document.getElementById('healthLabel');
const healthFill = document.getElementById('healthFill');
const weaponLabel = document.getElementById('weaponLabel');
const instEl = document.getElementById('instructions');
const waveEl = document.getElementById('waveDisplay');
const bossBarOuter = document.getElementById('bossBarOuter');
const bossBarFill = document.getElementById('bossBarFill');
const bossLabel = document.getElementById('bossLabel');
const diffOverlay = document.getElementById('diffOverlay');
const gameOverOverlay = document.getElementById('gameOverOverlay');
const finalScoreEl = document.getElementById('finalScore');
const waveReachedEl = document.getElementById('waveReached');
const damageFlashEl = document.getElementById('damageFlash');

let app;
try {
  app = new PIXI.Application({
    resizeTo: window, backgroundColor: 0x05050a, antialias: false,
    resolution: Math.min(window.devicePixelRatio || 1, 2), autoDensity: true,
    powerPreference: 'high-performance'
  });
  document.getElementById('game').appendChild(app.view);
  app.renderer.resize(window.innerWidth, window.innerHeight);
} catch(e) { }
// PIXI init OK

let starC, mistC, fgStarC, debrisC, stationC, gameC, enemyC, laserC, glowC, puC, enemyBulletC, fxC;
let bgTilingSprite;



function make(fn) {
    const g = new PIXI.Graphics();
    fn(g);
    g.endFill();
    if(app && app.renderer) return app.renderer.generateTexture(g, { scaleMode: PIXI.SCALE_MODES.NEAREST, resolution: 1 });
    return PIXI.Texture.EMPTY;
}

function createContainers() {
  starC = new PIXI.Container();
  app.stage.addChild(starC);
  mistC = new PIXI.Container();
  app.stage.addChild(mistC);
  fgStarC = new PIXI.Container();
  app.stage.addChild(fgStarC);
  debrisC = new PIXI.Container();
  app.stage.addChild(debrisC);
  stationC = new PIXI.Container();
  app.stage.addChild(stationC);
  gameC = new PIXI.Container();
  app.stage.addChild(gameC);
  enemyC = new PIXI.Container();
  gameC.addChild(enemyC);
  glowC = new PIXI.Container();
  gameC.addChild(glowC);
  enemyBulletC = new PIXI.Container();
  gameC.addChild(enemyBulletC);
  puC = new PIXI.Container();
  gameC.addChild(puC);
  laserC = new PIXI.Container();
  gameC.addChild(laserC);
  fxC = new PIXI.Container();
  gameC.addChild(fxC);
}
createContainers();

const tex4 = (() => {
  const g = new PIXI.Graphics(); g.beginFill(0xffffff); g.drawRect(0, 0, 4, 4); g.endFill();
  return app.renderer.generateTexture(g, { scaleMode: PIXI.SCALE_MODES.NEAREST, resolution: 1 });
})();



const texLaser = (() => {
  const g = new PIXI.Graphics();
  g.beginFill(0xffffff);
  g.drawCircle(0, 0, 2);
  g.endFill();
  return app.renderer.generateTexture(g, { scaleMode: PIXI.SCALE_MODES.NEAREST, resolution: 1 });
})();


const texEnemyFire = (() => {
  const g = new PIXI.Graphics();
  g.beginFill(0xffaa00, 0.4);
  g.drawCircle(0, 0, 8);
  g.beginFill(0xffdd00, 0.8);
  g.drawCircle(0, 0, 5);
  g.beginFill(0xffffff, 1);
  g.drawCircle(0, 0, 2);
  g.endFill();
  return app.renderer.generateTexture(g, { scaleMode: PIXI.SCALE_MODES.LINEAR, resolution: 2 });
})();


const texCannonGlow = (() => {
  const g = new PIXI.Graphics();
  for(let i=0; i<10; i++) {
     g.beginFill(0x44ddff, 0.05 + (0.05 * (10-i)));
     g.drawCircle(0, 0, 15 - i);
  }
  g.endFill();
  return app.renderer.generateTexture(g, { scaleMode: PIXI.SCALE_MODES.LINEAR, resolution: 2 });
})();


const tex8 = (() => {
  const g = new PIXI.Graphics(); g.beginFill(0xffffff); g.drawRect(0, 0, 8, 8); g.endFill();
  return app.renderer.generateTexture(g, { scaleMode: PIXI.SCALE_MODES.NEAREST, resolution: 1 });
})();


const texCan = (() => {
  const g = new PIXI.Graphics();
  // Simple cannon turret (crosshair with barrel)
  g.beginFill(0x44ddff, 0.9);
  g.drawCircle(0, 0, 3); g.endFill();
  g.lineStyle(1.5, 0x44ddff, 0.6);
  g.drawCircle(0, 0, 8); g.endFill();
  g.lineStyle(2, 0x44ddff, 0.8);
  g.moveTo(0, -2); g.lineTo(0, -14); g.endFill();
  g.lineStyle(1, 0x44ddff, 0.3);
  g.moveTo(-6, 0); g.lineTo(6, 0); g.endFill();
  g.moveTo(0, -6); g.lineTo(0, 6); g.endFill();
  return app.renderer.generateTexture(g, { scaleMode: PIXI.SCALE_MODES.LINEAR, resolution: 2 });
})();


const particleShapes = (() => {
  function make(fn) { const g = new PIXI.Graphics(); fn(g); g.endFill(); return app.renderer.generateTexture(g, { scaleMode: PIXI.SCALE_MODES.LINEAR, resolution: 2 }); }
  return [
    make(g => { g.beginFill(0xffffff); g.drawCircle(0,0,4); }), // 0 - simple circle
    make(g => { g.beginFill(0xffffff); g.moveTo(0,-6); g.lineTo(3,-1); g.lineTo(6,0); g.lineTo(3,1); g.lineTo(0,6); g.lineTo(-3,1); g.lineTo(-6,0); g.lineTo(-3,-1); g.closePath(); }), // 1 - 4-point star
    make(g => { g.beginFill(0xffffff); g.moveTo(0,-5); g.lineTo(5,0); g.lineTo(0,5); g.lineTo(-5,0); g.closePath(); }), // 2 - diamond
    make(g => { g.lineStyle(2, 0xffffff); g.drawCircle(0,0,5); }), // 3 - hollow circle
    make(g => { g.beginFill(0xffffff); for(let i=0;i<5;i++){const a=-Math.PI/2+i*Math.PI*2/5; const r=i%2?2:6; g[i===0?'moveTo':'lineTo'](Math.cos(a)*r,Math.sin(a)*r);} g.closePath(); }), // 4 - 5-point star
    make(g => { g.beginFill(0xffffff); g.drawRect(-2,-5,4,10); g.drawRect(-5,-2,10,4); }), // 5 - cross
    make(g => { g.beginFill(0xffffff); g.moveTo(0,-6); g.lineTo(2,-1); g.lineTo(6,0); g.lineTo(2,1); g.lineTo(0,6); g.lineTo(-2,1); g.lineTo(-6,0); g.lineTo(-2,-1); g.closePath(); }), // 6 - thinner 4-point star
    make(g => { g.beginFill(0xffffff); for(let i=0;i<8;i++){const a=-Math.PI/2+i*Math.PI/4;const r=i%2?1.5:5;g[i===0?'moveTo':'lineTo'](Math.cos(a)*r,Math.sin(a)*r);} g.closePath(); }), // 7 - 8-point star
    make(g => { g.beginFill(0xffffff); g.drawRect(-1,-6,2,12); }), // 8 - thin rect
  ];
})();


const enemyShapes = (() => {
  function make(fn) { const g = new PIXI.Graphics(); fn(g); g.endFill(); return app.renderer.generateTexture(g, { scaleMode: PIXI.SCALE_MODES.NEAREST, resolution: 1 }); }
  return [
    make(g => { g.beginFill(0xffffff); g.drawRect(-4,-4,8,8); }), // Square
    make(g => { g.beginFill(0xffffff); g.moveTo(0,-5); g.lineTo(5,4); g.lineTo(-5,4); g.closePath(); }), // Triangle
    make(g => { g.beginFill(0xffffff); for(let i=0;i<6;i++){const a=i*Math.PI/3-Math.PI/2;g[i===0?'moveTo':'lineTo'](Math.cos(a)*5,Math.sin(a)*5);} g.closePath(); }), // Hexagon
    make(g => { g.beginFill(0xffffff); for(let i=0;i<5;i++){const a=-Math.PI/2+i*2*Math.PI/5;g[i===0?'moveTo':'lineTo'](Math.cos(a)*(i%2?2.5:5),Math.sin(a)*(i%2?2.5:5));} g.closePath(); }), // Star
    make(g => { g.beginFill(0xffffff); g.drawCircle(0,0,4); }), // Circle
    make(g => { g.beginFill(0xffffff); g.moveTo(0,-6); g.lineTo(6,0); g.lineTo(0,6); g.lineTo(-6,0); g.closePath(); }), // Diamond
    make(g => { g.beginFill(0xffffff); g.drawRect(-5,-2,10,4); g.drawRect(-2,-5,4,10); }), // Cross
    make(g => { g.beginFill(0xffffff); for(let i=0;i<8;i++){const a=-Math.PI/2+i*Math.PI/4;g[i===0?'moveTo':'lineTo'](Math.cos(a)*(i%2?2.5:6),Math.sin(a)*(i%2?2.5:6));} g.closePath(); }), // Octagram
    make(g => { g.beginFill(0xffffff); g.moveTo(0,-5); g.lineTo(3,-1); g.lineTo(5,-1); g.lineTo(2,2); g.lineTo(3,5); g.lineTo(0,3); g.lineTo(-3,5); g.lineTo(-2,2); g.lineTo(-5,-1); g.lineTo(-3,-1); g.closePath(); }), // Complex ship
    make(g => { g.beginFill(0xffffff); g.moveTo(-5,-5); g.lineTo(5,-5); g.lineTo(0,6); g.closePath(); }), // Down arrow
    make(g => { g.beginFill(0xffffff); g.moveTo(-3,-6); g.lineTo(3,-6); g.lineTo(3,6); g.lineTo(-3,6); g.closePath(); }) // Tall rect
  ];
})();

function generateBossTexture(r, nodeCount) {
  nodeCount = nodeCount || (10 + Math.floor(Math.random() * 8));
  const g = new PIXI.Graphics();
  const pts = [];
  for (let i = 0; i < nodeCount; i++) {
    const a = (i / nodeCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.6;
    const rad = r * (0.35 + Math.random() * 0.65);
    pts.push({ a, r: rad });
  }
  pts.sort((a, b) => a.a - b.a);
  g.beginFill(0xffffff);
  pts.forEach((p, i) => {
    const x = Math.cos(p.a) * p.r, y = Math.sin(p.a) * p.r;
    i === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
  });
  g.closePath(); g.endFill();
  const tx = app.renderer.generateTexture(g, { scaleMode: PIXI.SCALE_MODES.LINEAR, resolution: 2 });
  g.destroy();
  return tx;
}

function generateBossShapeSet(baseSize) {
  const s = baseSize || 24;
  const mainTex = generateBossTexture(s, 10 + Math.floor(Math.random() * 8));
  const coreTex = generateBossTexture(s * 0.4, 6 + Math.floor(Math.random() * 4));
  const ringR = s * (0.7 + Math.random() * 0.3);
  const ringG = new PIXI.Graphics();
  const ringPts = 12 + Math.floor(Math.random() * 8);
  ringG.lineStyle(2, 0xffffff, 0.7);
  for (let i = 0; i < ringPts; i++) {
    const a = (i / ringPts) * Math.PI * 2;
    const rad = ringR * (0.85 + Math.random() * 0.15);
    const x = Math.cos(a) * rad, y = Math.sin(a) * rad;
    i === 0 ? ringG.moveTo(x, y) : ringG.lineTo(x, y);
  }
  ringG.closePath();
  const ringTex = app.renderer.generateTexture(ringG, { scaleMode: PIXI.SCALE_MODES.LINEAR, resolution: 2 });
  return { mainTex, coreTex, ringTex };
}

const eliteShapes = (() => {
  function make(fn) { const g = new PIXI.Graphics(); fn(g); g.endFill(); return app.renderer.generateTexture(g, { scaleMode: PIXI.SCALE_MODES.NEAREST, resolution: 1 }); }
  return [
    make(g => { g.beginFill(0xffffff); g.moveTo(0,-8); g.lineTo(8,0); g.lineTo(4,8); g.lineTo(-4,8); g.lineTo(-8,0); g.closePath(); }), // Shield pentagon
    make(g => { g.beginFill(0xffffff); g.drawRect(-6,-6,12,12); }), // Big square
    make(g => { g.beginFill(0xffffff); for(let i=0;i<6;i++){const a=i*Math.PI/3;g[i===0?'moveTo':'lineTo'](Math.cos(a)*8,Math.sin(a)*8);} g.closePath(); }), // Big Hex
    make(g => { g.beginFill(0xffffff); g.drawCircle(0,0,8); }), // Big Circle
    make(g => { g.beginFill(0xffffff); g.moveTo(0,-8); g.lineTo(4,-4); g.lineTo(8,-4); g.lineTo(8,4); g.lineTo(4,4); g.lineTo(0,8); g.lineTo(-4,4); g.lineTo(-8,4); g.lineTo(-8,-4); g.lineTo(-4,-4); g.closePath(); }), // H shape
    make(g => { g.beginFill(0xffffff); g.moveTo(-6,-8); g.lineTo(6,-8); g.lineTo(8,-4); g.lineTo(8,4); g.lineTo(6,8); g.lineTo(-6,8); g.lineTo(-8,4); g.lineTo(-8,-4); g.closePath(); }) // Octagon
  ];
})();

const coreShapes = (() => {
  function make(fn) { const g = new PIXI.Graphics(); fn(g); g.endFill(); return app.renderer.generateTexture(g, { scaleMode: PIXI.SCALE_MODES.NEAREST, resolution: 1 }); }
  return [
    make(g => { g.beginFill(0xffffff); g.drawRect(-2,-2,4,4); }),
    make(g => { g.beginFill(0xffffff); g.drawCircle(0,0,2); }),
    make(g => { g.beginFill(0xffffff); g.moveTo(0,-3); g.lineTo(3,0); g.lineTo(0,3); g.lineTo(-3,0); g.closePath(); }),
    make(g => { g.beginFill(0xffffff); for(let i=0;i<3;i++){const a=-Math.PI/2+i*2*Math.PI/3;g[i===0?'moveTo':'lineTo'](Math.cos(a)*3,Math.sin(a)*3);} g.closePath(); })
  ];
})();

const ringShapes = (() => {
  function make(fn) { const g = new PIXI.Graphics(); fn(g); g.endFill(); return app.renderer.generateTexture(g, { scaleMode: PIXI.SCALE_MODES.NEAREST, resolution: 1 }); }
  return [
    make(g => { g.lineStyle(1.5,0xffffff,0.7); g.drawCircle(0,0,10); }), // Simple ring
    make(g => { g.lineStyle(1.5,0xffffff,0.6); g.drawCircle(0,0,12); g.beginFill(0xffffff); g.drawCircle(12,0,1.5); g.drawCircle(-12,0,1.5); g.drawCircle(0,12,1.5); g.drawCircle(0,-12,1.5); }), // UFO Ring with dots
    make(g => { g.lineStyle(1.5,0xffffff,0.6); g.drawRect(-8,-8,16,16); }), // Square ring
    make(g => { g.lineStyle(1.5,0xffffff,0.6); for(let i=0;i<6;i++){const a=i*Math.PI/3;g[i===0?'moveTo':'lineTo'](Math.cos(a)*10,Math.sin(a)*10);} g.closePath(); }) // Hex ring
  ];
})();


const puTex = (() => {
  function make(fn) { const g = new PIXI.Graphics(); fn(g); g.endFill(); return app.renderer.generateTexture(g, { scaleMode: PIXI.SCALE_MODES.NEAREST, resolution: 1 }); }
  const h = 8;
  return {
    spread: make(g => { g.beginFill(0xffffff); for(let i=0;i<6;i++){const a=-Math.PI/2+i*Math.PI/3;const r=i%2?3:8;g[i===0?'moveTo':'lineTo'](Math.cos(a)*r,Math.sin(a)*r);} g.closePath(); }),
    rapid: make(g => { g.beginFill(0xffffff); g.drawRect(-5,-1,10,2); g.drawRect(-3,-4,6,2); g.drawRect(-3,2,6,2); }),
    pierce: make(g => { g.beginFill(0xffffff); g.moveTo(-2,-h); g.lineTo(2,-h); g.lineTo(2,-2); g.lineTo(8,-2); g.lineTo(8,2); g.lineTo(2,2); g.lineTo(2,h); g.lineTo(-2,h); g.lineTo(-2,2); g.lineTo(-8,2); g.lineTo(-8,-2); g.lineTo(-2,-2); g.closePath(); }),
    blast: make(g => { g.beginFill(0xffffff); g.drawCircle(0,0,5); for(let i=0;i<8;i++){const a=i*Math.PI/4-Math.PI/2;g.moveTo(0,0); g.lineTo(Math.cos(a)*10,Math.sin(a)*10); for(let j=0;j<4;j++){const a2=a+(j-1.5)*0.25;g.moveTo(Math.cos(a)*5,Math.sin(a)*5);g.lineTo(Math.cos(a2)*9,Math.sin(a2)*9);}} }),
    beam: make(g => { g.beginFill(0xffffff); g.drawRect(-1,-h,2,16); g.beginFill(0xffffff,0.5); g.drawRect(-3,-h*0.5,6,2); g.drawRect(-3,h*0.5-1,6,2); }),
    bolt: make(g => { g.beginFill(0xffffff); g.moveTo(2,-h); g.lineTo(6,-3); g.lineTo(2,-1); g.lineTo(6,2); g.lineTo(-2,h); g.lineTo(-4,1); g.lineTo(0,-2); g.lineTo(-5,-3); g.closePath(); }),
    homing: make(g => { g.beginFill(0xffffff); g.drawCircle(0,0,7); g.beginFill(0x000000,0); g.lineStyle(1.5,0xffffff); g.moveTo(0,-10); g.lineTo(0,10); g.moveTo(-10,0); g.lineTo(10,0); }),
    saber: make(g => { g.beginFill(0xffffff); g.drawRect(-1,-h,2,16); g.moveTo(0,-h); g.lineTo(-4,0); g.lineTo(4,0); g.closePath(); g.drawRect(-3,-2,6,4); }),
    shield: make(g => { g.beginFill(0xffffff); for(let i=0;i<5;i++){const a=-Math.PI/2+i*2*Math.PI/5;g[i===0?'moveTo':'lineTo'](Math.cos(a)*7,Math.sin(a)*7);} g.closePath(); g.beginFill(0xffffff,0.4); g.drawCircle(0,0,4); }),
    gravity: make(g=>{g.beginFill(0xffffff);g.drawCircle(0,0,6);g.beginFill(0,0);g.lineStyle(1,0xffffff);g.moveTo(0,-8);g.lineTo(0,8);g.moveTo(-8,0);g.lineTo(8,0);g.drawCircle(0,0,3);}),
    nova: make(g=>{g.beginFill(0xffffff);g.drawCircle(0,0,4);for(let i=0;i<6;i++){const a=i*Math.PI/3-Math.PI/2;g.moveTo(0,0);g.lineTo(Math.cos(a)*9,Math.sin(a)*9);}}),
    swarm: make(g=>{g.beginFill(0xffffff);for(let i=0;i<5;i++){const a=i*2*Math.PI/5-Math.PI/2;g.drawCircle(Math.cos(a)*5,Math.sin(a)*5,2);}}),
    storm: make(g=>{g.beginFill(0xffffff);g.moveTo(0,-8);g.lineTo(2,-2);g.lineTo(6,-4);g.lineTo(3,1);g.lineTo(7,3);g.lineTo(2,4);g.lineTo(0,8);g.lineTo(-2,4);g.lineTo(-6,5);g.lineTo(-4,1);g.lineTo(-8,-1);g.lineTo(-3,-3);g.closePath();}),
    shard: make(g=>{g.beginFill(0xffffff);g.moveTo(0,-8);g.lineTo(3,-2);g.lineTo(8,0);g.lineTo(3,2);g.lineTo(0,8);g.lineTo(-3,2);g.lineTo(-8,0);g.lineTo(-3,-2);g.closePath();}),
    prism: make(g=>{g.beginFill(0xffffff);g.moveTo(0,-7);g.lineTo(7,4);g.lineTo(-7,4);g.closePath();g.drawRect(-2,-3,4,3);}),
    flare: make(g=>{g.beginFill(0xffffff);for(let i=0;i<8;i++){const a=i*Math.PI/4-Math.PI/2;const r=i%2?3:8;g[i===0?'moveTo':'lineTo'](Math.cos(a)*r,Math.sin(a)*r);}g.closePath();}),
    vortex: make(g=>{g.beginFill(0,0);g.lineStyle(1.5,0xffffff);g.drawCircle(0,0,7);g.moveTo(0,0);for(let i=0;i<12;i++){const a=i*Math.PI/6;g.lineTo(Math.cos(a)*(5+i*0.4),Math.sin(a)*(5+i*0.4));}}),
    echo: make(g=>{g.beginFill(0xffffff);g.drawCircle(0,0,3);g.beginFill(0,0);g.lineStyle(1,0xffffff);g.drawCircle(0,0,6);g.drawCircle(0,0,9);}),
    tether: make(g=>{g.beginFill(0xffffff);g.moveTo(0,-7);g.lineTo(2,0);g.lineTo(0,7);g.lineTo(-2,0);g.closePath();g.drawRect(-4,-1,8,2);}),
    rift: make(g=>{g.beginFill(0xffffff);g.drawCircle(0,0,3);g.beginFill(0,0);g.lineStyle(1.5,0xffffff);g.moveTo(-6,-6);g.lineTo(6,6);g.moveTo(-6,6);g.lineTo(6,-6);}),
    pulse: make(g=>{g.beginFill(0,0);g.lineStyle(1.5,0xffffff);g.drawCircle(0,0,4);g.drawCircle(0,0,7);g.drawCircle(0,0,10);}),
    mine: make(g=>{g.beginFill(0xffffff);g.drawCircle(0,0,5);g.drawRect(-1,2,2,5);g.drawRect(-3,-4,6,2);g.drawRect(-2,4,4,1);}),
    void: make(g=>{g.beginFill(0xffffff);g.drawCircle(0,0,3);g.beginFill(0,0);g.lineStyle(1.5,0xffffff);for(let i=0;i<6;i++){const a=i*Math.PI/3;g.moveTo(0,0);g.lineTo(Math.cos(a)*9,Math.sin(a)*9);}}),
    time: make(g=>{g.beginFill(0xffffff);g.drawCircle(0,0,6);g.beginFill(0,0);g.lineStyle(1.5,0xffffff);g.moveTo(0,-4);g.lineTo(0,0);g.lineTo(3,2);}),
    zenith: make(g=>{g.beginFill(0xffffff);g.drawCircle(0,0,2);g.beginFill(0,0);g.lineStyle(1,0xffffff);g.drawCircle(0,0,7);for(let i=0;i<4;i++){const a=i*Math.PI/2;g.moveTo(Math.cos(a)*3,Math.sin(a)*3);g.lineTo(Math.cos(a)*9,Math.sin(a)*9);}}),
    singularity: make(g=>{g.beginFill(0xffffff);for(let i=0;i<5;i++){const a=-Math.PI/2+i*2*Math.PI/5;g[i===0?'moveTo':'lineTo'](Math.cos(a)*7,Math.sin(a)*7);}g.closePath();g.beginFill(0,0);g.lineStyle(1,0xffffff);g.drawCircle(0,0,3);}),
    phantom: make(g=>{g.beginFill(0xffffff,0.6);g.drawCircle(0,0,6);g.beginFill(0,0);g.lineStyle(1.5,0xffffff);g.moveTo(-4,-4);g.lineTo(4,4);g.moveTo(-4,4);g.lineTo(4,-4);}),
    glacier: make(g=>{g.beginFill(0xffffff);g.moveTo(0,-8);g.lineTo(5,0);g.lineTo(3,2);g.lineTo(5,5);g.lineTo(0,8);g.lineTo(-5,5);g.lineTo(-3,2);g.lineTo(-5,0);g.closePath();g.beginFill(0xffffff,0.4);g.drawCircle(0,0,3);}),
    nebula: make(g=>{g.beginFill(0xffffff,0.8);g.drawCircle(0,0,3);for(let i=0;i<6;i++){const a=i*Math.PI/3;g.beginFill(0xffffff,0.3+Math.random()*0.4);g.drawCircle(Math.cos(a)*6,Math.sin(a)*6,2+Math.random()*2);}}),
    laser: make(g=>{g.beginFill(0xffffff);g.drawRect(-1,-8,2,16);g.beginFill(0xffffff,0.4);g.drawRect(-3,-6,6,12);}),
    ion: make(g=>{g.beginFill(0xffffff);g.drawCircle(0,0,4);g.beginFill(0,0);g.lineStyle(1,0xffffff);g.drawCircle(0,0,7);}),
    siphon: make(g=>{g.beginFill(0xffffff);g.drawCircle(0,0,4);g.moveTo(0,-8);g.lineTo(3,0);g.lineTo(0,8);g.lineTo(-3,0);g.closePath();}),
    inferno: make(g=>{g.beginFill(0xffffff);g.drawCircle(0,0,3);for(let i=0;i<6;i++){const a=i*Math.PI/3;g.moveTo(Math.cos(a)*3,Math.sin(a)*3);g.lineTo(Math.cos(a)*8,Math.sin(a)*8);}}),
    railgun: make(g=>{g.beginFill(0xffffff);g.drawRect(-1,-8,2,16);g.beginFill(0xffffff,0.6);g.drawCircle(0,0,3);}),
    starburst: make(g=>{g.beginFill(0xffffff);for(let i=0;i<5;i++){const a=-Math.PI/2+i*2*Math.PI/5;g[i===0?'moveTo':'lineTo'](Math.cos(a)*8,Math.sin(a)*8);}g.closePath();g.beginFill(0xffffff,0.5);g.drawCircle(0,0,3);}),
    vortexstorm: make(g=>{g.beginFill(0xffffff);g.drawCircle(0,0,2);g.beginFill(0,0);g.lineStyle(1.5,0xffffff);for(let i=0;i<8;i++){const a=i*Math.PI/4;g.moveTo(Math.cos(a)*4,Math.sin(a)*4);g.lineTo(Math.cos(a)*8,Math.sin(a)*8);}}),
    prismsaber: make(g=>{g.beginFill(0xffffff);g.drawRect(-1,-8,2,16);g.moveTo(-4,0);g.lineTo(4,0);g.lineTo(0,-4);g.closePath();g.moveTo(-3,4);g.lineTo(3,4);g.lineTo(0,8);g.closePath();}),
    phantomflare: make(g=>{g.beginFill(0xffffff,0.6);g.drawCircle(0,0,5);g.beginFill(0,0);g.lineStyle(1.5,0xffffff);g.moveTo(-5,-5);g.lineTo(5,5);g.moveTo(-5,5);g.lineTo(5,-5);}),
    oblivion: make(g=>{g.beginFill(0xffffff);g.drawCircle(0,0,6);g.beginFill(0,0);g.lineStyle(1.5,0xffffff);g.drawCircle(0,0,3);for(let i=0;i<6;i++){const a=i*Math.PI/3;g.moveTo(Math.cos(a)*3,Math.sin(a)*3);g.lineTo(Math.cos(a)*9,Math.sin(a)*9);}}),
    ufo: make(g=>{g.beginFill(0xffffff);g.drawCircle(0,0,6);g.beginFill(0,0);g.lineStyle(1.5,0xffffff);g.drawCircle(0,0,9);for(let i=0;i<4;i++){const a=i*Math.PI/2;g.drawCircle(Math.cos(a)*5,Math.sin(a)*5,1.5);}})
  };
})();


const enemyPool = [], laserPool = [], enemies = [], lasers = [], fxP = [], fxT = [], powerups = [], obstacles = [];
let obstacleC;
const enemyBullets = [], enemyBulletPool = [];
const stars = [], eBulletGlowPool = [], spritePool = [];
const puPool = [];
const beams = [];
const arcProjectiles = [], arcPool = [];
const gems = [];
const GEM_VALUE = 25;

function mks(pool, c) {
  if (pool.length) { const s = pool.pop(); s.visible = true; c.addChild(s); return s; }
  const s = new PIXI.Sprite(tex4); s.anchor.set(0.5); c.addChild(s); return s;
}

function tcl(t) { return t.cl[0]; }
function tcol(t) { return t.cl[Math.floor(Math.random() * t.cl.length)]; }
const RCOL_PALETTE = Array.from({length: 256}, () => (Math.floor(128+Math.random()*128)<<16)|(Math.floor(128+Math.random()*128)<<8)|Math.floor(128+Math.random()*128));
let _rcolIdx = 0;
function rcol() { return RCOL_PALETTE[_rcolIdx++ & 255]; }

// --- Cannon sprites (created by createGameSprites) ---
let cannonSprite, cannonGlow, cannonBase, shieldGraphic, peopleText, shipHull;

function createGameSprites() {
  cannonSprite = new PIXI.Sprite(texCan);
  cannonSprite.anchor.set(0.5, 0.5);
  cannonSprite.position.set(CANNON_X, CANNON_BASE_Y);
  cannonSprite.tint = 0xffffff;
  gameC.addChild(cannonSprite);

  cannonGlow = new PIXI.Sprite(texCannonGlow);
  cannonGlow.anchor.set(0.5);
  cannonGlow.scale.set(3.5);
  cannonGlow.tint = 0x44ddff;
  cannonGlow.alpha = 0.08;
  cannonGlow.blendMode = PIXI.BLEND_MODES.ADD;
  cannonGlow.position.set(CANNON_X, CANNON_BASE_Y);
  gameC.addChild(cannonGlow);

  cannonBase = new PIXI.Graphics();
  cannonBase.beginFill(0x223344, 0.8);
  cannonBase.drawEllipse(0, 0, 16, 7);
  cannonBase.endFill();
  cannonBase.position.set(CANNON_X, CANNON_BASE_Y + 10);
  gameC.addChild(cannonBase);

  shieldGraphic = new PIXI.Graphics();
  shieldGraphic.position.set(CANNON_X, CANNON_BASE_Y);
  gameC.addChild(shieldGraphic);

  peopleText = new PIXI.Text('', {
    fontFamily: 'monospace', fontSize: 10, fontWeight: 'bold',
    fill: 0x88ddff, dropShadow: true, dropShadowColor: 0x004488, dropShadowBlur: 4
  });
  peopleText.anchor.set(0.5, 1);
  peopleText.position.set(CANNON_X, CANNON_BASE_Y + 22);
  gameC.addChild(peopleText);

  shipHull = new PIXI.Graphics();
  shipHull.position.set(CANNON_X, CANNON_BASE_Y);
  gameC.addChild(shipHull);
}
createGameSprites();

function rebuildShipHull() {
  shipHull.clear();
  const tipY = -50;
  const baseY = 150;
  const baseWid = 80 + Math.random() * 20;
  const tipOff = (Math.random() - 0.5) * 6;
  const asymA = Math.random() * 0.3 + 0.1;
  const asymB = Math.random() * 0.3 + 0.1;
  const segs = 10;

  // Right hull edge points
  const rPts = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const y = tipY + (baseY - tipY) * t;
    const rw = baseWid * Math.pow(t, 0.5 + asymA) + (Math.random() - 0.5) * 6;
    rPts.push({ x: rw, y });
  }
  // Left hull edge points (mirrored with asymmetry)
  const lPts = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const y = tipY + (baseY - tipY) * t;
    const lw = -(baseWid * Math.pow(t, 0.5 + asymB) + (Math.random() - 0.5) * 8);
    lPts.push({ x: lw, y });
  }

  // Solid hull base (opaque dark metal)
  shipHull.beginFill(0x0a1520, 1);
  shipHull.moveTo(tipOff, tipY);
  for (const p of rPts) shipHull.lineTo(p.x, p.y);
  for (let i = lPts.length - 1; i >= 0; i--) shipHull.lineTo(lPts[i].x, lPts[i].y);
  shipHull.closePath(); shipHull.endFill();

  // Mid hull layer (solid slightly lighter)
  shipHull.beginFill(0x0f2030, 1);
  shipHull.moveTo(tipOff, tipY + 4);
  for (const p of rPts) shipHull.lineTo(p.x * 0.92, p.y - 2);
  for (let i = lPts.length - 1; i >= 0; i--) shipHull.lineTo(lPts[i].x * 0.92, lPts[i].y + 2);
  shipHull.closePath(); shipHull.endFill();

  // Panel strips (alternating grey tones, fully opaque)
  const panelColors = [0x1a3040, 0x152838, 0x1e3548, 0x182d3d, 0x223d50];
  const panelCount = 5 + Math.floor(Math.random() * 3);
  for (let p = 0; p < panelCount; p++) {
    const t = 0.08 + (p / panelCount) * 0.75;
    const y0 = tipY + (baseY - tipY) * t;
    const t2 = Math.min(t + 0.08 + Math.random() * 0.06, 0.85);
    const y1 = tipY + (baseY - tipY) * t2;
    const col = panelColors[p % panelColors.length];
    // Find intersecting x on hull edges
    let rx0 = tipOff, rx1 = tipOff, lx0 = tipOff, lx1 = tipOff;
    for (let j = 0; j < rPts.length - 1; j++) {
      if (y0 >= rPts[j].y && y0 <= rPts[j+1].y) {
        const f = (y0 - rPts[j].y) / (rPts[j+1].y - rPts[j].y);
        rx0 = rPts[j].x + (rPts[j+1].x - rPts[j].x) * f;
      }
      if (y1 >= rPts[j].y && y1 <= rPts[j+1].y) {
        const f = (y1 - rPts[j].y) / (rPts[j+1].y - rPts[j].y);
        rx1 = rPts[j].x + (rPts[j+1].x - rPts[j].x) * f;
      }
    }
    for (let j = 0; j < lPts.length - 1; j++) {
      if (y0 >= lPts[j].y && y0 <= lPts[j+1].y) {
        const f = (y0 - lPts[j].y) / (lPts[j+1].y - lPts[j].y);
        lx0 = lPts[j].x + (lPts[j+1].x - lPts[j].x) * f;
      }
      if (y1 >= lPts[j].y && y1 <= lPts[j+1].y) {
        const f = (y1 - lPts[j].y) / (lPts[j+1].y - lPts[j].y);
        lx1 = lPts[j].x + (lPts[j+1].x - lPts[j].x) * f;
      }
    }
    const inset = 2 + Math.random() * 4;
    shipHull.beginFill(col, 1);
    shipHull.moveTo(lx0 + inset, y0);
    shipHull.lineTo(rx0 - inset, y0);
    shipHull.lineTo(rx1 - inset, y1);
    shipHull.lineTo(lx1 + inset, y1);
    shipHull.closePath(); shipHull.endFill();
  }

  // Antenna (right side, solid, connected to hull)
  const antX = rPts[Math.floor(rPts.length * 0.3)].x + 2;
  const antY = tipY + (baseY - tipY) * 0.25;
  const antH = 18 + Math.random() * 15;
  shipHull.beginFill(0x304860, 1);
  shipHull.moveTo(antX, antY);
  shipHull.lineTo(antX + 5, antY - antH);
  shipHull.lineTo(antX + 9, antY - antH + 3);
  shipHull.lineTo(antX + 7, antY);
  shipHull.closePath(); shipHull.endFill();
  shipHull.beginFill(0x88ddff, 1);
  shipHull.drawCircle(antX + 7, antY - antH + 1, 3);
  shipHull.endFill();

  // Blocky protrusion (left side, solid)
  const bi = Math.floor(lPts.length * 0.5);
  const bx = lPts[bi].x - (Math.random() * 8 + 4);
  const by = tipY + (baseY - tipY) * 0.5;
  const bw = 12 + Math.random() * 10;
  const bh = 10 + Math.random() * 8;
  shipHull.beginFill(0x1e3548, 1);
  shipHull.moveTo(bx, by - bh);
  shipHull.lineTo(bx - bw, by - bh + 3);
  shipHull.lineTo(bx - bw, by + bh);
  shipHull.lineTo(bx, by + bh - 3);
  shipHull.closePath(); shipHull.endFill();

  // Engine housing (right side lower, solid)
  const ei = Math.floor(rPts.length * 0.75);
  const ex = rPts[ei].x - 8;
  const ey = tipY + (baseY - tipY) * 0.72;
  shipHull.beginFill(0x2a4058, 1);
  shipHull.drawRect(ex - 4, ey, 14, 22);
  shipHull.endFill();
  shipHull.beginFill(0x5588bb, 1);
  shipHull.drawRect(ex, ey + 18, 6, 6);
  shipHull.endFill();

  // Thruster glow (left side)
  const ti = Math.floor(lPts.length * 0.8);
  const tx = lPts[ti].x;
  const ty = tipY + (baseY - tipY) * 0.8;
  shipHull.beginFill(0x884422, 1);
  shipHull.drawEllipse(tx, ty + 10, 10, 4);
  shipHull.endFill();
  shipHull.beginFill(0xff6622, 1);
  shipHull.drawEllipse(tx, ty + 8, 6, 2);
  shipHull.endFill();

  // Center line (vertical)
  shipHull.lineStyle(2, 0x3a6a8a, 0.6);
  shipHull.moveTo(tipOff, tipY + 10);
  const cEnd = tipY + (baseY - tipY) * 0.65;
  shipHull.lineTo(tipOff, cEnd);

  // Horizontal ribs (solid lines)
  shipHull.lineStyle(1, 0x3a6a8a, 0.4);
  for (let r = 0; r < 3; r++) {
    const rt = 0.2 + r * 0.2;
    const ry = tipY + (baseY - tipY) * rt;
    let rrx = tipOff, rlx = tipOff;
    for (let j = 0; j < rPts.length - 1; j++) {
      if (ry >= rPts[j].y && ry <= rPts[j+1].y) {
        const f = (ry - rPts[j].y) / (rPts[j+1].y - rPts[j].y);
        rrx = rPts[j].x + (rPts[j+1].x - rPts[j].x) * f;
      }
    }
    for (let j = 0; j < lPts.length - 1; j++) {
      if (ry >= lPts[j].y && ry <= lPts[j+1].y) {
        const f = (ry - lPts[j].y) / (lPts[j+1].y - lPts[j].y);
        rlx = lPts[j].x + (lPts[j+1].x - lPts[j].x) * f;
      }
    }
    shipHull.moveTo(rlx + 4, ry); shipHull.lineTo(rrx - 4, ry);
  }

  // Edge border
  shipHull.lineStyle(1, 0x4a8aaa, 0.5);
  shipHull.moveTo(tipOff, tipY);
  for (const p of rPts) shipHull.lineTo(p.x, p.y);
  for (let i = lPts.length - 1; i >= 0; i--) shipHull.lineTo(lPts[i].x, lPts[i].y);
  shipHull.closePath();
}
rebuildShipHull();

let _starLayout = null; // cached positions/tints so stars don't reshuffle on rebuild
function initStars() {
  while (starC.children.length) starC.removeChild(starC.children[0]);
  while (fgStarC.children.length) fgStarC.removeChild(fgStarC.children[0]);
  stars.length = 0;
  if (!_starLayout) {
    const _clusters = STARS_LAYER.map(l =>
      Array.from({ length: 3 + Math.floor(Math.random() * 3) }, () => Math.random() * width)
    );
    _starLayout = STARS_LAYER.map((layer, li) => {
      const clusters = _clusters[li];
      const arr = [];
      for (let i = 0; i < layer.count; i++) {
        const cx = clusters[Math.floor(Math.random() * clusters.length)];
        const gap = Math.random() < 0.15 ? 60 + Math.random() * 120 : 0;
        arr.push({
          x: Math.max(0, Math.min(width, cx + (Math.random() - 0.5) * 40 + (Math.random() < 0.5 ? gap : -gap))),
          y: STARS_TOP_OFFSET + Math.random() * (height - STARS_TOP_OFFSET),
          tint: STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)],
          alpha: layer.alpha * (0.3 + Math.random() * 0.7),
          sz: layer.sz / 4,
          vy: layer.spd, fg: layer.fg, clusterX: cx
        });
      }
      return arr;
    });
  }
  _starLayout.forEach((arr, li) => {
    arr.forEach(d => {
      const s = new PIXI.Sprite(tex4);
      s.anchor.set(0.5);
      s.scale.set(d.sz);
      s.alpha = d.alpha;
      s.tint = d.tint;
      s.x = d.x; s.y = d.y;
      if (d.fg) { fgStarC.addChild(s); } else { starC.addChild(s); }
      stars.push({ sprite: s, vy: d.vy, clusterX: d.clusterX });
    });
  });
}
initStars();

let mist = [], debris = [];

function createNebulaTexture(radius) {
  const size = radius * 2;
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(radius, radius, 0, radius, radius, radius);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.15, 'rgba(255,255,255,0.7)');
  grad.addColorStop(0.4, 'rgba(255,255,255,0.3)');
  grad.addColorStop(0.7, 'rgba(255,255,255,0.08)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  return PIXI.Texture.from(canvas, { scaleMode: PIXI.SCALE_MODES.LINEAR });
}

const NEBULA_PUFF = createNebulaTexture(128);

function initAtmosphere() {
  while (mistC.children.length) mistC.removeChild(mistC.children[0]);
  while (debrisC.children.length) debrisC.removeChild(debrisC.children[0]);
  mist.length = 0; debris.length = 0;
  // Fine white gas dust specks (neutral, no colored tint)
  for (let i = 0; i < 300; i++) {
    const s = new PIXI.Sprite(NEBULA_PUFF);
    s.anchor.set(0.5);
    s.scale.set(0.03 + Math.random() * 0.07);
    s.alpha = 0.12 + Math.random() * 0.14;
    s.tint = 0xffffff;
    s.blendMode = PIXI.BLEND_MODES.NORMAL;
    s.position.set(Math.random() * width * 1.4 - width * 0.2, Math.random() * height * 1.4 - height * 0.2);
    const layer = Math.floor(Math.random() * 3);
    mistC.addChild(s);
    mist.push({
      sprite: s, layer,
      vy: (0.3 + Math.random() * 0.5) * (1 + layer * 0.3),
      vx: (Math.random() - 0.5) * 0.15,
      phase: Math.random() * Math.PI * 2,
      phaseY: Math.random() * Math.PI * 2,
      sz: 128, driftAmp: 0.08, driftFreq: 0.1
    });
  }
  const DEBRIS_TPOOL = [], DEBRIS_COLORS = [0x887766, 0x8899aa, 0x667788, 0x995544, 0x446688, 0x555566, 0x668877, 0x774466, 0x88aacc, 0x666644, 0x556677, 0x887799, 0x997755, 0x669988];
  for (let ti = 0; ti < 60; ti++) {
    const c2 = document.createElement('canvas'), sz2 = 20 + Math.floor(Math.random() * 28);
    c2.width = sz2; c2.height = sz2;
    const ax = c2.getContext('2d'), hx = sz2/2;
    const t2 = Math.floor(Math.random() * 6);
    if (t2 === 0) {
      const pts = 4 + Math.floor(Math.random() * 5);
      ax.beginPath();
      for (let i = 0; i < pts; i++) { const a = i/pts*Math.PI*2+Math.random()*0.3, r = sz2*0.18+Math.random()*sz2*0.25; ax[i===0?'moveTo':'lineTo'](hx+Math.cos(a)*r, hx+Math.sin(a)*r); }
      ax.closePath(); ax.fillStyle = 'rgba(255,255,255,0.9)'; ax.fill();
    } else if (t2 === 1) {
      ax.beginPath(); ax.ellipse(hx, hx, sz2*0.35, sz2*0.06+Math.random()*sz2*0.06, Math.random()*Math.PI, 0, Math.PI*2); ax.fillStyle = 'rgba(255,255,255,0.85)'; ax.fill();
    } else if (t2 === 2) {
      const sides = 3+Math.floor(Math.random()*4); ax.beginPath();
      for (let i = 0; i < sides; i++) { const a = i/sides*Math.PI*2-Math.PI/2, r = sz2*0.12+Math.random()*sz2*0.3; ax[i===0?'moveTo':'lineTo'](hx+Math.cos(a)*r, hx+Math.sin(a)*r); }
      ax.closePath(); ax.fillStyle = 'rgba(255,255,255,0.9)'; ax.fill();
    } else if (t2 === 3) {
      for (let j = 0; j < 2+Math.floor(Math.random()*3); j++) ax.fillStyle = `rgba(255,255,255,${0.3+Math.random()*0.5})`, ax.fillRect(hx+(Math.random()-0.5)*sz2*0.3, hx+(Math.random()-0.5)*sz2*0.3, 2+Math.random()*5, 2+Math.random()*5);
    } else if (t2 === 4) {
      ax.beginPath(); ax.arc(hx, hx, sz2*0.25+Math.random()*sz2*0.1, Math.random()*Math.PI, Math.random()*Math.PI+Math.PI*0.3); ax.lineWidth = 1+Math.random()*2; ax.strokeStyle = 'rgba(255,255,255,0.6)'; ax.stroke();
    } else {
      const rg = ax.createRadialGradient(hx, hx, 0, hx, hx, sz2*0.4); rg.addColorStop(0,'rgba(255,255,255,1)'); rg.addColorStop(0.2,'rgba(255,255,255,0.4)'); rg.addColorStop(1,'rgba(255,255,255,0)'); ax.fillStyle = rg; ax.fillRect(0,0,sz2,sz2);
    }
    DEBRIS_TPOOL.push(PIXI.Texture.from(c2, { scaleMode: PIXI.SCALE_MODES.LINEAR }));
  }
  for (let i = 0; i < 250; i++) {
    const s = new PIXI.Sprite(DEBRIS_TPOOL[Math.floor(Math.random() * DEBRIS_TPOOL.length)]);
    s.anchor.set(0.5); s.scale.set(0.12 + Math.random() * 0.5);
    s.alpha = 0.02 + Math.random() * 0.08; s.tint = DEBRIS_COLORS[Math.floor(Math.random() * DEBRIS_COLORS.length)];
    s.position.set(Math.random() * width, Math.random() * height); s.rotation = Math.random() * Math.PI * 2;
    s.blendMode = PIXI.BLEND_MODES.ADD;
    debrisC.addChild(s);
    debris.push({ sprite: s, vy: 6 + Math.random() * 28, vx: (Math.random() - 0.5) * 6, rv: (Math.random() - 0.5) * 0.4, phase: Math.random() * Math.PI * 2 });
  }
}
initAtmosphere();

function updateAtmosphere(dt, now) {
  const z = zoom || 1;
  if (bgTilingSprite) {
    bgTilingSprite.tilePosition.y += 10 * dt * z;
  }
  for (const m of mist) {
    m.sprite.y += (m.vy + Math.sin(now * 0.0005 + m.phaseY) * m.driftAmp) * dt;
    m.sprite.x += m.vx + Math.sin(now * 0.0003 + m.phase) * m.driftAmp * 0.5 * dt;
    m.sprite.alpha = (0.06 + Math.sin(now * 0.0004 + m.phase) * 0.03) * (1 + m.layer * 0.3);
    const edge = m.sz * 1.5;
    if (m.sprite.y > height + edge) { m.sprite.y = -edge; m.sprite.x = Math.random() * width * 1.4 - width * 0.2; }
    if (m.sprite.y < -edge) { m.sprite.y = height + edge; }
    if (m.sprite.x > width + edge) m.sprite.x = -edge;
    else if (m.sprite.x < -edge) m.sprite.x = width + edge;
  }
  for (const d of debris) {
    d.sprite.y += d.vy * dt; d.sprite.x += (d.vx || 0) * dt; d.sprite.rotation += (d.rv || 0) * dt;
    d.sprite.alpha = 0.04 + Math.sin(now * 0.0005 + (d.phase || 0)) * 0.03;
    if (d.sprite.y > height + 60) { d.sprite.y = -60; d.sprite.x = Math.random() * width; }
    if (d.sprite.x > width + 60) d.sprite.x = -60;
    else if (d.sprite.x < -60) d.sprite.x = width + 60;
  }
  
  if (window.activeStation) {
    if (inEncounter) {
      window.activeStation.y += (window.activeStation.targetY - window.activeStation.y) * 2 * dt;
      window.activeStation.children[0].rotation += 0.1 * dt;
      window.activeStation.children[1].rotation -= 0.15 * dt;
      window.activeStation.children[2].rotation += 0.05 * dt;
    } else {
      window.activeStation.y += 300 * dt;
      window.activeStation.children[0].rotation += 0.1 * dt;
      window.activeStation.children[1].rotation -= 0.15 * dt;
      window.activeStation.children[2].rotation += 0.05 * dt;
      if (window.activeStation.y > height + 1000) {
        stationC.removeChild(window.activeStation); window.activeStation.destroy({children:true}); window.activeStation = null;
      }
    }
  }
}

// --- Audio ---
let audioCtx = null;
let sfxGain = null; // Dedicated SFX bus - NEVER routes through music compressor
window.initAudio = function() {
  if (!audioCtx) {
     audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (!sfxGain) {
     sfxGain = audioCtx.createGain();
     sfxGain.gain.value = 0.9;
     sfxGain.connect(audioCtx.destination);
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
};

function playFireSnd() {
  if (!audioCtx) return;
  const t = audioCtx.currentTime;
  const o = audioCtx.createOscillator(), g = audioCtx.createGain();
  o.type = 'sawtooth'; o.frequency.setValueAtTime(800 + Math.random() * 400, t);
  o.frequency.exponentialRampToValueAtTime(200, t + 0.04);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.015, t + 0.002);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
  o.connect(g); g.connect((sfxGain || audioCtx.destination)); o.start(t); o.stop(t + 0.05);
}

function playBeamSnd() {
  if (!audioCtx) return;
  const t = audioCtx.currentTime;
  const o = audioCtx.createOscillator(), g = audioCtx.createGain();
  o.type = 'sine'; o.frequency.setValueAtTime(1800, t); o.frequency.linearRampToValueAtTime(600, t + 0.12);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.012, t + 0.005);
  g.gain.linearRampToValueAtTime(0.008, t + 0.06); g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
  o.connect(g); g.connect((sfxGain || audioCtx.destination)); o.start(t); o.stop(t + 0.15);
  const o2 = audioCtx.createOscillator(), g2 = audioCtx.createGain();
  o2.type = 'sawtooth'; o2.frequency.setValueAtTime(300, t); o2.frequency.linearRampToValueAtTime(120, t + 0.1);
  g2.gain.setValueAtTime(0, t); g2.gain.linearRampToValueAtTime(0.004, t + 0.003);
  g2.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
  o2.connect(g2); g2.connect((sfxGain || audioCtx.destination)); o2.start(t); o2.stop(t + 0.1);
}

function playBoltSnd() {
  if (!audioCtx) return;
  const t = audioCtx.currentTime;
  for (let i = 0; i < 3; i++) {
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = i % 2 ? 'square' : 'sawtooth'; o.frequency.setValueAtTime(1200 + i * 600 + Math.random() * 300, t + i * 0.02);
    o.frequency.exponentialRampToValueAtTime(200, t + i * 0.02 + 0.04);
    g.gain.setValueAtTime(0, t + i * 0.02); g.gain.linearRampToValueAtTime(0.008, t + i * 0.02 + 0.002);
    g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.02 + 0.05);
    o.connect(g); g.connect((sfxGain || audioCtx.destination)); o.start(t + i * 0.02); o.stop(t + i * 0.02 + 0.06);
  }
}

function playBlastSnd() {
  if (!audioCtx) return;
  const t = audioCtx.currentTime;
  const o = audioCtx.createOscillator(), g = audioCtx.createGain();
  o.type = 'sawtooth'; o.frequency.setValueAtTime(200, t); o.frequency.exponentialRampToValueAtTime(50, t + 0.1);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.025, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
  o.connect(g); g.connect((sfxGain || audioCtx.destination)); o.start(t); o.stop(t + 0.12);
  const o2 = audioCtx.createOscillator(), g2 = audioCtx.createGain();
  o2.type = 'sine'; o2.frequency.setValueAtTime(80, t); o2.frequency.exponentialRampToValueAtTime(20, t + 0.1);
  g2.gain.setValueAtTime(0, t); g2.gain.linearRampToValueAtTime(0.02, t + 0.003);
  g2.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
  o2.connect(g2); g2.connect((sfxGain || audioCtx.destination)); o2.start(t); o2.stop(t + 0.1);
}

function playPierceSnd() {
  if (!audioCtx) return;
  const t = audioCtx.currentTime;
  const o = audioCtx.createOscillator(), g = audioCtx.createGain();
  o.type = 'sine'; o.frequency.setValueAtTime(2500, t); o.frequency.linearRampToValueAtTime(3500, t + 0.06);
  o.frequency.exponentialRampToValueAtTime(400, t + 0.08);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.012, t + 0.002);
  g.gain.linearRampToValueAtTime(0.008, t + 0.04); g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
  o.connect(g); g.connect((sfxGain || audioCtx.destination)); o.start(t); o.stop(t + 0.1);
}

function playHomingSnd() {
  if (!audioCtx) return;
  const t = audioCtx.currentTime;
  const o = audioCtx.createOscillator(), g = audioCtx.createGain();
  o.type = 'sine'; o.frequency.setValueAtTime(600, t); o.frequency.linearRampToValueAtTime(1400, t + 0.06);
  o.frequency.exponentialRampToValueAtTime(800, t + 0.08);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.01, t + 0.002);
  g.gain.linearRampToValueAtTime(0.006, t + 0.04); g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
  o.connect(g); g.connect((sfxGain || audioCtx.destination)); o.start(t); o.stop(t + 0.1);
}

function playSaberSnd() {
  if (!audioCtx) return;
  const t = audioCtx.currentTime;
  const o = audioCtx.createOscillator(), g = audioCtx.createGain();
  o.type = 'sawtooth'; o.frequency.setValueAtTime(220, t); o.frequency.linearRampToValueAtTime(440, t + 0.04);
  o.frequency.linearRampToValueAtTime(330, t + 0.1); o.frequency.linearRampToValueAtTime(550, t + 0.15);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.018, t + 0.003);
  g.gain.linearRampToValueAtTime(0.012, t + 0.06); g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
  o.connect(g); g.connect((sfxGain || audioCtx.destination)); o.start(t); o.stop(t + 0.2);
  const o2 = audioCtx.createOscillator(), g2 = audioCtx.createGain();
  o2.type = 'sine'; o2.frequency.setValueAtTime(110, t); o2.frequency.linearRampToValueAtTime(165, t + 0.12);
  g2.gain.setValueAtTime(0, t); g2.gain.linearRampToValueAtTime(0.008, t + 0.005);
  g2.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
  o2.connect(g2); g2.connect((sfxGain || audioCtx.destination)); o2.start(t); o2.stop(t + 0.18);
}

function playWeaponSnd(type) {
  if (!type) { playFireSnd(); return; }
  switch (type) {
    case 'beam': playBeamSnd(); break;
    case 'bolt': playBoltSnd(); break;
    case 'blast': playBlastSnd(); break;
    case 'pierce': playPierceSnd(); break;
    case 'homing': playHomingSnd(); break;
    case 'saber': playSaberSnd(); break;
    default: playFireSnd();
  }
}

function playHitSnd() {
  if (!audioCtx) return;
  const t = audioCtx.currentTime;
  const o = audioCtx.createOscillator(), g = audioCtx.createGain();
  o.type = 'sine'; o.frequency.setValueAtTime(2200 + Math.random() * 800, t);
  o.frequency.exponentialRampToValueAtTime(800, t + 0.06);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.018, t + 0.002);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
  o.connect(g); g.connect((sfxGain || audioCtx.destination)); o.start(t); o.stop(t + 0.07);
}

function playPopSnd(tier) {
  if (!audioCtx) return;
  const t = audioCtx.currentTime, base = 600 + tier * 300;
  for (let i = 0; i < Math.min(3 + tier, 6); i++) {
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(base + i * 200 + Math.random() * 100, t + i * 0.03);
    g.gain.setValueAtTime(0, t + i * 0.03); g.gain.linearRampToValueAtTime(0.02 - i * 0.003, t + i * 0.03 + 0.002);
    g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.03 + 0.08);
    o.connect(g); g.connect((sfxGain || audioCtx.destination)); o.start(t + i * 0.03); o.stop(t + i * 0.03 + 0.08);
  }
}

function playPenaltySnd() {
  if (!audioCtx) return;
  const t = audioCtx.currentTime;
  const o = audioCtx.createOscillator(), g = audioCtx.createGain();
  o.type = 'sawtooth'; o.frequency.setValueAtTime(150, t);
  o.frequency.linearRampToValueAtTime(80, t + 0.2);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.06, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
  o.connect(g); g.connect((sfxGain || audioCtx.destination)); o.start(t); o.stop(t + 0.25);
}

function playPowerupSnd() {
  if (!audioCtx) return;
  const t = audioCtx.currentTime;
  [500, 700, 1000, 1400].forEach((f, i) => {
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(f, t + i * 0.05);
    g.gain.setValueAtTime(0, t + i * 0.05); g.gain.linearRampToValueAtTime(0.025, t + i * 0.05 + 0.003);
    g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.05 + 0.12);
    o.connect(g); g.connect((sfxGain || audioCtx.destination)); o.start(t + i * 0.05); o.stop(t + i * 0.05 + 0.12);
  });
}

function playEmpowerSnd() {
  if (!audioCtx) return;
  const t = audioCtx.currentTime;
  const o = audioCtx.createOscillator(), g = audioCtx.createGain();
  o.type = 'sawtooth'; o.frequency.setValueAtTime(300, t);
  o.frequency.linearRampToValueAtTime(900, t + 0.15);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.04, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
  o.connect(g); g.connect((sfxGain || audioCtx.destination)); o.start(t); o.stop(t + 0.2);
  const o2 = audioCtx.createOscillator(), g2 = audioCtx.createGain();
  o2.type = 'sine'; o2.frequency.setValueAtTime(600, t + 0.05);
  o2.frequency.linearRampToValueAtTime(1200, t + 0.2);
  g2.gain.setValueAtTime(0, t + 0.05); g2.gain.linearRampToValueAtTime(0.03, t + 0.055);
  g2.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
  o2.connect(g2); g2.connect((sfxGain || audioCtx.destination)); o2.start(t + 0.05); o2.stop(t + 0.25);
}

function playBossExplosionSnd() {
  if (!audioCtx) return;
  const t = audioCtx.currentTime;
  for (let i = 0; i < 8; i++) {
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(200 + i * 150 + Math.random() * 100, t + i * 0.06);
    o.frequency.exponentialRampToValueAtTime(40, t + i * 0.06 + 0.3);
    g.gain.setValueAtTime(0, t + i * 0.06); g.gain.linearRampToValueAtTime(0.05 - i * 0.005, t + i * 0.06 + 0.005);
    g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.06 + 0.35);
    o.connect(g); g.connect((sfxGain || audioCtx.destination)); o.start(t + i * 0.06); o.stop(t + i * 0.06 + 0.35);
  }
}

// --- Spawning ---
function pickTier() {
  const w = TIERS.map((t, i) => {
    let expectedTier;
    if (mapMode && mapNodes.length > 0) {
      const node = mapNodes[mapCurrentIdx];
      const nodeTier = node ? node.tier : 0;
      expectedTier = (nodeTier / 8) * 40 + wave * 0.4;
    } else {
      expectedTier = wave * 0.8;
    }
    const distance = i - expectedTier;
    
    if (distance <= 0) {
      return t.wt * (1 + (wave - 1) * 0.15);
    } else {
      const penalty = Math.pow(0.5, distance);
      return t.wt * penalty;
    }
  });
  const total = w.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < TIERS.length; i++) { r -= w[i]; if (r <= 0) return i; }
  return 0;
}

function pickSubtype(tierIndex) {
  const weights = ENEMY_SUBTYPES.map(st => {
    if (st.id === 'minion' && tierIndex < 5) return st.weight * 3;
    if (st.id === 'carrier' && tierIndex < 15) return st.weight * 0.1;
    if (st.id === 'quantum' && tierIndex < 25) return st.weight * 0.05;
    if (st.id === 'emp' && tierIndex < 20) return st.weight * 0.1;
    if (st.id === 'raider' && tierIndex < 8) return st.weight * 0.2;
    if (st.id === 'dodger') return st.weight * (1 + wave * 0.05);
    if (st.id === 'snakeHead' && tierIndex < 1) return st.weight * 0.1;
    if (st.id === 'hoverShooter' && tierIndex < 12) return st.weight * 0.1;
    if (st.id === 'stealth' && tierIndex < 8) return st.weight * 0.1;
    if (st.id === 'bomber' && tierIndex < 6) return st.weight * 0.1;
    if (st.id === 'pinata') return st.weight * (0.5 + wave * 0.05);
    return st.weight;
  });
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < ENEMY_SUBTYPES.length; i++) {
    r -= weights[i];
    if (r <= 0) return ENEMY_SUBTYPES[i];
  }
  return ENEMY_SUBTYPES[0];
}

function spawnEnemy(x, y, forceTier) {
  const d = DIFF[difficulty];
  if (enemies.length >= MAX_ENEMIES) return null;
  const ti = forceTier !== undefined ? forceTier : pickTier();
  const t = TIERS[ti];
  let st = pickSubtype(ti);
  if (forceTier === 0 && st.id === 'snakeHead') st = ENEMY_SUBTYPES[0]; // Prevent infinite snakes

  // Unique enemy generation
  const uniqueChance = 0.15 + wave * 0.015;
  const useUnique = Math.random() < uniqueChance && enemies.length > 2;
  if (useUnique && forceTier === undefined) st = generateUniqueEnemy(ti);
  
  // Powerup handling for elites
  if (useUnique && Math.random() < 0.3) {
      st.enemyWeapon = 'blaster';
      st.blasterRate = 1.0;
  }
  
  const sizeRand = Math.random();
  const sz = (t.sm + sizeRand * (t.sx - t.sm)) * (st.sizeMul || 1);
  const s = mks(enemyPool, enemyC);
  
  const isElite = useUnique || ti >= 15 || st.id === 'snakeHead' || st.id === 'hoverShooter';
  const shapesArr = isElite ? eliteShapes : enemyShapes;
  let shapeIdx = Math.floor(Math.random() * shapesArr.length);
  
  let finalTint;
  if (st.id === 'raider') {
    shapeIdx = 4;
    finalTint = 0xff44aa;
  } else if (mapMode && mapNodeFaction !== null) {
    const f = FACTIONS[mapNodeFaction];
    finalTint = f.body;
  } else {
    const baseTint = tcol(t);
    finalTint = st.colorShift ? (baseTint | st.colorShift) : baseTint;
  }
  s.texture = shapesArr[shapeIdx % shapesArr.length];
  s.scale.set(0.01);
  s.tint = finalTint;
  s.alpha = 0;
  const z = zoom || 1;
  const cx = gameC ? gameC.x : 0;
  const cy = gameC ? gameC.y : 0;
  const visibleLeft = -cx / z;
  const visibleRight = (width - cx) / z;
  const visibleTop = -cy / z;
  const visibleBottom = (height - cy) / z;
  const margin = sz + 20;
  let ex, ey;
  if (x !== undefined) {
    ex = x; ey = y !== undefined ? y : (visibleTop - sz - (zoom < 1 ? 10 : Math.random() * 80));
  } else if (y !== undefined) {
    ex = visibleLeft + margin + Math.random() * (visibleRight - visibleLeft - margin * 2); ey = y;
  } else if (zoom < 1) {
    ex = visibleLeft + margin + Math.random() * (visibleRight - visibleLeft - margin * 2);
    ey = visibleTop - sz - 10;
  } else {
    ex = visibleLeft + margin + Math.random() * (visibleRight - visibleLeft - margin * 2);
    ey = visibleTop - sz - Math.random() * 80;
  }
  s.position.set(ex, ey);

  const s2 = mks(enemyPool, enemyC);
  s2.texture = shapesArr[(shapeIdx + 1 + Math.floor(Math.random() * (shapesArr.length - 1))) % shapesArr.length];
  s2.scale.set(0.01);
  s2.tint = st.id === 'raider' ? 0x44ff88 : (mapMode && mapNodeFaction !== null ? FACTIONS[mapNodeFaction].accent : (st.colorShift ? (tcl(t) | st.colorShift) : tcl(t)));
  s2.alpha = 0;
  s2.position.set(ex, ey);
  s2.blendMode = PIXI.BLEND_MODES.ADD;

  const sCore = mks(enemyPool, enemyC);
  sCore.texture = coreShapes[Math.floor(Math.random() * coreShapes.length)];
  sCore.scale.set(0.01); sCore.tint = 0xffffff; sCore.alpha = 0; sCore.position.set(ex, ey);

  const sRing = mks(enemyPool, enemyC);
  sRing.texture = ringShapes[Math.floor(Math.random() * ringShapes.length)];
  sRing.scale.set(0.01);   sRing.tint = (st.id === 'raider') ? 0xff44aa : (mapMode && mapNodeFaction !== null ? FACTIONS[mapNodeFaction].ring : tcol(t)); sRing.alpha = 0; sRing.position.set(ex, ey);
  if (Math.random() > 0.5) sRing.blendMode = PIXI.BLEND_MODES.ADD;

  let waveMul;
  if (mapMode && mapNodes.length > 0) {
    const node = mapNodes[mapCurrentIdx];
    const nodeTier = node ? node.tier : 0;
    waveMul = (1 + wave * 0.3 + Math.pow(wave, 1.3) * 0.1) * (1 + nodeTier);
  } else {
    waveMul = 1 + wave * 0.3 + Math.pow(wave, 1.3) * 0.1;
  }
  const baseSpd = (t.spdLow + Math.random() * (t.spdHigh - t.spdLow)) * d.spdMul / Math.max(zoom || 1, 0.65) * Math.min(1.5, Math.sqrt(waveMul));
  const spd = baseSpd * st.spdMul * (d.aggressiveness || 1);
  const hp = Math.max(1, Math.round(t.hp * d.hpMul * st.hpMul * waveMul));
  const fireInt = t.fireRate > 0 ? (t.fireRate * (0.7 + Math.random() * 0.6)) * d.fireMul * (st.fireRateMul || 1) / Math.min(1.5, Math.sqrt(waveMul)) : 0;
  
  const baseShield = (isElite && Math.random() < 0.4) ? hp * 1.5 : (st.shield || 0);
  
  const e = {
    sprite: s, spriteAccent: s2, spriteCore: sCore, spriteRing: sRing,
    x: ex, y: ey, vx: (Math.random() - 0.5) * spd * 0.12, vy: spd,
    size: sz, tier: ti, hp, baseHP: hp,
    phase: Math.random() * Math.PI * 2,
    reveal: 0, rotation: 0, rotV: (Math.random() - 0.5) * (0.03 + ti * 0.008),
    ringRotV: (Math.random() - 0.5) * 0.05,
    sparkleSpeed: 2 + Math.random() * 4,
    fireTimer: 1 + Math.random() * 1.5, fireInterval: fireInt,
    buffed: false,
    slowTimer: 0,
    slowResist: st.slowResist || 0,
    subtype: st.id, subtypeData: st,
    uniqueBehavior: st.behavior || null,
    uniqueWeapon: st.uniqueWeapon || null,
    enemyWeapon: st.enemyWeapon || null,
    weaponFireTimer: st.blasterRate || 1.5,
    shield: baseShield, maxShield: baseShield,
    empRadius: st.empRadius || 0,
    healOnHit: st.healOnHit || 0,
    phaseShift: st.phaseShift || 0,
    reflectChance: st.reflectChance || 0,
    teleportChance: st.teleportChance || 0,
    explodeOnDeath: st.explodeOnDeath || false,
    splits: st.splits || 0,
    spawnMinions: st.spawnMinions || 0,
    rangeMul: st.rangeMul || 1
  };
  enemies.push(e);

  const gs = new PIXI.Sprite(shapesArr[Math.floor(Math.random() * shapesArr.length)]); gs.anchor.set(0.5);
  gs.scale.set(0.01); gs.tint = 0xffffff; gs.alpha = 0;
  gs.blendMode = PIXI.BLEND_MODES.ADD;
  gs.position.set(ex, ey);
  glowC.addChild(gs); e.sparkle = gs;

  const gg = new PIXI.Sprite(tex4); gg.anchor.set(0.5);
  gg.scale.set(0.01); gg.tint = st.id === 'raider' ? 0x44ff88 : tcol(t); gg.alpha = 0;
  gg.blendMode = PIXI.BLEND_MODES.ADD;
  gg.position.set(ex, ey);
  glowC.addChild(gg); e.glow = gg;

  if (isElite) {
    const au = new PIXI.Sprite(tex4); au.anchor.set(0.5);
    au.scale.set(0.02); au.tint = finalTint; au.alpha = 0;
    au.blendMode = PIXI.BLEND_MODES.ADD;
    au.position.set(ex, ey);
    glowC.addChild(au); e.aura = au;
    
    // Add an extra transparent glowing shimmer layer for elites
    const shimmer = new PIXI.Sprite(shapesArr[Math.floor(Math.random() * shapesArr.length)]);
    shimmer.anchor.set(0.5); shimmer.scale.set(0.02); shimmer.tint = 0xffffff; shimmer.alpha = 0;
    shimmer.blendMode = PIXI.BLEND_MODES.ADD; shimmer.position.set(ex, ey);
    glowC.addChild(shimmer); e.shimmer = shimmer;
  }

  const cr = new PIXI.Sprite(shapesArr[Math.floor(Math.random() * shapesArr.length)]); cr.anchor.set(0.5);
  cr.scale.set(0.01); cr.tint = st.id === 'raider' ? 0xff66cc : 0xff2200; cr.alpha = 0;
  cr.blendMode = PIXI.BLEND_MODES.ADD;
  cr.position.set(ex - 1, ey - 1);
  glowC.addChild(cr); e.chromaR = cr;

  const cb = new PIXI.Sprite(shapesArr[Math.floor(Math.random() * shapesArr.length)]); cb.anchor.set(0.5);
  cb.scale.set(0.01); cb.tint = st.id === 'raider' ? 0x66ff44 : 0x0044ff; cb.alpha = 0;
  cb.blendMode = PIXI.BLEND_MODES.ADD;
  cb.position.set(ex + 1, ey + 1);
  glowC.addChild(cb); e.chromaB = cb;
  return e;
}

function spawnSwarm() {
  const d = DIFF[difficulty];
  const count = Math.min(6 + Math.floor(wave * 0.5), 12);
  const z = zoom || 1;
  const cx = gameC ? gameC.x : 0;
  const cy = gameC ? gameC.y : 0;
  const visTop = -cy / z;
  const visibleLeft = -cx / z;
  const visibleRight = (width - cx) / z;
  const centerX = (visibleLeft + visibleRight) / 2;
  const leader = spawnEnemy(centerX + (Math.random() - 0.5) * 60, visTop - 40 - Math.random() * 60, Math.min(Math.floor(wave / 2), 8));
  if (!leader) return;
  leader.uniqueBehavior = 'swarmDiver';
  leader.phase = Math.random() * Math.PI * 2;
  leader._group = [];
  for (let i = 1; i < count; i++) {
    const ox = centerX + (Math.random() - 0.5) * 100;
    const oy = visTop - 20 - Math.random() * 80;
    const e = spawnEnemy(ox, oy, 0);
    if (e) {
      e.size *= 0.6;
      e.hp = (e.hp || 10) * 0.3;
      e.speedMul = (e.speedMul || 1) * (1.2 + wave * 0.03);
      e.uniqueBehavior = 'swarmGroup';
      e.phase = Math.random() * Math.PI * 2;
      e.leader = leader;
      leader._group.push(e);
    }
  }
}

function spawnHardcoreBlock() {
  if (difficulty !== 'hardcore') return;
  const blockCount = (wave > 2 && Math.random() < 0.5) ? 2 : 1;
  for (let b = 0; b < blockCount; b++) {
    const cols = 6 + Math.floor(Math.random() * 3);
    const rows = 3 + Math.floor(Math.random() * 3);
    const spacing = 28;
    const z = zoom || 1;
    const cx = gameC ? gameC.x : 0;
    const cy = gameC ? gameC.y : 0;
    const visibleLeft = -cx / z;
    const visibleRight = (width - cx) / z;
    const blockW = cols * spacing;
    const maxSX = Math.max(spacing, visibleRight - blockW - spacing);
    const startX = visibleLeft + spacing + Math.random() * (maxSX - spacing - visibleLeft);
    const startY = -cy / z - spacing * rows - Math.random() * 40;
    const tier = Math.min(Math.floor(wave / 10), 49);
    const blockId = Math.random();
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (Math.random() < 0.05) continue;
        const ox = startX + c * spacing + (Math.random() - 0.5) * 4;
        const oy = startY + r * spacing + (Math.random() - 0.5) * 4;
        const variedTier = Math.max(0, Math.min(49, tier + Math.floor(Math.random() * 2) - 1));
        const e = spawnEnemy(ox, oy, variedTier);
        if (e) {
          e.hardcoreBlock = blockId;
          e.blockOffsetX = c * spacing + (ox - startX - c * spacing);
          e.blockOffsetY = r * spacing + (oy - startY - r * spacing);
          e.blockCols = cols;
          e.blockRows = rows;
          e.vy = 10;
        }
      }
    }
  }
}

function rmEnemy(i) {
  const e = enemies[i];
  e.sprite.visible = false; enemyPool.push(e.sprite); enemyC.removeChild(e.sprite);
  if (e.spriteAccent) { e.spriteAccent.visible = false; enemyPool.push(e.spriteAccent); enemyC.removeChild(e.spriteAccent); }
  if (e.spriteCore) { e.spriteCore.visible = false; enemyPool.push(e.spriteCore); enemyC.removeChild(e.spriteCore); }
  if (e.spriteRing) { e.spriteRing.visible = false; enemyPool.push(e.spriteRing); enemyC.removeChild(e.spriteRing); }
  if (e.sparkle) { glowC.removeChild(e.sparkle); e.sparkle.destroy(); }
  if (e.glow) { glowC.removeChild(e.glow); e.glow.destroy(); }
  if (e.aura) { glowC.removeChild(e.aura); e.aura.destroy(); }
  if (e.shimmer) { glowC.removeChild(e.shimmer); e.shimmer.destroy(); }
  if (e.chromaR) { glowC.removeChild(e.chromaR); e.chromaR.destroy(); }
  if (e.chromaB) { glowC.removeChild(e.chromaB); e.chromaB.destroy(); }
  { enemies[i] = enemies[enemies.length - 1]; enemies.pop(); }
}

function spawnGems(count) {
  const z = zoom || 1;
  const cx = gameC ? gameC.x : 0;
  const cy = gameC ? gameC.y : 0;
  const visibleLeft = -cx / z;
  const visibleRight = (width - cx) / z;
  const visibleTop = -cy / z;
  const visibleBottom = (height - cy) / z;
  const gameWidth = visibleRight - visibleLeft;
  const gameHeight = visibleBottom - visibleTop;
  const margin = 40 / z;
  for (let i = 0; i < count; i++) {
    const s = new PIXI.Sprite(tex4);
    s.anchor.set(0.5);
    const x = visibleLeft + margin + Math.random() * (gameWidth - margin * 2);
    const y = visibleTop + margin + Math.random() * (gameHeight * 0.5 - margin);
    s.position.set(x, y);
    s.tint = Math.random() < 0.5 ? 0xffdd44 : 0xff88ff;
    s.scale.set(0.01);
    s.alpha = 0;
    laserC.addChild(s);
    const gg = new PIXI.Sprite(tex8);
    gg.anchor.set(0.5);
    gg.tint = 0xffff88;
    gg.blendMode = PIXI.BLEND_MODES.ADD;
    gg.position.set(x, y);
    gg.scale.set(0.01);
    gg.alpha = 0;
    glowC.addChild(gg);
    gems.push({
      sprite: s, glow: gg, x, y,
      vy: 10 + Math.random() * 20,
      phase: Math.random() * Math.PI * 2,
      reveal: 0
    });
  }
}

function hitGem(gemIdx) {
  const g = gems[gemIdx];
  spawnExplosion(g.x, g.y, 0xffdd44, 10);
  score += GEM_VALUE;
  updateUI();
  laserC.removeChild(g.sprite); g.sprite.destroy();
  glowC.removeChild(g.glow); g.glow.destroy();
  { gems[gemIdx] = gems[gems.length - 1]; gems.pop(); }
}

// --- Boss ---
function spawnBoss() {
  if (boss) return;
  bgmTrack(2);
  const d = DIFF[difficulty];
  const encScale = 1 + bossEncounter * 0.1;
  let bossNodeMul = 1;
  if (mapMode && mapNodes.length > 0) {
    const node = mapNodes[mapCurrentIdx];
    const nodeTier = node ? node.tier : 0;
    bossNodeMul = 1 + nodeTier * 0.4;
  }
  const hp = Math.round((500 + wave * 50 * d.hpMul * encScale) * 1.3 * bossNodeMul);
  const sz = 24 + Math.min(wave * 0.5, 24);
  const x = cannon ? cannon.x : width / 2;
  const bz2 = gameC ? gameC.scale.x || 1 : 1;
  const bcy2 = gameC ? gameC.y : 0;
  const bTop = -bcy2 / bz2;
  const y = bTop - height * 0.25 / bz2;

  const shapes = generateBossShapeSet(sz);

  const s = mks(enemyPool, enemyC);
  s.texture = shapes.mainTex;
  s.scale.set(0.01);
  s.tint = mapMode && mapNodeFaction !== null ? FACTIONS[mapNodeFaction].boss : 0xff0044;
  s.alpha = 0;
  s.position.set(x, y);

  const sCore = mks(enemyPool, enemyC);
  sCore.texture = shapes.coreTex;
  sCore.scale.set(0.01); sCore.tint = mapMode && mapNodeFaction !== null ? FACTIONS[mapNodeFaction].core : 0xffffff; sCore.alpha = 0; sCore.position.set(x, y);

  const sRing = mks(enemyPool, enemyC);
  sRing.texture = shapes.ringTex;
  sRing.scale.set(0.01); sRing.tint = mapMode && mapNodeFaction !== null ? FACTIONS[mapNodeFaction].ring : 0xff8800; sRing.alpha = 0; sRing.position.set(x, y);
  sRing.position.set(x, y);

  const gs = new PIXI.Sprite(tex8); gs.anchor.set(0.5);
  gs.scale.set(0.01); gs.tint = 0xff6600; gs.alpha = 0;
  gs.position.set(x, y);
  glowC.addChild(gs);

  const gg = new PIXI.Sprite(tex8); gg.anchor.set(0.5);
  gg.scale.set(0.01); gg.tint = 0xff0044; gg.alpha = 0;
  gg.position.set(x, y);
  glowC.addChild(gg);

  const cr = new PIXI.Sprite(tex8); cr.anchor.set(0.5);
  cr.scale.set(0.01); cr.tint = 0xff0000; cr.alpha = 0;
  cr.position.set(x, y);
  glowC.addChild(cr);

  const cb = new PIXI.Sprite(tex8); cb.anchor.set(0.5);
  cb.scale.set(0.01); cb.tint = 0x0044ff; cb.alpha = 0;
  cb.position.set(x, y);
  glowC.addChild(cb);

  // Tendril graphics
  bossTendril = new PIXI.Graphics();
  fxC.addChild(bossTendril);

  const bz = gameC ? gameC.scale.x || 1 : 1;
  const bcy = gameC ? gameC.y : 0;
  const descendY = (height * 0.45 - bcy) / bz;

  boss = {
    sprite: s, spriteCore: sCore, spriteRing: sRing,
    x, y, size: sz,
    hp, maxHP: hp,
    phase: 0, moveDir: 1,
    fireTimer: Math.max(0.5, 1.5 - bossEncounter * 0.08), patternTimer: 0,
    pattern: 0,
    sparkle: gs, glow: gg, chromaR: cr, chromaB: cb,
    entryProgress: 0, patternPhase: 0,
    stunned: 0,
    descendY, descendSpeed: 80 + bossEncounter * 10,
    miniTimer: Math.max(2, 4 - bossEncounter * 0.15)
  };

  const ft = new PIXI.Text('!! BOSS INCOMING !!', {
    fontFamily: 'sans-serif', fontSize: 28, fontWeight: '900',
    fill: 0xff0044, dropShadow: true, dropShadowColor: 0xff0000, dropShadowBlur: 12
  });
  ft.anchor.set(0.5); ft.position.set(width/2, height * 0.35); ft.life = 2.5; ft.vy = -0.4;
  fxC.addChild(ft); fxT.push(ft);

  bossBarOuter.style.display = 'block';
  bossLabel.style.display = 'block';
  waveEl.innerText = 'WAVE ' + wave + ' - BOSS';
}

function updateBoss(dt, now) {
  if (!boss) return;
  const b = boss;

  if (b.entryProgress < 1) {
    b.entryProgress = Math.min(1, b.entryProgress + dt * 0.4);
    b.y += 60 * dt;
    b.x += (cannon.x - b.x) * dt * 0.5;
  }

  const rv = b.entryProgress;
  const scl = (0.05 + 0.95 * rv) * b.size / 8;
  b.sprite.scale.set(scl);
  b.sprite.alpha = rv * 0.95;
  b.sprite.position.set(b.x, b.y);
  b.sprite.rotation = now * 0.002 + b.phase;

  if (b.spriteCore) {
    b.spriteCore.scale.set(scl * 0.6);
    b.spriteCore.alpha = rv * (0.8 + Math.sin(now * 0.01 + b.phase) * 0.2);
    b.spriteCore.position.set(b.x, b.y);
    b.spriteCore.rotation = -now * 0.003;
  }
  if (b.spriteRing) {
    b.spriteRing.scale.set(scl * 1.5);
    b.spriteRing.alpha = rv * 0.7;
    b.spriteRing.position.set(b.x, b.y);
    b.spriteRing.rotation = now * 0.001;
  }

  if (b.sparkle) {
    b.sparkle.scale.set(scl * 1.8);
    b.sparkle.alpha = (0.2 + Math.sin(now * 0.005 + b.phase) * 0.3) * rv;
    b.sparkle.position.set(b.x, b.y);
    b.sparkle.tint = rcol();
  }
  if (b.glow) {
    b.glow.scale.set(scl * 2.5);
    b.glow.alpha = (0.15 + Math.sin(now * 0.004 + b.phase) * 0.2) * rv;
    b.glow.position.set(b.x, b.y);
  }
  if (b.chromaR) {
    const ca = Math.sin(now * 0.006 + b.phase) * 0.5 + 0.5;
    b.chromaR.alpha = ca * 0.35 * rv;
    b.chromaR.scale.set(scl * (1 + ca * 0.8));
    b.chromaR.position.set(b.x - 4 - ca * 3, b.y - 2 - ca * 2);
  }
  if (b.chromaB) {
    const ca = Math.sin(now * 0.006 + b.phase + 0.7) * 0.5 + 0.5;
    b.chromaB.alpha = ca * 0.35 * rv;
    b.chromaB.scale.set(scl * (1 + ca * 0.8));
    b.chromaB.position.set(b.x + 4 + ca * 3, b.y + 2 + ca * 2);
  }

  bossBarFill.style.width = Math.max(0, (b.hp / b.maxHP) * 100) + '%';

  // Descend to mid-screen
  if (b.y < b.descendY) {
    b.y += b.descendSpeed * dt;
    if (b.y > b.descendY) b.y = b.descendY;
  }

  if (b.entryProgress < 1) return;

  // Vertical oscillation at mid-screen
  b.y = b.descendY + Math.sin(now * 0.002 + b.phase) * 20;

  b.patternTimer += dt;
  const bz = gameC ? gameC.scale.x || 1 : 1;
  const bCx = gameC ? gameC.x : 0;
  const bL = -bCx / bz;
  const bR = (width - bCx) / bz;
  b.x += b.moveDir * (40 + b.patternPhase * 10) * dt;
  if (b.x < bL + b.size) { b.x = bL + b.size; b.moveDir = 1; }
  if (b.x > bR - b.size) { b.x = bR - b.size; b.moveDir = -1; }
  b.patternPhase += dt * 0.3;

  // Draw tendrils
  if (bossTendril) {
    bossTendril.clear();
    for (let t = 0; t < 3; t++) {
      const tx = b.x + Math.cos(now * 0.003 + t * 2.1) * b.size * 0.6;
      const ty = b.y + b.size * 0.3 + Math.sin(now * 0.004 + t * 1.7) * 15;
      const ex = b.x + Math.cos(now * 0.002 + t * 2.1 + 0.5) * b.size * 1.2;
      const ey = b.y + b.size * 0.8 + Math.sin(now * 0.005 + t * 1.7 + 0.3) * 25;
      bossTendril.lineStyle(3 - t, 0xff0066, 0.25 - t * 0.06);
      bossTendril.moveTo(tx, ty);
      bossTendril.quadraticCurveTo((tx + ex) / 2 + Math.sin(now * 0.006 + t) * 20, (ty + ey) / 2, ex, ey);
      bossTendril.lineStyle(6 - t * 2, 0xff0044, 0.1 - t * 0.02);
      bossTendril.moveTo(tx, ty);
      bossTendril.quadraticCurveTo((tx + ex) / 2 + Math.sin(now * 0.006 + t + 0.5) * 20, (ty + ey) / 2, ex, ey);
    }
  }

  // Spawn boss minis - groups that wiggle toward player
  const maxMinis = Math.min(30 + Math.floor(wave * 0.4), 200);
  b.miniTimer -= dt;
  if (b.miniTimer <= 0 && bossMinis.length < maxMinis) {
    b.miniTimer = 0.6 + Math.random() * 0.4;
    const spawnCount = Math.min(6 + Math.floor(wave / 2), 20);
    const groupAngleOff = (Math.random() - 0.5) * Math.PI * 0.8;
    for (let s = 0; s < spawnCount && bossMinis.length < maxMinis; s++) {
      const offX = (Math.random() - 0.5) * 15;
      const offY = (Math.random() - 0.5) * 15;
      const mx = b.x + (Math.random() - 0.5) * b.size * 1.8 + offX * 2;
      const my = b.y + (Math.random() - 0.5) * b.size * 0.6 + offY * 2;
      const ms = mks(enemyPool, enemyC);
      ms.scale.set((0.4 + Math.random() * 0.3));
      ms.tint = 0xff4488;
      ms.alpha = 1;
      ms.position.set(mx, my);
      const gs = new PIXI.Sprite(tex4); gs.anchor.set(0.5);
      gs.scale.set(0.01); gs.tint = 0xff4488; gs.alpha = 0;
      gs.position.set(mx, my);
      glowC.addChild(gs);
      const mg = new PIXI.Sprite(tex4); mg.anchor.set(0.5);
      mg.scale.set(0.01); mg.tint = 0xff4488; mg.alpha = 0;
      mg.position.set(mx, my);
      glowC.addChild(mg);
      const ma = mks(enemyPool, enemyC);
      ma.texture = enemyShapes[Math.floor(Math.random() * enemyShapes.length)];
      ma.scale.set(0.01); ma.tint = rcol(); ma.alpha = 0;
      ma.position.set(mx, my);
      bossMinis.push({
        sprite: ms, accent: ma, sparkle: gs, glow: mg,
        x: mx, y: my, size: 2 + Math.random() * 2,
        phase: Math.random() * Math.PI * 2,
        sparkleSpeed: 2 + Math.random() * 4,
        wigglePhase: Math.random() * Math.PI * 2,
        wiggleSpeed: 1.5 + Math.random() * 2.5,
        groupAngle: groupAngleOff + (Math.random() - 0.5) * 0.3
      });
    }
    // Occasional mini-boss spawn
    if (Math.random() < 0.04 + wave * 0.002 && miniBosses.length < 5) spawnMiniBoss();
  }

  // Update boss minis - wiggle toward player
  const mz = gameC ? gameC.scale.x || 1 : 1;
  const mCx = gameC ? gameC.x : 0;
  const mCy = gameC ? gameC.y : 0;
  const mL = -mCx / mz;
  const mR = (width - mCx) / mz;
  const mT = -mCy / mz;
  const mB = (height - mCy) / mz;
  for (let i = bossMinis.length - 1; i >= 0; i--) {
    const m = bossMinis[i];
    const ha = Math.atan2(cannon.y - m.y, cannon.x - m.x);
    const speed = (80 + Math.min(wave * 1.5, 600) + Math.random() * 20) / (zoom || 1);
    const perp = ha + Math.PI / 2;
    const wig = Math.sin(now * 0.004 * m.wiggleSpeed + m.wigglePhase) * (40 + Math.min(wave * 0.4, 80));
    m.x += (Math.cos(ha) * speed + Math.cos(perp) * wig) * dt;
    m.y += (Math.sin(ha) * speed + Math.sin(perp) * wig) * dt;

    const pu = Math.sin(now * 0.003 * m.sparkleSpeed + m.phase) * 0.5 + 0.5;
    const pu2 = Math.sin(now * 0.004 * m.sparkleSpeed + m.phase + 0.7) * 0.5 + 0.5;
    if (m.sparkle) {
      m.sparkle.alpha = 0.3 + pu * 0.7;
      m.sparkle.scale.set((2 + pu * 4));
      m.sparkle.position.set(m.x, m.y);
      m.sparkle.tint = rcol();
    }
    if (m.glow) {
      m.glow.alpha = (0.2 + pu2 * 0.6);
      m.glow.scale.set((1.5 + pu2 * 3));
      m.glow.position.set(m.x, m.y);
      m.glow.tint = rcol();
    }
    m.sprite.scale.set((0.4 + pu * 0.3));
    m.sprite.position.set(m.x, m.y);
    m.sprite.tint = rcol();
    if (m.accent) {
      m.accent.scale.set((0.3 + pu * 0.3));
      m.accent.position.set(m.x + 1, m.y - 1);
      m.accent.alpha = 0.4 + pu * 0.5;
      m.accent.tint = rcol();
    }

    // Collision with cannon
    const dxc = m.x - cannon.x, dyc = m.y - cannon.y;
    if (dxc * dxc + dyc * dyc < 8 * 8) {
      spawnExplosion(m.x, m.y, 0xff4488, 3);
      if (m.sparkle) { glowC.removeChild(m.sparkle); m.sparkle.destroy(); }
      if (m.glow) { glowC.removeChild(m.glow); m.glow.destroy(); }
      if (m.accent) { m.accent.visible = false; enemyPool.push(m.accent); enemyC.removeChild(m.accent); }
      m.sprite.visible = false; enemyPool.push(m.sprite); enemyC.removeChild(m.sprite);
      { bossMinis[i] = bossMinis[bossMinis.length - 1]; bossMinis.pop(); }
      takeDamage();
      continue;
    }
    if (m.x < mL - 10 || m.x > mR + 10 || m.y > mB + 20 || m.y < mT - 20) {
      if (m.sparkle) { glowC.removeChild(m.sparkle); m.sparkle.destroy(); }
      if (m.glow) { glowC.removeChild(m.glow); m.glow.destroy(); }
      if (m.accent) { m.accent.visible = false; enemyPool.push(m.accent); enemyC.removeChild(m.accent); }
      m.sprite.visible = false; enemyPool.push(m.sprite); enemyC.removeChild(m.sprite);
      { bossMinis[i] = bossMinis[bossMinis.length - 1]; bossMinis.pop(); }
      continue;
    }

    // Laser hit detection
    
    const cx = Math.floor(m.x / 60), cy = Math.floor(m.y / 60);
    const nearbyLasers = [];
    for(let dx=-1;dx<=1;dx++) for(let dy=-1;dy<=1;dy++) {
      const arr = LASER_GRID.get((cx+dx)+','+(cy+dy));
      if(arr) nearbyLasers.push(...arr);
    }
    for (let j = 0; j < nearbyLasers.length; j++) {
      const l = nearbyLasers[j];
      if (l.dead) continue;

      const dx = m.x - l.x, dy = m.y - l.y;
      const hitR = m.size * 0.5 + 6;
      if (dx * dx + dy * dy < hitR * hitR) {
        if (l.mine && l.hitEnemies.indexOf(m) < 0) { l.hitEnemies.push(m); const ang = Math.atan2(l.vy, l.vx); const norm = Math.atan2(m.y - l.y, m.x - l.x); const reflect = 2 * norm - ang; l.vx = Math.cos(reflect) * l.speed; l.vy = Math.sin(reflect) * l.speed; l.x += l.vx * 0.02; l.y += l.vy * 0.02; const hitCol = 0xcc8844; l.sprite.tint = hitCol; if (l.orbitals) { for (const orb of l.orbitals) { orb.sprite.tint = hitCol; } } spawnExplosion(l.x, l.y, hitCol, 10); }
        if (l.blast || l.nova || l.singularity) spawnExplosion(l.x, l.y, l.sprite.tint || 0xff0044, 6);
        if (l.gravity) { for (const ge of enemies) { const gd = Math.hypot(ge.x - l.x, ge.y - l.y); if (gd < 120 + (l.gravLvl||0) * 10) { const pull = 180 / Math.max(gd, 10); ge.vx += (l.x - ge.x) / gd * pull; ge.vy += (l.y - ge.y) / gd * pull; } } }
        if (l.glacier) { for (const ge of enemies) { const gd = Math.hypot(ge.x - l.x, ge.y - l.y); if (gd < 60 + (l.glacierLvl||0) * 8) { ge.slowTimer = Math.max(ge.slowTimer || 0, 1.5 + (l.glacierLvl||0) * 0.3); } } }
        if (l.time) { const sr = 120 + (l.timeLvl||0) * 15; for (const et of enemies) { const dd = Math.hypot(et.x - l.x, et.y - l.y); if (dd < sr && et.y > 0) { et.slowTimer = Math.max(et.slowTimer || 0, 1.5 + (l.timeLvl||0) * 0.3); } } }
        spawnExplosion(l.x, l.y, 0xff4488, 2);
        if (m.sparkle) { glowC.removeChild(m.sparkle); m.sparkle.destroy(); }
        if (m.glow) { glowC.removeChild(m.glow); m.glow.destroy(); }
        if (m.accent) { m.accent.visible = false; enemyPool.push(m.accent); enemyC.removeChild(m.accent); }
        m.sprite.visible = false; enemyPool.push(m.sprite); enemyC.removeChild(m.sprite);
        { bossMinis[i] = bossMinis[bossMinis.length - 1]; bossMinis.pop(); }
        if (l.ion) {
            spawnExplosion(eb.x, eb.y, 0x00aaff, 20);
            for (const oe of enemies) {
                if (Math.hypot(oe.x - eb.x, oe.y - eb.y) < 150) {
                    oe.hp -= 20;
                    oe.slowTimer = 3;
                }
            }
        }
        if (!l.pierce) {
          l.sprite.visible = false; laserPool.push(l.sprite); laserC.removeChild(l.sprite);
          l.dead = true;
        }
        break;
      }
    }
  }

  // Boss fires blaster at player independently
  if (b.y > 0 && b.entryProgress >= 1) {
    if (!b.blasterTimer || b.blasterTimer <= 0) b.blasterTimer = 1.5;
    b.blasterTimer -= dt;
    if (b.blasterTimer <= 0) {
      b.blasterTimer = 1.2 + Math.random() * 0.8;
      spawnEnemyBlaster(b.x, b.y + b.size * 0.3, cannon.x, cannon.y, b.size);
    }
  }

  b.fireTimer -= dt;
  if (b.fireTimer <= 0) {
    const patternIdx = Math.floor(b.patternPhase / 1.8) % 6;
    const angToPlayer = Math.atan2(cannon.y - b.y, cannon.x - b.x);

    if (patternIdx === 0) {
      for (let i = -3; i <= 3; i++) {
        const a = angToPlayer + i * 0.18;
        spawnEnemyBullet(b.x, b.y + b.size * 0.3, a, null, true);
      }
    } else if (patternIdx === 1) {
      spawnEnemyBullet(b.x, b.y + b.size * 0.3, angToPlayer, null, true);
      spawnEnemyBullet(b.x, b.y + b.size * 0.3, angToPlayer - 0.45, null, true);
      spawnEnemyBullet(b.x, b.y + b.size * 0.3, angToPlayer + 0.45, null, true);
      spawnEnemyBullet(b.x, b.y + b.size * 0.3, angToPlayer, null, true, null, false, true);
    } else if (patternIdx === 2) {
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 + b.patternPhase * 0.5;
        spawnEnemyBullet(b.x, b.y + b.size * 0.3, a, null, true);
      }
    } else if (patternIdx === 3) {
      for (let i = 0; i < 3; i++) {
        const a = angToPlayer + (i - 1) * 0.35;
        spawnEnemyBullet(b.x, b.y + b.size * 0.3, a, null, true, null, true);
      }
    } else if (patternIdx === 4) {
      for (let i = 0; i < 6; i++) {
        const a = angToPlayer + (i - 2.5) * 0.12 + Math.sin(b.patternPhase) * 0.2;
        spawnEnemyBullet(b.x, b.y + b.size * 0.3, a, null, true);
      }
      spawnEnemyBullet(b.x, b.y + b.size * 0.3, angToPlayer, null, true, null, false, true);
    } else {
      // Spiral burst
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2 + now * 0.003;
        spawnEnemyBullet(b.x, b.y + b.size * 0.3, a, null, true);
      }
    }
    b.fireTimer = Math.max(0.5, 1.4 - wave * 0.03);
  }

  for (let j = lasers.length - 1; j >= 0; j--) {
    const l = lasers[j];
    const dx = b.x - l.x, dy = b.y - l.y;
    const hitRadius = b.size * 0.5;
    if (dx * dx + dy * dy < hitRadius * hitRadius) {
      b.hp--;
      playHitSnd();
      spawnExplosion(l.x, l.y, 0xff4400, 5);
      if (!l.pierce) {
        l.sprite.visible = false; laserPool.push(l.sprite); laserC.removeChild(l.sprite);
        l.dead = true;
      }
      if (b.hp <= 0 && !b.dead) { b.dead = true;
        bossDefeated();
        break;
      }
    }
  }
}

function bossDefeated() {
  if (!boss) return;
  bgmTrack(1);
  const b = boss;
  playBossExplosionSnd();
  spawnExplosion(b.x, b.y, 0xff0044, 40);
  spawnExplosion(b.x - 20, b.y + 10, 0xff8800, 30);
  spawnExplosion(b.x + 20, b.y - 10, 0xff00ff, 30);

  // Clean up boss minis
  for (const m of bossMinis) {
    m.sprite.visible = false; enemyPool.push(m.sprite); enemyC.removeChild(m.sprite);
    if (m.accent) { m.accent.visible = false; enemyPool.push(m.accent); enemyC.removeChild(m.accent); }
    if (m.sparkle) { glowC.removeChild(m.sparkle); m.sparkle.destroy(); }
    if (m.glow) { glowC.removeChild(m.glow); m.glow.destroy(); }
  }
  bossMinis.length = 0;
  if (bossTendril) { fxC.removeChild(bossTendril); bossTendril.destroy(); bossTendril = null; }

  const bonus = 10 * wave * (1 + bossEncounter * 0.04);
  score += bonus;
  const ft = new PIXI.Text('BOSS +' + Math.floor(bonus) + '!', {
    fontFamily: 'sans-serif', fontSize: 32, fontWeight: '900',
    fill: 0xff0044, dropShadow: true, dropShadowColor: 0xffff00, dropShadowBlur: 12
  });
  ft.anchor.set(0.5); ft.position.set(width/2, height * 0.4); ft.life = 2.5; ft.vy = -0.6;
  fxC.addChild(ft); fxT.push(ft);
  updateUI();



  b.sprite.visible = false; enemyPool.push(b.sprite); enemyC.removeChild(b.sprite);
  if (b.spriteCore) { b.spriteCore.visible = false; enemyPool.push(b.spriteCore); enemyC.removeChild(b.spriteCore); }
  if (b.spriteRing) { b.spriteRing.visible = false; enemyPool.push(b.spriteRing); enemyC.removeChild(b.spriteRing); }
  if (b.sparkle) { glowC.removeChild(b.sparkle); b.sparkle.destroy(); }
  if (b.glow) { glowC.removeChild(b.glow); b.glow.destroy(); }
  if (b.chromaR) { glowC.removeChild(b.chromaR); b.chromaR.destroy(); }
  if (b.chromaB) { glowC.removeChild(b.chromaB); b.chromaB.destroy(); }
  boss = null;
  bossBarOuter.style.display = 'none';
  bossLabel.style.display = 'none';
  waveEl.innerText = 'Wave ' + wave;
  // Clean up mini bosses
  for (const mb of miniBosses) {
    mb.sprite.visible = false; enemyPool.push(mb.sprite); enemyC.removeChild(mb.sprite);
    if (mb.spriteCore) { mb.spriteCore.visible = false; enemyPool.push(mb.spriteCore); enemyC.removeChild(mb.spriteCore); }
    if (mb.spriteRing) { mb.spriteRing.visible = false; enemyPool.push(mb.spriteRing); enemyC.removeChild(mb.spriteRing); }
    if (mb.sparkle) { glowC.removeChild(mb.sparkle); mb.sparkle.destroy(); }
    if (mb.glow) { glowC.removeChild(mb.glow); mb.glow.destroy(); }
    if (mb.chromaR) { glowC.removeChild(mb.chromaR); mb.chromaR.destroy(); }
    if (mb.chromaB) { glowC.removeChild(mb.chromaB); mb.chromaB.destroy(); }
  }
  miniBosses.length = 0;
  // Clean up boss swarm
  for (const sm of bossSwarm) {
    if (sm.sprite) { sm.sprite.visible = false; enemyPool.push(sm.sprite); enemyC.removeChild(sm.sprite); }
    if (sm.glow) { glowC.removeChild(sm.glow); sm.glow.destroy(); }
  }
  bossSwarm.length = 0;
}

// --- Mini-Boss System ---
function spawnMiniBoss() {
  if (miniBosses.length >= 8) return null;
  const d = DIFF[difficulty];
  const encScale = 1 + bossEncounter * 0.03;
  const hp = Math.round((5 + wave * 4) * d.hpMul * encScale * 8);
  const sz = 24 + Math.min(wave * 0.5, 16);
  const bz = gameC ? gameC.scale.x || 1 : 1;
  const bcy = gameC ? gameC.y : 0;
  const bTop = -bcy / bz;
  const x = cannon.x + (Math.random() - 0.5) * width * 0.3;
  const y = bTop - height * 0.2 / bz;

  const s = mks(enemyPool, enemyC);
  const eliteTex = eliteShapes[Math.floor(Math.random() * eliteShapes.length)];
  s.texture = eliteTex;
  s.scale.set(0.01);
  s.tint = 0xff6600;
  s.alpha = 0;
  s.position.set(x, y);

  const sCore = mks(enemyPool, enemyC);
  sCore.texture = coreShapes[Math.floor(Math.random() * coreShapes.length)];
  sCore.scale.set(0.01); sCore.tint = 0xffffff; sCore.alpha = 0; sCore.position.set(x, y);

  const sRing = mks(enemyPool, enemyC);
  sRing.texture = ringShapes[Math.floor(Math.random() * ringShapes.length)];
  sRing.scale.set(0.01); sRing.tint = 0xffaa00; sRing.alpha = 0; sRing.position.set(x, y);
  sRing.position.set(x, y);

  const gs = new PIXI.Sprite(tex4); gs.anchor.set(0.5);
  gs.scale.set(0.01); gs.tint = 0xff8800; gs.alpha = 0;
  gs.position.set(x, y);
  glowC.addChild(gs);

  const gg = new PIXI.Sprite(tex4); gg.anchor.set(0.5);
  gg.scale.set(0.01); gg.tint = 0xff4400; gg.alpha = 0;
  gg.position.set(x, y);
  glowC.addChild(gg);

  const cr = new PIXI.Sprite(tex4); cr.anchor.set(0.5);
  cr.scale.set(0.01); cr.tint = 0xff0000; cr.alpha = 0;
  cr.position.set(x, y);
  glowC.addChild(cr);

  const cb = new PIXI.Sprite(tex4); cb.anchor.set(0.5);
  cb.scale.set(0.01); cb.tint = 0x0044ff; cb.alpha = 0;
  cb.position.set(x, y);
  glowC.addChild(cb);

  const descendY = (height * 0.5 - bcy) / bz;
  const mb = {
    sprite: s, spriteCore: sCore, spriteRing: sRing,
    x, y, size: sz,
    hp, maxHP: hp,
    phase: Math.random() * Math.PI * 2,
    moveDir: 1, fireTimer: 1 + Math.random() * 0.5,
    sparkle: gs, glow: gg, chromaR: cr, chromaB: cb,
    entryProgress: 0, patternPhase: 0,
    descendY, descendSpeed: 50 + bossEncounter * 5,
    behavior: ['orbit','charge','weave','spiral','burst'][Math.floor(Math.random() * 5)]
  };
  miniBosses.push(mb);
  return mb;
}

function updateMiniBosses(dt, now) {
  const bz = gameC ? gameC.scale.x || 1 : 1;
  const bCx = gameC ? gameC.x : 0;
  const bCy = gameC ? gameC.y : 0;
  const bL = -bCx / bz;
  const bR = (width - bCx) / bz;
  const bT = -bCy / bz;

  for (let i = miniBosses.length - 1; i >= 0; i--) {
    const mb = miniBosses[i];

    if (mb.entryProgress < 1) {
      mb.entryProgress = Math.min(1, mb.entryProgress + dt * 0.5);
      mb.y += 50 * dt;
      mb.x += (cannon.x - mb.x) * dt * 0.4;
    }

    const rv = mb.entryProgress;
    const scl = (0.05 + 0.95 * rv) * mb.size / 8;
    mb.sprite.scale.set(scl);
    mb.sprite.alpha = rv * 0.95;
    mb.sprite.position.set(mb.x, mb.y);
    mb.sprite.rotation = now * 0.003 + mb.phase;

    if (mb.spriteCore) {
      mb.spriteCore.scale.set(scl * 0.5);
      mb.spriteCore.alpha = rv * (0.8 + Math.sin(now * 0.01 + mb.phase) * 0.2);
      mb.spriteCore.position.set(mb.x, mb.y);
      mb.spriteCore.rotation = -now * 0.004;
    }
    if (mb.spriteRing) {
      mb.spriteRing.scale.set(scl * 1.4);
      mb.spriteRing.alpha = rv * 0.6;
      mb.spriteRing.position.set(mb.x, mb.y);
      mb.spriteRing.rotation = now * 0.002;
    }

    if (mb.sparkle) {
      mb.sparkle.scale.set(scl * 1.5);
      mb.sparkle.alpha = (0.2 + Math.sin(now * 0.006 + mb.phase) * 0.3) * rv;
      mb.sparkle.position.set(mb.x, mb.y);
      mb.sparkle.tint = rcol();
    }
    if (mb.glow) {
      mb.glow.scale.set(scl * 2);
      mb.glow.alpha = (0.15 + Math.sin(now * 0.005 + mb.phase) * 0.2) * rv;
      mb.glow.position.set(mb.x, mb.y);
    }
    if (mb.chromaR) {
      const ca = Math.sin(now * 0.007 + mb.phase) * 0.5 + 0.5;
      mb.chromaR.alpha = ca * 0.35 * rv;
      mb.chromaR.scale.set(scl * (1 + ca * 0.8));
      mb.chromaR.position.set(mb.x - 3 - ca * 2, mb.y - 1 - ca * 2);
    }
    if (mb.chromaB) {
      const ca = Math.sin(now * 0.007 + mb.phase + 0.7) * 0.5 + 0.5;
      mb.chromaB.alpha = ca * 0.35 * rv;
      mb.chromaB.scale.set(scl * (1 + ca * 0.8));
      mb.chromaB.position.set(mb.x + 3 + ca * 2, mb.y + 1 + ca * 2);
    }

    if (mb.y < mb.descendY) {
      mb.y += mb.descendSpeed * dt;
      if (mb.y > mb.descendY) mb.y = mb.descendY;
    }
    if (mb.entryProgress < 1) continue;

    mb.y = mb.descendY + Math.sin(now * 0.003 + mb.phase) * 15;
    mb.x += mb.moveDir * (30 + mb.patternPhase * 8) * dt;
    if (mb.x < bL + mb.size) { mb.x = bL + mb.size; mb.moveDir = 1; }
    if (mb.x > bR - mb.size) { mb.x = bR - mb.size; mb.moveDir = -1; }
    mb.patternPhase += dt * 0.4;

    // Behavior-specific movement
    if (mb.behavior === 'orbit') {
      const ox = cannon.x + Math.sin(now * 0.002 + mb.phase) * 120;
      const oy = cannon.y - 80 + Math.cos(now * 0.002 + mb.phase) * 60;
      mb.x += (ox - mb.x) * dt * 0.5;
      mb.y += (oy - mb.y) * dt * 0.5;
    } else if (mb.behavior === 'charge') {
      const dxC = cannon.x - mb.x, dyC = cannon.y - mb.y;
      const dC = Math.hypot(dxC, dyC) || 1;
      mb.vx = (mb.vx || 0) + (dxC / dC) * 40 * dt;
      mb.vy = (mb.vy || 0) + (dyC / dC) * 30 * dt;
      mb.vx = Math.max(-60, Math.min(60, mb.vx || 0));
      mb.vy = Math.max(-40, Math.min(40, mb.vy || 0));
      mb.x += (mb.vx || 0) * dt;
      mb.y += (mb.vy || 0) * dt;
    } else if (mb.behavior === 'weave') {
      mb.x += Math.sin(now * 0.005 + mb.phase) * 60 * dt;
    }

    // Fire at player
    mb.fireTimer -= dt;
    if (mb.fireTimer <= 0) {
      mb.fireTimer = 0.8 + Math.random() * 0.6;
      const ang = Math.atan2(cannon.y - mb.y, cannon.x - mb.x);
      for (let i = -2; i <= 2; i++) {
        spawnEnemyBullet(mb.x, mb.y + mb.size * 0.3, ang + i * 0.2, null, true);
      }
    }

    // Hit by lasers
    
    const cx = Math.floor(e.x / 60), cy = Math.floor(e.y / 60);
    const nearbyLasers = [];
    for(let dx=-1;dx<=1;dx++) for(let dy=-1;dy<=1;dy++) {
      const arr = LASER_GRID.get((cx+dx)+','+(cy+dy));
      if(arr) nearbyLasers.push(...arr);
    }
    for (let j = 0; j < nearbyLasers.length; j++) {
      const l = nearbyLasers[j];
      if (l.dead) continue;

      const dx = mb.x - l.x, dy = mb.y - l.y;
      if (dx * dx + dy * dy < mb.size * mb.size * 0.25) {
        mb.hp--;
        spawnExplosion(l.x, l.y, 0xff6600, 4);
        if (l.ion) {
            spawnExplosion(eb.x, eb.y, 0x00aaff, 20);
            for (const oe of enemies) {
                if (Math.hypot(oe.x - eb.x, oe.y - eb.y) < 150) {
                    oe.hp -= 20;
                    oe.slowTimer = 3;
                }
            }
        }
        if (!l.pierce) {
          l.sprite.visible = false; laserPool.push(l.sprite); laserC.removeChild(l.sprite);
          l.dead = true;
        }
        if (mb.hp <= 0 && !mb.dead) { mb.dead = true;
          score += Math.floor(1000 * wave * (difficulty === 'hardcore' ? 2.5 : difficulty === 'hard' ? 1.5 : 1));
          spawnExplosion(mb.x, mb.y, 0xff6600, 25);
          if (mb.sparkle) { glowC.removeChild(mb.sparkle); mb.sparkle.destroy(); }
          if (mb.glow) { glowC.removeChild(mb.glow); mb.glow.destroy(); }
          if (mb.chromaR) { glowC.removeChild(mb.chromaR); mb.chromaR.destroy(); }
          if (mb.chromaB) { glowC.removeChild(mb.chromaB); mb.chromaB.destroy(); }
          if (mb.spriteCore) { mb.spriteCore.visible = false; enemyPool.push(mb.spriteCore); enemyC.removeChild(mb.spriteCore); }
          if (mb.spriteRing) { mb.spriteRing.visible = false; enemyPool.push(mb.spriteRing); enemyC.removeChild(mb.spriteRing); }
          mb.sprite.visible = false; enemyPool.push(mb.sprite); enemyC.removeChild(mb.sprite);
          { miniBosses[i] = miniBosses[miniBosses.length - 1]; miniBosses.pop(); }
          updateUI();
          const ft = new PIXI.Text('MINI BOSS +' + Math.floor(50 * wave) + '!', {
            fontFamily: 'sans-serif', fontSize: 24, fontWeight: '900',
            fill: 0xff6600, dropShadow: true, dropShadowColor: 0xffff00, dropShadowBlur: 10
          });
          ft.anchor.set(0.5); ft.position.set(width/2, height * 0.4); ft.life = 2; ft.vy = -0.5;
          fxC.addChild(ft); fxT.push(ft);
          break;
        }
      }
    }
  }
}

// --- Boss Swirl Swarm ---
function updateBossSwarm(dt, now) {
  if (!boss) return;
  const b = boss;
  const swirlRadius = b.size * 1.8 + Math.sin(now * 0.001) * 20;
  const swirlSpeed = 0.8 + Math.sin(now * 0.0005) * 0.3;
  const swarmCount = Math.min(12 + Math.floor(wave * 0.2), 40);

  while (bossSwarm.length < swarmCount) {
    const ang = Math.random() * Math.PI * 2;
    const r = swirlRadius * (0.6 + Math.random() * 0.4);
    const sx = b.x + Math.cos(ang) * r;
    const sy = b.y + Math.sin(ang) * r;
    const ss = mks(enemyPool, enemyC);
    ss.scale.set(0.01);
    ss.tint = rcol();
    ss.alpha = 0;
    ss.position.set(sx, sy);
    const sg = new PIXI.Sprite(tex4); sg.anchor.set(0.5);
    sg.scale.set(0.01); sg.tint = rcol(); sg.alpha = 0;
    sg.position.set(sx, sy);
    glowC.addChild(sg);
    bossSwarm.push({
      sprite: ss, glow: sg, x: sx, y: sy,
      ang: ang, radius: r, speed: 0.4 + Math.random() * 0.6,
      phase: Math.random() * Math.PI * 2,
      size: 1.5 + Math.random() * 2,
      attackTimer: Math.random() * 3
    });
  }

  for (let i = bossSwarm.length - 1; i >= 0; i--) {
    const sm = bossSwarm[i];
    sm.ang += swirlSpeed * sm.speed * dt;
    sm.x = b.x + Math.cos(sm.ang + now * 0.0005) * sm.radius;
    sm.y = b.y + Math.sin(sm.ang + now * 0.0005) * sm.radius;
    const pu = Math.sin(now * 0.004 + sm.phase) * 0.5 + 0.5;
    sm.sprite.scale.set(0.3 + pu * 0.3);
    sm.sprite.position.set(sm.x, sm.y);
    sm.sprite.alpha = 0.5 + pu * 0.4;
    if (sm.glow) {
      sm.glow.scale.set(0.6 + pu * 0.8);
      sm.glow.position.set(sm.x, sm.y);
      sm.glow.alpha = 0.2 + pu * 0.5;
      sm.glow.tint = rcol();
    }
    sm.attackTimer -= dt;
    if (sm.attackTimer <= 0) {
      sm.attackTimer = 2 + Math.random() * 3;
      const ang2 = Math.atan2(cannon.y - sm.y, cannon.x - sm.x);
      for (let s = 0; s < 3; s++) {
        spawnEnemyBullet(sm.x, sm.y, ang2 + (s - 1) * 0.25, null, false, sm.size);
      }
    }
    // Laser hits
    
    const cx = Math.floor(sm.x / 60), cy = Math.floor(sm.y / 60);
    const nearbyLasers = [];
    for(let dx=-1;dx<=1;dx++) for(let dy=-1;dy<=1;dy++) {
      const arr = LASER_GRID.get((cx+dx)+','+(cy+dy));
      if(arr) nearbyLasers.push(...arr);
    }
    for (let j = 0; j < nearbyLasers.length; j++) {
      const l = nearbyLasers[j];
      if (l.dead) continue;

      const dx = sm.x - l.x, dy = sm.y - l.y;
      if (dx * dx + dy * dy < 12 * 12) {
        if (sm.glow) { glowC.removeChild(sm.glow); sm.glow.destroy(); }
        sm.sprite.visible = false; enemyPool.push(sm.sprite); enemyC.removeChild(sm.sprite);
        { bossSwarm[i] = bossSwarm[bossSwarm.length - 1]; bossSwarm.pop(); }
        spawnExplosion(l.x, l.y, 0xff8800, 4);
        if (l.ion) {
            spawnExplosion(eb.x, eb.y, 0x00aaff, 20);
            for (const oe of enemies) {
                if (Math.hypot(oe.x - eb.x, oe.y - eb.y) < 150) {
                    oe.hp -= 20;
                    oe.slowTimer = 3;
                }
            }
        }
        if (!l.pierce) {
          l.sprite.visible = false; laserPool.push(l.sprite); laserC.removeChild(l.sprite);
          l.dead = true;
        }
        break;
      }
    }
  }
}

// --- Enemy Bullets ---
function spawnEnemyBullet(x, y, ang, sourceEnemy, isBoss, enemySize, isBounce, isHoming, isMine) {
  if (enemyBullets.length >= 1200) return;
  const s = mks(enemyBulletPool, enemyBulletC);
  const buffed = sourceEnemy && sourceEnemy.buffed;
  const spd = isMine ? 20 : (((isBoss ? 120 : ENEMY_BULLET_SPEED * (0.4 + Math.random() * 0.4)) + (buffed ? 30 : 0)) / (zoom || 1));
  const szScale = isMine ? 1.5 : (isBoss ? 1 : (enemySize ? Math.max(0.8, enemySize / 18) : 0.8));
  s.scale.set((isBoss ? 5 / 4 : (szScale * (buffed ? 1.2 : 1))));
  s.tint = isMine ? 0xff0000 : (isBoss ? 0xff8800 : (buffed ? 0xff8800 : 0xff6644));
  s.alpha = 1;
  s.position.set(x, y);
  let gs;
  if (eBulletGlowPool.length) { gs = eBulletGlowPool.pop(); gs.visible = true; glowC.addChild(gs); }
  else { gs = new PIXI.Sprite(tex8); gs.anchor.set(0.5); gs.blendMode = PIXI.BLEND_MODES.ADD; glowC.addChild(gs); }
  gs.scale.set((isBoss ? 8 / 8 : szScale * 2));
  gs.tint = isMine ? 0xffaa00 : (isBoss ? 0xff6600 : (buffed ? 0xff6600 : 0xff4422));
  gs.alpha = isMine ? 0.8 : (0.3 + szScale * 0.2);
  gs.position.set(x, y);
  const bullet = {
    sprite: s, x, y,
    vx: isMine ? 0 : Math.cos(ang) * spd,
    vy: isMine ? spd : Math.sin(ang) * spd,
    glow: gs,
    sourceEnemy,
    homing: isHoming || false,
    bounce: isBounce || false,
    isMine: isMine || false,
    mineTimer: 0,
    bounces: 2,
    speed: spd
  };
  enemyBullets.push(bullet);
}

function spawnEnemyBlaster(x, y, tx, ty, sz) {
  if (enemyBullets.length >= 1200) return;
  const ang = Math.atan2(ty - y, tx - x);
  const s = mks(enemyBulletPool, enemyBulletC);
  const boltSz = Math.max(1.2, (sz || 10) / 8);
  s.scale.set(boltSz);
  s.tint = 0xff44aa;
  s.alpha = 1;
  s.position.set(x, y);
  let gs;
  if (eBulletGlowPool.length) { gs = eBulletGlowPool.pop(); gs.visible = true; glowC.addChild(gs); }
  else { gs = new PIXI.Sprite(tex8); gs.anchor.set(0.5); gs.blendMode = PIXI.BLEND_MODES.ADD; glowC.addChild(gs); }
  gs.scale.set(boltSz * 3);
  gs.tint = 0xff66cc;
  gs.alpha = 0.5;
  gs.position.set(x, y);
  const spd = (200 + Math.random() * 40) / (zoom || 1);
  enemyBullets.push({
    sprite: s, x, y,
    vx: Math.cos(ang) * spd,
    vy: Math.sin(ang) * spd,
    glow: gs, sourceEnemy: null, homing: false, bounce: false, bounces: 0, speed: spd,
    enemyBlaster: true
  });
}

// --- Lasers ---
function spawnLaser() {
  if (lasers.length >= MAX_LASERS) return;
  const ang = cannon.angle;
  const lvl = specialWeapon ? (weaponLevels[specialWeapon] || 0) : 0;
  const SZ = 1 / (1 + lvl * 0.08);
  if (specialWeapon === 'spread') {
    const count = 1 + lvl;
    const spreadAng = Math.max(0.04, 0.09 - lvl * 0.003);
    const offset = (count - 1) * spreadAng / 2;
    for (let i = 0; i < count; i++) {
      const a = ang - offset + i * spreadAng;
      mkLaser(a, i === Math.floor(count / 2) ? 0xff8800 : 0xff6600, 1);
    }
  } else if (specialWeapon === 'rapid') {
    const count = 2 + lvl;
    for (let i = 0; i < count; i++) {
      mkLaser(ang + (Math.random() - 0.5) * 0.08, 0xff0088, 0.8);
    }
  } else if (specialWeapon === 'pierce') {
    const l = mkLaser(ang, 0x00ff88, 1.5 + lvl * 0.1, true);
    if (l) { l.pierce = true; l.sprite.scale.set(1.5 * SZ); l.sprite.tint = 0x00ff88; l.life = 0.6 + lvl * 0.05; }
  } else if (specialWeapon === 'blast') {
    const l = mkLaser(ang, 0x8800ff, 2 + lvl * 0.2, true);
    if (l) { l.blast = true; l.blastLvl = lvl; l.pierce = true; l.sprite.scale.set(2.5 * SZ); l.sprite.tint = 0xaa44ff; l.life = 0.6 + lvl * 0.04; }
  } else if (specialWeapon === 'beam') {
    const l = mkLaser(ang, 0x00ffff, 4 + lvl * 0.5, true);
    if (l) { l.beam = true; l.beamLvl = lvl; l.pierce = true; l.sprite.visible = false; l.sprite.tint = 0x00ffff; l.sprite.scale.set(7.5 * SZ); l.life = 0.3 + lvl * 0.02; l.speed = LASER_SPEED * 4 / (zoom || 1); l.vx = Math.cos(ang) * l.speed; l.vy = Math.sin(ang) * l.speed; l.maxDist = width * 1.2 / (zoom || 1); l.hitEnemies = []; }
  } else if (specialWeapon === 'bolt') {
    const l = mkLaser(ang, 0xffff00, 1.5 + lvl * 0.2, true);
    if (l) { l.bolt = true; l.chainLvl = lvl; l.hitEnemies = []; l.sprite.tint = 0xffff00; l.sprite.scale.set(1.5 * SZ); l.life = 0.6 + lvl * 0.04; l.speed = LASER_SPEED * 0.9 / (zoom || 1); l.vx = Math.cos(ang) * l.speed; l.vy = Math.sin(ang) * l.speed; }
  } else if (specialWeapon === 'homing') {
    const l = mkLaser(ang, 0xff66ff, 1);
    if (l) { l.homing = true; l.speed = LASER_SPEED * (0.7 + lvl * 0.05) / (zoom || 1); }
  } else if (specialWeapon === 'saber') {
    const saberColors = [0x00ff44, 0x0088ff, 0xff2200, 0xaa00ff, 0xffaa00];
    const sc = saberColors[Math.min(lvl, saberColors.length - 1)];
    const l = mkLaser(ang, sc, 4 + lvl * 0.5, true);
    if (l) { l.saber = true; l.saberLvl = lvl; l.pierce = true; l.sprite.visible = false; l.sprite.scale.set(7.5 * SZ); l.sprite.tint = sc; l.life = 0.25 + lvl * 0.02; l.speed = LASER_SPEED * 4 / (zoom || 1); l.vx = Math.cos(ang) * l.speed; l.vy = Math.sin(ang) * l.speed; l.maxDist = width * 0.8 / (zoom || 1); l.hitEnemies = []; }
  } else if (specialWeapon === 'gravity') {
    const l = mkLaser(ang, 0xff4400, 2 + lvl * 0.2, true);
    if (l) { l.gravity = true; l.gravLvl = lvl; l.sprite.scale.set(3 * SZ); l.sprite.tint = 0xff4400; l.life = 0.5 + lvl * 0.03; l.pierce = true; }
  } else if (specialWeapon === 'nova') {
    const l = mkLaser(ang, 0xff0066, 2 + lvl * 0.2, true);
    if (l) { l.nova = true; l.novaLvl = lvl; l.blast = true; l.pierce = true; l.sprite.scale.set(2 * SZ); l.sprite.tint = 0xff0066; l.life = 0.4 + lvl * 0.02; }
  } else if (specialWeapon === 'swarm') {
    const n = 2 + lvl;
    for (let i = 0; i < n; i++) {
      const a2 = ang + (Math.random() - 0.5) * 0.3;
      const s = mkLaser(a2, 0x88ff00, 0.6 + lvl * 0.05);
      if (s) { s.swarm = true; s.homing = true; s.speed = LASER_SPEED * (0.5 + lvl * 0.03) / (zoom || 1); s.life = 0.8 + lvl * 0.05; s.sprite.tint = 0x88ff00; s.sprite.scale.set(0.75 * SZ); }
    }
  } else if (specialWeapon === 'storm') {
    const z = zoom || 1;
    const cx = gameC ? gameC.x : 0;
    const cy = gameC ? gameC.y : 0;
    const sVisLeft = -cx / z;
    const sVisRight = (width - cx) / z;
    const sVisTop = -cy / z;
    const sVisBottom = (height - cy) / z;
    const targetX = cannon.x + (Math.random() - 0.5) * (sVisRight - sVisLeft) * 0.6;
    const targetY = sVisTop + 10 + Math.random() * (sVisBottom - sVisTop) * 0.4;
    const a = Math.atan2(targetY - cannon.y, targetX - cannon.x);
    const bolt = mkLaser(a, 0x4488ff, 1, true);
    if (bolt) { bolt.bolt = true; bolt.chainLvl = Math.min(lvl, 3); bolt.hitEnemies = []; bolt.skipChain = false; bolt.stormBolt = true; bolt.maxChains = 6; bolt.sprite.tint = 0x4488ff; bolt.life = 0.6 + lvl * 0.04; bolt.speed = LASER_SPEED * 1.5 / (zoom || 1); bolt.vx = Math.cos(a) * bolt.speed; bolt.vy = Math.sin(a) * bolt.speed; }
  } else if (specialWeapon === 'shard') {
    const l = mkLaser(ang, 0xffaa00, 2 + lvl * 0.2, true);
    if (l) { l.shard = true; l.shardLvl = lvl; l.pierce = true; l.sprite.scale.set(2 * SZ); l.sprite.tint = 0xffaa00; l.life = 0.6 + lvl * 0.04; }
  } else if (specialWeapon === 'prism') {
    const n = Math.min(3 + lvl, 7);
    const spread2 = 0.15;
    const offset2 = (n - 1) * spread2 / 2;
    const colors2 = [0xff00ff, 0xff88ff, 0xcc00ff, 0xff44aa, 0xaa00ff, 0xff66cc, 0x8800ff];
    for (let i = 0; i < n; i++) {
      const a2 = ang - offset2 + i * spread2;
      const p = mkLaser(a2, colors2[Math.min(i, colors2.length - 1)], 0.8, true);
      if (p) { p.prism = true; p.prismLvl = lvl; p.pierce = true; p.sprite.tint = colors2[Math.min(i, colors2.length - 1)]; p.life = 0.4 + lvl * 0.02; p.speed = LASER_SPEED * 1.1; }
    }
  } else if (specialWeapon === 'flare') {
    const l = mkLaser(ang, 0xff6600, 1.5 + lvl * 0.15, true);
    if (l) { l.flare = true; l.flareLvl = lvl; l.sprite.scale.set(2.5 * SZ); l.sprite.tint = 0xff6600; l.life = 0.5 + lvl * 0.03; l.pierce = true; }
  } else if (specialWeapon === 'vortex') {
    const n = 4 + lvl;
    for (let i = 0; i < n; i++) {
      const a2 = ang + (i / n) * Math.PI * 2;
      const v = mkLaser(a2, 0x00aaff, 0.6 + lvl * 0.04);
      if (v) { v.vortex = true; v.vortexLvl = lvl; v.pierce = true; v.sprite.tint = 0x00aaff; v.sprite.scale.set(0.5 * SZ); v.life = 0.8 + lvl * 0.08; v.speed = LASER_SPEED * 0.9; }
    }
  } else if (specialWeapon === 'echo') {
    const l = mkLaser(ang, 0x44ffaa, 1.2 + lvl * 0.1, true);
    if (l) { l.echo = true; l.echoLvl = lvl; l.pierce = true; l.sprite.scale.set(2 * SZ); l.sprite.tint = 0x44ffaa; l.life = 0.8 + lvl * 0.05; l.speed = LASER_SPEED * 1.2; l.vx = Math.cos(ang) * l.speed; l.vy = Math.sin(ang) * l.speed; l.hitEnemies = []; }
  } else if (specialWeapon === 'tether') {
    const l = mkLaser(ang, 0xff4488, 1.5 + lvl * 0.15, true);
    if (l) { l.tether = true; l.tetherLvl = lvl; l.pierce = true; l.sprite.scale.set(2 * SZ); l.sprite.tint = 0xff4488; l.life = 0.5 + lvl * 0.03; l.hitEnemies = []; }
  } else if (specialWeapon === 'rift') {
    const nearest = enemies.reduce((best, e) => { const d = Math.hypot(e.x - cannon.x, e.y - cannon.y); return d < best.d && e.y > 0 ? { d, e } : best; }, { d: Infinity, e: null }).e;
    if (nearest) {
      const tx = nearest.x + (Math.random() - 0.5) * 20;
      const tz = gameC ? gameC.scale.x || 1 : 1;
      const tcy = gameC ? gameC.y : 0;
      const tTop = -tcy / tz;
      const tBot = (height - tcy) / tz;
      const teleY = tTop + (tBot - tTop) * (0.05 + Math.random() * 0.1);
      cannonSprite.position.set(tx, teleY);
      cannon.x = tx; cannon.y = teleY;
      spawnExplosion(tx, teleY, 0x6644ff, 10);
      const l2 = mkLaser(Math.atan2(nearest.y - teleY, nearest.x - tx), 0x6644ff, 3 + lvl * 0.3, true);
      if (l2) { l2.rift = true; l2.pierce = true; l2.sprite.tint = 0x6644ff; l2.sprite.scale.set(3.5 * SZ); l2.life = 0.5; l2.speed = LASER_SPEED * 2; l2.dmgMul = 2 + lvl * 0.3; }
    }
  } else if (specialWeapon === 'pulse') {
    const n = 5 + lvl;
    for (let i = 0; i < n; i++) {
      const a2 = (i / n) * Math.PI * 2 + Math.random() * 0.3;
      const p = mkLaser(a2, 0x66ffcc, 0.8 + lvl * 0.08);
      if (p) { p.pulse = true; p.pulseLvl = lvl; p.blast = true; p.pierce = true; p.sprite.tint = 0xccffee; p.sprite.blendMode = PIXI.BLEND_MODES.ADD; p.sprite.scale.set(1.25 * SZ); p.life = 0.25 + lvl * 0.03; p.speed = LASER_SPEED * (1.0 + lvl * 0.04); }
    }
  } else if (specialWeapon === 'mine') {
    const count = 1 + Math.floor(lvl / 2);
    for (let bi = 0; bi < count; bi++) {
      const ba = ang + (bi - (count - 1) / 2) * 0.08;
      const b = mkLaser(ba, 0x886644, 1 + lvl * 0.1, true);
      if (b) { b.mine = true; b.bounce = 2 + lvl; b.pierce = true; b.hitEnemies = []; b.sprite.texture = tex4; b.sprite.tint = 0xffcc44; b.sprite.scale.set(0.6 * SZ); b.life = 4 + lvl * 0.5; b.speed = LASER_SPEED * (1.5 + lvl * 0.1); b.vx = Math.cos(ba) * b.speed; b.vy = Math.sin(ba) * b.speed; b.maxDist = 999999;
        const orbitCount = 3 + Math.min(lvl, 3);
        b.orbitals = [];
        for (let oi = 0; oi < orbitCount; oi++) {
          const os = spritePool.length ? spritePool.pop() : new PIXI.Sprite(particleShapes[0]);
          os.anchor.set(0.5); os.texture = particleShapes[Math.floor(Math.random() * particleShapes.length)];
          os.tint = 0xff8844; os.scale.set(0.2 + Math.random() * 0.2); os.blendMode = PIXI.BLEND_MODES.ADD;
          os.alpha = 0.8; fxC.addChild(os);
          b.orbitals.push({ sprite: os, angle: (oi / orbitCount) * Math.PI * 2 + Math.random() * 0.5, radius: 5 + Math.random() * 5, speed: (1.8 + Math.random() * 1.2) * (oi % 2 === 0 ? 1 : -1) });
        }
        b.trailTimer = 0; }
    }
  } else if (specialWeapon === 'void') {
    const l = mkLaser(ang, 0x8800cc, 2 + lvl * 0.2, true);
    if (l) { l.void = true; l.voidLvl = lvl; l.pierce = true; l.sprite.tint = 0x8800cc; l.sprite.scale.set(2.5 * SZ); l.life = 0.7 + lvl * 0.05; }
  } else if (specialWeapon === 'time') {
    const l = mkLaser(ang, 0x44ddff, 2 + lvl * 0.2, true);
    if (l) { l.time = true; l.timeLvl = lvl; l.pierce = true; l.sprite.tint = 0x44ddff; l.sprite.scale.set(3 * SZ); l.life = 0.6 + lvl * 0.05; }
  } else if (specialWeapon === 'zenith') {
    const sat = { x: cannon.x, y: cannon.y - 30, lvl, life: 6 + lvl * 1.5, angle: 0, speed: 2 + lvl * 0.2, fireTimer: 0, fireInterval: 0.3 - lvl * 0.01 };
    const g = new PIXI.Graphics();
    g.beginFill(0xffdd00, 0.9); for (let zi = 0; zi < 8; zi++) { const za = zi * Math.PI / 4 - Math.PI / 2; const zr = zi % 2 === 0 ? 8 : 3; g[zi === 0 ? 'moveTo' : 'lineTo'](Math.cos(za) * zr, Math.sin(za) * zr); } g.closePath(); g.endFill();
    g.position.set(sat.x, sat.y); g.blendMode = PIXI.BLEND_MODES.ADD;
    fxC.addChild(g); sat.gfx = g;
    satellites.push(sat);
  } else if (specialWeapon === 'singularity') {
    const l = mkLaser(ang, 0x660066, 2 + lvl * 0.2, true);
    if (l) { l.singularity = true; l.singLvl = lvl; l.blast = true; l.pierce = true; l.sprite.scale.set(2.5 * SZ); l.sprite.tint = 0x660066; l.life = 0.6 + lvl * 0.04; }
  } else if (specialWeapon === 'phantom') {
    const l = mkLaser(ang, 0x8844ff, 1 + lvl * 0.1, true);
    if (l) { l.phantom = true; l.phantomLvl = lvl; l.pierce = true; l.sprite.scale.set(2 * SZ); l.sprite.tint = 0x8844ff; l.life = 0.3 + lvl * 0.02; l.speed = LASER_SPEED * 1.8; l.vx = Math.cos(ang) * l.speed; l.vy = Math.sin(ang) * l.speed; l.hitEnemies = []; }
  } else if (specialWeapon === 'glacier') {
    const l = mkLaser(ang, 0x00ccff, 1.5 + lvl * 0.15, true);
    if (l) { l.glacier = true; l.glacierLvl = lvl; l.pierce = true; l.sprite.scale.set(2.5 * SZ); l.sprite.tint = 0x00ccff; l.life = 0.6 + lvl * 0.04; l.speed = LASER_SPEED * 0.8; l.vx = Math.cos(ang) * l.speed; l.vy = Math.sin(ang) * l.speed; }
  } else if (specialWeapon === 'nebula') {
    const l = mkLaser(ang, 0xff88aa, 1.5 + lvl * 0.1, true);
    if (l) { l.nebula = true; l.nebulaLvl = lvl; l.pierce = true; l.sprite.tint = 0xff88aa; l.sprite.scale.set(2 * SZ); l.life = 0.8 + lvl * 0.06; l.speed = LASER_SPEED * 0.7; l.vx = Math.cos(ang) * l.speed; l.vy = Math.sin(ang) * l.speed; }
  } else if (specialWeapon === 'laser') {
    const l = mkLaser(ang, 0xff4444, 4 + lvl * 0.5, true);
    if (l) { l.laser = true; l.laserLvl = lvl; l.pierce = true; l.sprite.visible = true; l.sprite.tint = 0xff4444; l.sprite.scale.set(3 * SZ); l.life = 0.5 + lvl * 0.04; l.speed = LASER_SPEED * 2.5 / (zoom || 1); l.vx = Math.cos(ang) * l.speed; l.vy = Math.sin(ang) * l.speed; l.maxDist = width * 0.9 / (zoom || 1); l.hitEnemies = []; }
  } else if (specialWeapon === 'ion') {
    const n = 1 + Math.floor(lvl / 2);
    for (let i = 0; i < n; i++) {
      const a2 = ang + (Math.random() - 0.5) * 0.15;
      const s = mkLaser(a2, 0x00ddff, 1 + lvl * 0.1, true);
      if (s) { s.ion = true; s.pierce = true; s.sprite.tint = 0x00ddff; s.sprite.scale.set(1.5 * SZ); s.life = 0.6 + lvl * 0.04; }
    }
  } else if (specialWeapon === 'siphon') {
    const l = mkLaser(ang, 0xff66aa, 2 + lvl * 0.15, true);
    if (l) { l.siphon = true; l.siphonLvl = lvl; l.pierce = true; l.sprite.tint = 0xff66aa; l.sprite.scale.set(2 * SZ); l.life = 0.6 + lvl * 0.05; l.hitEnemies = []; }
  } else if (specialWeapon === 'inferno') {
    const l = mkLaser(ang, 0xff2200, 3 + lvl * 0.4, true);
    if (l) { l.inferno = true; l.infernoLvl = lvl; l.blast = true; l.sprite.tint = 0xff2200; l.sprite.scale.set(3.5 * SZ); l.life = 0.4 + lvl * 0.03; l.speed = LASER_SPEED * 0.7 / (zoom || 1); l.vx = Math.cos(ang) * l.speed; l.vy = Math.sin(ang) * l.speed; l.plasmaTimer = 0; }
  } else if (specialWeapon === 'railgun') {
    const l = mkLaser(ang, 0x44aaff, 2 + lvl * 0.15, true);
    if (l) { l.railgun = true; l.railgunLvl = lvl; l.pierce = true; l.sprite.tint = 0x44aaff; l.sprite.scale.set(1.5 * SZ); l.life = 0.5 + lvl * 0.03; l.speed = LASER_SPEED * 3 / (zoom || 1); l.vx = Math.cos(ang) * l.speed; l.vy = Math.sin(ang) * l.speed; l.hitEnemies = []; }
  } else if (specialWeapon === 'starburst') {
    const n = 3 + lvl;
    for (let i = 0; i < n; i++) {
      const a2 = ang + (i - (n-1)/2) * 0.15;
      const l = mkLaser(a2, 0xffaa00, 2 + lvl * 0.2, true);
      if (l) { l.starburst = true; l.starburstLvl = lvl; l.homing = true; l.sprite.tint = 0xffaa00; l.sprite.scale.set(2 * SZ); l.life = 0.5 + lvl * 0.04; l.speed = LASER_SPEED * 0.7 / (zoom || 1); l.vx = Math.cos(a2) * l.speed; l.vy = Math.sin(a2) * l.speed; }
    }
  } else if (specialWeapon === 'vortexstorm') {
    const n = 4 + lvl;
    for (let i = 0; i < n; i++) {
      const a2 = ang + (i / n) * Math.PI * 2;
      const l = mkLaser(a2, 0x44ddff, 1.5 + lvl * 0.15, true);
      if (l) { l.vortexstorm = true; l.vortexstormLvl = lvl; l.storm = true; l.sprite.tint = 0x44ddff; l.sprite.scale.set(1.25 * SZ); l.life = 0.4 + lvl * 0.02; l.speed = LASER_SPEED * 0.9 / (zoom || 1); l.vx = Math.cos(a2) * l.speed; l.vy = Math.sin(a2) * l.speed; }
    }
  } else if (specialWeapon === 'prismsaber') {
    for (let i = -1; i <= 1; i++) {
      const a2 = ang + i * 0.12;
      const colors = [0xff22ff, 0x00ff44, 0xff8800];
      const l = mkLaser(a2, colors[i+1], 3 + lvl * 0.4, true);
      if (l) { l.prismsaber = true; l.prismsaberLvl = lvl; l.saber = true; l.pierce = true; l.sprite.visible = false; l.sprite.tint = colors[i+1]; l.life = 0.3 + lvl * 0.02; l.speed = LASER_SPEED * 4 / (zoom || 1); l.vx = Math.cos(a2) * l.speed; l.vy = Math.sin(a2) * l.speed; l.maxDist = width * 0.6 / (zoom || 1); l.hitEnemies = []; }
    }
  } else if (specialWeapon === 'phantomflare') {
    const l = mkLaser(ang, 0x8844ff, 2 + lvl * 0.25, true);
    if (l) { l.phantomflare = true; l.phantomflareLvl = lvl; l.pierce = true; l.sprite.tint = 0x8844ff; l.sprite.scale.set(2 * SZ); l.life = 0.6 + lvl * 0.04; l.speed = LASER_SPEED * 0.8 / (zoom || 1); l.vx = Math.cos(ang) * l.speed; l.vy = Math.sin(ang) * l.speed; l.hitEnemies = []; }
  } else if (specialWeapon === 'oblivion') {
    const l = mkLaser(ang, 0x440066, 4 + lvl * 0.5, true);
    if (l) { l.oblivion = true; l.oblivionLvl = lvl; l.sprite.tint = 0x440066; l.sprite.scale.set(4.5 * SZ); l.life = 0.5 + lvl * 0.04; l.speed = LASER_SPEED * 0.5 / (zoom || 1); l.vx = Math.cos(ang) * l.speed; l.vy = Math.sin(ang) * l.speed; l.pullRadius = 80 + lvl * 10; l.pullStrength = 60 + lvl * 8; l.oblivionTimer = 0; }
  } else if (specialWeapon === 'ufo') {
    const burstCount = 3;
    for (let bi = 0; bi < burstCount; bi++) {
      const l = mkLaser(ang + (bi - 1) * 0.15, 0xff0044, 6 + lvl * 0.5, true);
      if (l) {
        l.ufo = true; l.ufoLvl = lvl; l.sprite.tint = 0xff0044;
        const _eIdx = Math.floor(Math.random() * enemyShapes.length);
        l.sprite.texture = enemyShapes[_eIdx];
        const bigSz = 2.5 + lvl * 0.15;
        l.sprite.scale.set(bigSz);
        l.life = 0.7 + lvl * 0.05; l.speed = LASER_SPEED * 0.6 / (zoom || 1);
        l.vx = Math.cos(ang) * l.speed; l.vy = Math.sin(ang) * l.speed;
        l.hitEnemies = []; l.ufoTarget = null;
        l.ufoGlow = new PIXI.Sprite(tex4); l.ufoGlow.anchor.set(0.5);
        l.ufoGlow.tint = 0xff0044; l.ufoGlow.blendMode = PIXI.BLEND_MODES.ADD;
        l.ufoGlow.scale.set(0.01); glowC.addChild(l.ufoGlow);
        const _eIdx2 = (_eIdx + 1 + Math.floor(Math.random() * (enemyShapes.length - 1))) % enemyShapes.length;
        l.ufoAccent = new PIXI.Sprite(enemyShapes[_eIdx2]);
        l.ufoAccent.anchor.set(0.5); l.ufoAccent.tint = 0xff4488;
        l.ufoAccent.scale.set(0.01); l.ufoAccent.blendMode = PIXI.BLEND_MODES.ADD; fxC.addChild(l.ufoAccent);
        l.ufoCore = new PIXI.Sprite(coreShapes[Math.floor(Math.random() * coreShapes.length)]);
        l.ufoCore.anchor.set(0.5); l.ufoCore.tint = 0xffffff;
        l.ufoCore.scale.set(0.01); l.ufoCore.blendMode = PIXI.BLEND_MODES.ADD; fxC.addChild(l.ufoCore);
        l.ufoRing = new PIXI.Sprite(ringShapes[Math.floor(Math.random() * ringShapes.length)]);
        l.ufoRing.anchor.set(0.5); l.ufoRing.tint = 0xff88aa;
        l.ufoRing.scale.set(0.01); l.ufoRing.blendMode = PIXI.BLEND_MODES.ADD; fxC.addChild(l.ufoRing);
      }
    }
  } else if (specialWeapon === 'pulsecannon') {
    const gap = 10 + lvl * 2;
    const perpX = Math.cos(ang + Math.PI / 2), perpY = Math.sin(ang + Math.PI / 2);
    const c1 = mkLaser(ang, 0x66ffcc, 1.2 + lvl * 0.08, false, cannon.x + perpX * gap, cannon.y + perpY * gap);
    const c2 = mkLaser(ang, 0x66ffcc, 1.2 + lvl * 0.08, false, cannon.x - perpX * gap, cannon.y - perpY * gap);
    if (c1) { c1.pulsecannon = true; c1.pulsecannonLvl = lvl; c1.pierce = true; c1.sprite.tint = 0x66ffcc; c1.life = 0.6 + lvl * 0.03; }
    if (c2) { c2.pulsecannon = true; c2.pulsecannonLvl = lvl; c2.pierce = true; c2.sprite.tint = 0x66ffcc; c2.life = 0.6 + lvl * 0.03; }
  } else if (specialWeapon === 'vortexcannon') {
    const gap = 10 + lvl * 2;
    const perpX = Math.cos(ang + Math.PI / 2), perpY = Math.sin(ang + Math.PI / 2);
    const c1 = mkLaser(ang, 0x44ddff, 1.5 + lvl * 0.1, false, cannon.x + perpX * gap, cannon.y + perpY * gap);
    const c2 = mkLaser(ang, 0x44ddff, 1.5 + lvl * 0.1, false, cannon.x - perpX * gap, cannon.y - perpY * gap);
    if (c1) { c1.vortexcannon = true; c1.vortexcannonLvl = lvl; c1.pierce = true; c1.sprite.tint = 0x44ddff; c1.life = 0.8 + lvl * 0.04; c1.speed = LASER_SPEED * 0.9; }
    if (c2) { c2.vortexcannon = true; c2.vortexcannonLvl = lvl; c2.pierce = true; c2.sprite.tint = 0x44ddff; c2.life = 0.8 + lvl * 0.04; c2.speed = LASER_SPEED * 0.9; }
  } else {
    const l = mkLaser(ang, Math.random() < 0.3 ? 0xffffff : 0x44ffff, 1);
    if (l) l.cannonMul = weaponLevels.cannon || 1;
  }
}

function mkLaser(ang, tint, szMul, big, ox, oy) {
  if (lasers.length >= MAX_LASERS) return null;
  const s = mks(laserPool, laserC);
  s.texture = texLaser;
  const lvl = specialWeapon ? (weaponLevels[specialWeapon] || 0) : 0;
  const lsz = (big ? 6 : 4 + Math.random() * 3) * szMul / (1 + lvl * 0.08);
  s.scale.set((lsz / 4));
  s.tint = tint;
  s.alpha = 1.0;
  const cx = ox !== undefined ? ox : cannon.x + Math.cos(ang) * 20;
  const cy = oy !== undefined ? oy : cannon.y + Math.sin(ang) * 20;
  s.position.set(cx, cy);
  const noRange = !!specialWeapon;
  const dCfg = DIFF[difficulty];
  const baseRange = 400 + lvl * 30;
  const maxDist = ((baseRange + Math.random() * 100) * dCfg.rangeMul) / (zoom || 1);
  const minLife = (height / LASER_SPEED) / (zoom || 1);
  const ls = LASER_SPEED / (zoom || 1);
  const l = {
    sprite: s, x: cx, y: cy,
    vx: Math.cos(ang) * ls * (big ? 1.3 : 1),
    vy: Math.sin(ang) * ls * (big ? 1.3 : 1),
    life: Math.max(big ? 0.5 : 0.6, minLife * 0.7), pierce: false, blast: false,
    maxDist, distTraveled: 0, hitEnemies: []
  };
  lasers.push(l);
  return l;
}

// --- Beam Weapon ---

function spawnBeam(lvl) {
  const ang = cannon.angle;
  const len = 200 + lvl * 30;
  const beam = { ang, len, lvl: lvl || 0, life: 0.08, active: true };
  beamLasers.push(beam);
  playFireSnd();
}

function checkBeamCollision(b) {
  const dx = b.endX - b.startX, dy = b.endY - b.startY;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1) return;
  const wpnCfg = WEAPONS.beam;
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    if (b.hitEnemies.indexOf(e) >= 0) continue;
    const ex = e.x - b.startX, ey = e.y - b.startY;
    const t = Math.max(0, Math.min(1, (ex * dx + ey * dy) / len2));
    const px = b.startX + t * dx, py = b.startY + t * dy;
    const ddx = e.x - px, ddy = e.y - py;
    if (ddx * ddx + ddy * ddy < (e.size * 0.5 + 16) * (e.size * 0.5 + 16)) {
      b.hitEnemies.push(e);
      const adj = e.shield > 0 ? wpnCfg.shieldMul : wpnCfg.wepMul;
      e.hp -= Math.round((1 + Math.floor(Math.sqrt(wave))) * DIFF[difficulty].dmgMul * adj);
      spawnExplosion(e.x, e.y, 0x00ffff, 2);
      if (e.hp <= 0 && !e.dead) { e.dead = true;
        const _t = TIERS[e.tier];
        if (_t) {
          const pts = _t.pt;
          score += pts;
          playPopSnd(e.tier);
          spawnExplosion(e.x, e.y, _t.cl[0], 8);
          spawnPowerup(e.x, e.y);
          if (Math.random() < ((DIFF[difficulty].dropChance || 0.4) * 0.08)) spawnSpecialPowerup(e.x, e.y);
          updateUI();
        }
        rmEnemy(i);
        continue;
      }
    }
  }
}

// --- Chain lightning: arc to max targets, then ALL boom at once ---
let _lastChainTime = 0;
function chainLightning(startEnemy, lvl, startX, startY, options = {}) {
  if (!startEnemy || startEnemy.tier === undefined) return;
  const now = performance.now();

  if (options.stormBolt && now - _lastChainTime < 80) return;
  if (options.stormBolt) _lastChainTime = now;
  if (enemies.length > 300) return;
  const maxChains = options.maxChains || Math.min(4 + lvl, 8);
  const validEnemies = [];
  

    for (let ei = enemies.length - 1; ei >= 0; ei--) {
    const e = enemies[ei];
    if (e.tier !== undefined) validEnemies.push(e);
  }
  if (validEnemies.length === 0) return;
  const chained = [startEnemy];
  const chainedSet = new Set([startEnemy]);
  for (let c = 0; c < maxChains; c++) {
    const target = chained[c];
    let next = null, nextDist = 99999;
    for (let i = 0; i < validEnemies.length; i++) {
      const e = validEnemies[i];
      if (chainedSet.has(e)) continue;
      const dx = e.x - target.x, dy = e.y - target.y;
      const d = dx * dx + dy * dy;
      if (d < 14400 && d < nextDist) { nextDist = d; next = e; }
    }
    if (next) { chained.push(next); chainedSet.add(next); }
    else break;
  }
  const g = new PIXI.Graphics();
  fxC.addChildAt(g, 0);
  let px = startX, py = startY;
  for (let c = 0; c < chained.length; c++) {
    const target = chained[c];
    const mx = (px + target.x) / 2 + (Math.random() - 0.5) * 50;
    const my = (py + target.y) / 2 + (Math.random() - 0.5) * 50;
    g.lineStyle(c === 0 ? 4 : 2, 0xffffff, 0.9);
    g.moveTo(px, py); g.lineTo(mx, my); g.lineTo(target.x, target.y);
    g.lineStyle(c === 0 ? 10 : 5, 0x4488ff, 0.4);
    g.moveTo(px, py); g.lineTo(mx, my); g.lineTo(target.x, target.y);
    g.lineStyle(c === 0 ? 20 : 10, 0x0044ff, 0.1);
    g.moveTo(px, py); g.lineTo(mx, my); g.lineTo(target.x, target.y);
    px = target.x; py = target.y;
  }
  const clWpnCfg = specialWeapon ? WEAPONS[specialWeapon] : null;
  const clAdj = clWpnCfg ? (startEnemy.shield > 0 ? clWpnCfg.shieldMul : clWpnCfg.wepMul) : 1;
  const dmg = (12 + lvl * 4) * clAdj;
  for (let ci = 0; ci < chained.length; ci++) {
    const t = chained[ci];
    t.hp -= dmg;
    if (t.hp <= 0 && !t.dead) { t.dead = true;
      const tier = TIERS[t.tier];
      if (tier) { const pts = tier.pt; score += pts; playPopSnd(t.tier); spawnExplosion(t.x, t.y, tier.cl[0], 16 + lvl * 2); spawnPowerup(t.x, t.y); if (Math.random() < ((DIFF[difficulty].dropChance || 0.4) * 0.08)) spawnSpecialPowerup(t.x, t.y); updateUI(); }
      killQueue.push({ e: t, x: t.x, y: t.y, tier: t.tier });
    } else {
      spawnExplosion(t.x, t.y, 0x4488ff, 10 + lvl);
    }
  }
  spawnExplosion(px, py, 0x88aaff, 30 + lvl * 5);
  g.blendMode = PIXI.BLEND_MODES.ADD;
  beams.push({ graphic: g, life: 0.25, hitEnemies: chained });
}
// --- Homing Lasers ---
function homingUpdate(l) {
  if (!l.homing || l.life <= 0) return;
  let target = null, targetDist = 99999;
  for (const e of enemies.concat(boss ? [boss] : [])) {
    if (e.subtype === 'stealth') continue;
    const dx = e.x - l.x, dy = e.y - l.y;
    const d = dx * dx + dy * dy;
    if (d < targetDist && e.y < l.y) { targetDist = d; target = e; }
  }
  if (target) {
    const ha = Math.atan2(target.y - l.y, target.x - l.x);
    const ca = Math.atan2(l.vy, l.vx);
    let diff = ha - ca;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const turnRate = 3.5;
    const na = ca + Math.max(-turnRate * 0.016, Math.min(turnRate * 0.016, diff));
    const sp = l.speed || LASER_SPEED;
    l.vx = Math.cos(na) * sp;
    l.vy = Math.sin(na) * sp;
  }
}


const SHIELD = { name:'SHIELD', color:0xffdd00, desc:'+1 health' };

// --- Powerups ---
function spawnPowerup(x, y, forceWeaponType) {
  const shieldChance = 0.15;
  const isShield = !forceWeaponType && Math.random() < shieldChance;
  let type, w, color;
  if (isShield) {
    type = 'shield'; color = SHIELD.color; w = SHIELD;
  } else if (forceWeaponType) {
    type = forceWeaponType; w = WEAPONS[type]; color = w.color;
  } else {
    type = ALL_WEAPONS[Math.floor(Math.random() * ALL_WEAPONS.length)];
    w = WEAPONS[type]; color = w.color;
  }
  const s = mks(puPool, puC);
  const texKey = type === 'shield' ? 'shield' : type;
  s.texture = puTex[texKey] || puTex.shield;
  s.scale.set(0.65);
  s.tint = color;
  s.alpha = 1;
  s.position.set(x, y);
  const sparkles = [];
  for (let i = 0; i < 6; i++) {
    const sp = new PIXI.Sprite(tex4);
    sp.anchor.set(0.5); sp.scale.set((0.6 + Math.random() * 0.6));
    sp.tint = 0xffffff; sp.alpha = 0.9;
    sp.blendMode = PIXI.BLEND_MODES.ADD;
    sp.position.set(x, y);
    glowC.addChild(sp);
    sparkles.push({ sprite: sp, angle: Math.random() * Math.PI * 2, radius: 6 + Math.random() * 12, speed: 1 + Math.random() * 3, phase: Math.random() * Math.PI * 2 });
  }
  const puSparkle = new PIXI.Sprite(enemyShapes[Math.floor(Math.random() * enemyShapes.length)]);
  puSparkle.anchor.set(0.5); puSparkle.scale.set(0.01);
  puSparkle.tint = 0xffffff; puSparkle.alpha = 0;
  puSparkle.blendMode = PIXI.BLEND_MODES.ADD;
  puSparkle.position.set(x, y);
  glowC.addChild(puSparkle);

  const puChromaR = new PIXI.Sprite(enemyShapes[Math.floor(Math.random() * enemyShapes.length)]);
  puChromaR.anchor.set(0.5); puChromaR.scale.set(0.01);
  puChromaR.tint = 0xff6600; puChromaR.alpha = 0;
  puChromaR.blendMode = PIXI.BLEND_MODES.ADD;
  puChromaR.position.set(x - 1, y - 1);
  glowC.addChild(puChromaR);

  const puChromaB = new PIXI.Sprite(enemyShapes[Math.floor(Math.random() * enemyShapes.length)]);
  puChromaB.anchor.set(0.5); puChromaB.scale.set(0.01);
  puChromaB.tint = 0x0066ff; puChromaB.alpha = 0;
  puChromaB.blendMode = PIXI.BLEND_MODES.ADD;
  puChromaB.position.set(x + 1, y + 1);
  glowC.addChild(puChromaB);

  // Neon ring for visibility
  const neonC = isShield ? [0x44ff88, 0x88ffcc] : [0xff44ff, 0x44ddff];
  const neonDot = new PIXI.Sprite(tex8);
  neonDot.anchor.set(0.5); neonDot.scale.set(0.01);
  neonDot.tint = neonC[0]; neonDot.alpha = 0;
  neonDot.blendMode = PIXI.BLEND_MODES.ADD;
  neonDot.position.set(x, y);
  glowC.addChild(neonDot);
  const neonDot2 = new PIXI.Sprite(tex8);
  neonDot2.anchor.set(0.5); neonDot2.scale.set(0.01);
  neonDot2.tint = neonC[1]; neonDot2.alpha = 0;
  neonDot2.blendMode = PIXI.BLEND_MODES.ADD;
  neonDot2.position.set(x, y);
  glowC.addChild(neonDot2);

  const pu = {
    sprite: s, x, y, vy: -6 - Math.random() * 6, type,
    phase: Math.random() * Math.PI * 2, life: 15, isShield,
    sparkles, puSparkle, puChromaR, puChromaB, neonDot, neonDot2, neonC
  };
  powerups.push(pu);

  const gt = new PIXI.Text(w.name, {
    fontFamily: 'sans-serif', fontSize: 8, fontWeight: '900',
    fill: color, dropShadow: true, dropShadowColor: 0xffffff, dropShadowBlur: 4
  });
  gt.anchor.set(0.5); gt.position.set(x, y + 10); gt.life = 2.5; gt.vy = -0.4; gt.alpha = 0.8;
  fxC.addChild(gt); fxT.push(gt);
}

function getWeaponMaxAmmo(type) {
  const baseRate = type === 'rapid' ? 0.012 : 0.025;
  const base = Math.floor(DIFF[difficulty].weaponTime / baseRate);
  const lvl = specialWeapon === type ? (weaponLevels[type] || 0) : 0;
  const fireMul = Math.max(0.25, 1 - lvl * 0.07);
  return Math.floor(base / fireMul);
}
function refillWeapon(type) {
  const w = WEAPONS[type];
  if (w.time) {
    weaponMaxTimerMs = DIFF[difficulty].weaponTime * 1000;
    weaponTimerMs = weaponMaxTimerMs;
    weaponAmmo = 0; weaponMaxAmmo = 0;
  } else {
    weaponMaxAmmo = getWeaponMaxAmmo(type);
    weaponAmmo = weaponMaxAmmo;
    weaponTimerMs = 0; weaponMaxTimerMs = 0;
  }
  updateWeaponAmmoDisplay();
}
function depleteWeaponLevel() {
  if (!specialWeapon) return;
  const w = specialWeapon;
  weaponLevels[w] = Math.max(0, weaponLevels[w] - 1);
  if (weaponLevels[w] <= 0) {
    const idx = ownedWeapons.indexOf(w);
    if (idx >= 0) { ownedWeapons[idx] = ownedWeapons[ownedWeapons.length - 1]; ownedWeapons.pop(); }
    weaponLevels[w] = 0;
    if (ownedWeapons.length > 0) {
      activeWeapon = ownedWeapons[0];
      specialWeapon = activeWeapon;
      refillWeapon(activeWeapon);
      setWeaponLabel(activeWeapon);
    } else {
      dropWeapon();
    }
  } else {
    refillWeapon(w);
    setWeaponLabel(w);
  }
  updateWeaponDial();
}
function setWeaponLabel(w) {
  if (!w) { weaponLabel.style.opacity = 0; return; }
  const c = WEAPONS[w].color;
  weaponLabel.innerText = WEAPONS[w].name + ' +' + weaponLevels[w];
  weaponLabel.style.color = '#' + c.toString(16).padStart(6, '0');
  weaponLabel.style.opacity = 1;
}
function updateWeaponAmmoDisplay() {
  const el = document.getElementById('weaponAmmoDisplay');
  if (!specialWeapon) { el.style.display = 'none'; return; }
  el.style.display = 'block';
  if (WEAPONS[specialWeapon].time) {
    const secs = (weaponTimerMs / 1000).toFixed(1);
    el.innerText = secs + 's';
  } else {
    el.innerText = weaponAmmo + '/' + weaponMaxAmmo;
  }
}
function collectPowerup(pu) {
  if (pu.isShield) {
    const shieldGain = 0.25;
    health = Math.min(maxHealth, health + shieldGain);
    if (health >= maxHealth && shieldLayers < maxShieldLayers) {
      shieldLayers++;
      health = 0;
    }
    updateUI();
    playPowerupSnd();
  } else {
    const owned = ownedWeapons.indexOf(pu.type) >= 0;
    if (!owned) {
      ownedWeapons.push(pu.type);
      weaponLevels[pu.type] = 1;
      activeWeapon = pu.type;
      specialWeapon = pu.type;
      refillWeapon(pu.type);
      setWeaponLabel(pu.type);
    } else {
      weaponLevels[pu.type] = Math.min(10, weaponLevels[pu.type] + 1);
      WEAPONS[pu.type].dur = Math.min(30, (WEAPONS[pu.type].dur || 12) + 2);
      refillWeapon(pu.type);
      setWeaponLabel(pu.type);
      const ft = new PIXI.Text('LVL ' + weaponLevels[pu.type] + ' RNG+' + WEAPONS[pu.type].dur, {
        fontFamily:'sans-serif',fontSize:16,fontWeight:'900',fill:0xffdd00,
        dropShadow:true,dropShadowColor:0xffffff,dropShadowBlur:6
      });
      ft.anchor.set(0.5); ft.position.set(width/2, height*0.3); ft.life=1.2; ft.vy=-0.8;
      fxC.addChild(ft); fxT.push(ft);
    }
    playPowerupSnd();
    updateWeaponDial();
  }
  puCleanupGlow(pu);
  puRemoveSprite(pu);
}

function puCleanupGlow(pu) {
  if (pu.puSparkle) { glowC.removeChild(pu.puSparkle); pu.puSparkle.destroy(); pu.puSparkle = null; }
  if (pu.puChromaR) { glowC.removeChild(pu.puChromaR); pu.puChromaR.destroy(); pu.puChromaR = null; }
  if (pu.puChromaB) { glowC.removeChild(pu.puChromaB); pu.puChromaB.destroy(); pu.puChromaB = null; }
  if (pu.sparkles) { pu.sparkles.forEach(sp => { glowC.removeChild(sp.sprite); sp.sprite.destroy(); }); pu.sparkles = null; }
  if (pu.neonDot) { glowC.removeChild(pu.neonDot); pu.neonDot.destroy(); pu.neonDot = null; }
  if (pu.neonDot2) { glowC.removeChild(pu.neonDot2); pu.neonDot2.destroy(); pu.neonDot2 = null; }
}
function puRemoveSprite(pu) {
  pu.sprite.visible = false; puPool.push(pu.sprite); puC.removeChild(pu.sprite);
  const idx = powerups.indexOf(pu);
  if (idx >= 0) { powerups[idx] = powerups[powerups.length - 1]; powerups.pop(); }
}
function destroyPowerup(pu) {
  spawnExplosion(pu.x, pu.y, 0xffaa00, 6);
  puCleanupGlow(pu);
  puRemoveSprite(pu);
}

function buffEnemy(e) {
  if (e.buffed) return;
  e.buffed = true;
  e.buffedTimer = 8;
  e.enemyWeapon = 'blaster';
  e.weaponFireTimer = 1 + Math.random() * 0.5;
  e.hp = Math.min(e.hp + 5, (e.baseHP||1) * 3);
  e.fireInterval = Math.max(0.3, e.fireInterval * 0.6);
  e.slowTimer = 0;
  playEmpowerSnd();
  spawnExplosion(e.x, e.y, 0xaa44ff, 16);
}

function dropWeapon() {
  specialWeapon = null;
  activeWeapon = null;
  weaponAmmo = 0; weaponMaxAmmo = 0; weaponTimerMs = 0; weaponMaxTimerMs = 0;
  weaponLabel.style.opacity = 0;
  updateWeaponAmmoDisplay();
  updateWeaponDial();
}

let dialIdx = 0, dialTouchStartY = 0, dialTouchIdx = 0, dialIsDragging = false;
function updateWeaponDial() {
  const dial = document.getElementById('weaponDial');
  dial.innerHTML = '';
  const base = ['cannon'];
  const all = base.concat(ownedWeapons);
  const len = all.length;
  const idx = all.indexOf(activeWeapon);
  if (idx >= 0) dialIdx = idx;
  else if (activeWeapon === null || activeWeapon === 'cannon') dialIdx = 0;
  const itemH = 34, maxVis = Math.min(len, 7);
  const visH = 10 + maxVis * itemH;
  const dialEdge = dialSide === 'R' ? 'right' : 'left';
  const dialOppEdge = dialSide === 'R' ? 'left' : 'right';
  const dialGradOrigin = dialSide === 'R' ? '100%' : '0%';
  dial.style.cssText = 'display:block;position:absolute;' + dialEdge + ':0px;' + dialOppEdge + ':auto;top:' + (height * 0.5 - visH / 2) + 'px;width:72px;height:' + visH + 'px;z-index:15;pointer-events:auto;overflow:hidden;touch-action:none;background:radial-gradient(ellipse 80px 100% at ' + dialGradOrigin + ' 50%,rgba(235,225,215,0.2) 0%,rgba(210,200,190,0.06) 60%,transparent 100%);border-radius:10px;';
  dial.tabIndex = -1;

  function buildItems(centerIdx) {
    const start = Math.max(0, centerIdx - Math.floor(maxVis / 2));
    const end = Math.min(len, start + maxVis);
    dial.innerHTML = '';
    const itemsIn = end - start;
    const offsetY = (visH - itemsIn * itemH) / 2;
    for (let i = start; i < end; i++) {
      const off = i - centerIdx;
      const w = all[i];
      const isActive = i === centerIdx;
      const dist = Math.abs(off) / Math.floor(maxVis / 2);
      const scale = isActive ? 1.15 : Math.max(0.5, 1 - dist * 0.3);
      const alpha = isActive ? 1 : Math.max(0.2, 1 - dist * 0.5);
      const c = WEAPONS[w].color;
      const mute = isActive ? 0 : 0.5 + dist * 0.5;
      const hex = isActive ? '#' + c.toString(16).padStart(6, '0') : '#' + ((Math.round((c >> 16 & 0xff) + (255 - (c >> 16 & 0xff)) * mute) << 16) | (Math.round((c >> 8 & 0xff) + (255 - (c >> 8 & 0xff)) * mute) << 8) | Math.round((c & 0xff) + (255 - (c & 0xff)) * mute)).toString(16).padStart(6, '0');
      const fr = (c >> 16 & 0xff) / 255, fg = (c >> 8 & 0xff) / 255, fb = (c & 0xff) / 255;
      const glowR = Math.round(255 * (1 - (1 - fr) * 0.3)), glowG = Math.round(255 * (1 - (1 - fg) * 0.3)), glowB = Math.round(255 * (1 - (1 - fb) * 0.3));
      const glowHex = '#' + (glowR << 16 | glowG << 8 | glowB).toString(16).padStart(6, '0');
      const el = document.createElement('div');
      const itemSide = dialSide === 'R' ? 'right:50%;transform:translate(50%,-50%)' : 'left:50%;transform:translate(-50%,-50%)';
      el.style.cssText = 'position:absolute;' + itemSide + ' scale(' + scale + ');top:' + (offsetY + (i - start) * itemH + itemH / 2) + 'px;opacity:' + alpha + ';z-index:' + (isActive ? 10 : 1) + ';text-align:center;white-space:nowrap;touch-action:none;pointer-events:auto;transition:transform 0.06s,opacity 0.06s;' + (isActive ? 'background:linear-gradient(90deg,transparent,' + glowHex + '22,transparent);border-radius:4px;padding:2px 0;' : '');
      el.innerHTML = '<div style="font-size:' + (0.5 + scale * 0.35) + 'rem;font-weight:' + (isActive ? 900 : 500) + ';color:' + hex + ';' + (isActive ? 'text-shadow:0 0 8px ' + hex + ',0 0 20px ' + hex + 'aa,0 0 40px ' + hex + '66;' : '') + 'letter-spacing:1px;">' + WEAPONS[w].name + '</div><div style="font-size:0.35rem;color:rgba(255,255,255,0.4);">x' + weaponLevels[w] + '</div>';
      if (isActive) el.style.pointerEvents = 'none';
      el.dataset.idx = i;
      dial.appendChild(el);
    }
  }

  function selectIdx(idx) {
    idx = Math.max(0, Math.min(len - 1, idx));
    if (idx === dialIdx) return;
    dialIdx = idx;
    const w = all[dialIdx];
    if (w === 'cannon') {
      activeWeapon = null; specialWeapon = null;
      weaponAmmo = 0; weaponMaxAmmo = 0; weaponTimerMs = 0; weaponMaxTimerMs = 0;
      weaponLabel.innerText = 'CANNON x' + weaponLevels.cannon;
      weaponLabel.style.opacity = 1;
      weaponLabel.style.color = '#44ffff';
      updateWeaponAmmoDisplay();
    } else {
      activeWeapon = w; specialWeapon = w; refillWeapon(w);
      setWeaponLabel(w);
    }
    buildItems(dialIdx);
  }

  buildItems(dialIdx);

  dial.onpointerdown = e => {
    e.stopPropagation();
    dial.setPointerCapture(e.pointerId);
    dialTouchStartY = e.clientY;
    dialTouchIdx = dialIdx;
    dialIsDragging = true;
  };
  dial.onpointermove = e => {
    if (!dialIsDragging) return;
    const delta = e.clientY - dialTouchStartY;
    const moveIdx = Math.round(delta / (itemH * 0.75));
    const newIdx = Math.max(0, Math.min(len - 1, dialTouchIdx - moveIdx));
    if (newIdx !== dialIdx) {
      dialIdx = newIdx;
      buildItems(dialIdx);
    }
  };
  dial.onpointerup = dial.onpointercancel = e => {
    if (!dialIsDragging) return;
    dialIsDragging = false;
    dial.releasePointerCapture(e.pointerId);
    const w = all[dialIdx];
    if (w === 'cannon') {
      if (activeWeapon !== null) {
        activeWeapon = null; specialWeapon = null;
        weaponAmmo = 0; weaponMaxAmmo = 0; weaponTimerMs = 0; weaponMaxTimerMs = 0;
        weaponLabel.innerText = 'CANNON x' + weaponLevels.cannon;
        weaponLabel.style.opacity = 1;
        weaponLabel.style.color = '#44ffff';
        updateWeaponAmmoDisplay();
      }
    } else if (w !== activeWeapon) {
      activeWeapon = w; specialWeapon = w; refillWeapon(w);
      setWeaponLabel(w);
    }
    buildItems(dialIdx);
  };
}

// --- Explosion FX (sprite-based for GPU batching) ---
function allocSprite() {
  const s = spritePool.length ? spritePool.pop() : new PIXI.Sprite(tex4);
  s.anchor.set(0.5); s.alpha = 1; s.scale.set(1); s.tint = 0xffffff;
  s.blendMode = PIXI.BLEND_MODES.ADD;
  if (!s.parent) fxC.addChild(s);
  return s;
}

function allocParticle() {
  const s = spritePool.length ? spritePool.pop() : new PIXI.Sprite(particleShapes[0]);
  s.anchor.set(0.5); s.alpha = 1; s.scale.set(1); s.tint = 0xffffff;
  s.blendMode = PIXI.BLEND_MODES.ADD;
  s.texture = particleShapes[Math.floor(Math.random() * particleShapes.length)];
  s.rotation = Math.random() * Math.PI * 2;
  s.rotSpd = (Math.random() - 0.5) * 15;
  if (!s.parent) fxC.addChild(s);
  return s;
}

function spawnExplosion(x, y, color, count) {
  const n = Math.min(count || 25, 40);
  if (fxP.length > 1200) return;
  
  // Weapon fire impacts are usually small (count <= 6).
  const isImpact = n <= 6;
  
  for (let i = 0; i < n; i++) {
    const s = allocParticle();
    s.x = x + (Math.random() - 0.5) * 10;
    s.y = y + (Math.random() - 0.5) * 10;
    const a = Math.random() * Math.PI * 2, spd = 1 + Math.random() * 8;
    s.vx = Math.cos(a) * spd; s.vy = Math.sin(a) * spd;
    
    if (isImpact) {
      s.tint = 0xaaaaaa; // Translucent grey for weapon impacts
      s.blendMode = PIXI.BLEND_MODES.NORMAL;
      s.life = 0.3 + Math.random() * 0.3;
      s.scale.set(0.1 + Math.random() * 0.2); // Smaller shards
      s.complexShape = false;
      // initial alpha gets managed by updateFX, but setting baseAlpha to use it
      s.baseAlpha = 0.5 + Math.random() * 0.3;
    } else {
      s.tint = color || rcol();
      s.life = 0.4 + Math.random() * 0.5;
      s.scale.set(0.2 + Math.random() * 0.5);
      s.complexShape = true;
      s.baseAlpha = 1;
    }
    s.maxLife = s.life;
    fxP.push(s);
  }
  
  // Only add glowing core layers for actual large explosions (deaths), not weapon impacts
  if (!isImpact) {
    for (let i = 0; i < 4; i++) {
      const s = allocParticle();
      s.tint = 0xaaaaaa; // Translucent grey
      s.blendMode = PIXI.BLEND_MODES.NORMAL; // Prevent additive stacking turning it into white bubbles
      s.x = x; s.y = y;
      s.vx = (Math.random() - 0.5) * 1; s.vy = (Math.random() - 0.5) * 1;
      s.life = 0.6 + Math.random() * 0.3;
      s.maxLife = s.life;
      s.scale.set(0.6 + i * 0.3);
      s.baseAlpha = 0.4 - i * 0.1; // More translucent
      s.complexShape = false;
      fxP.push(s);
    }
  }
}

// --- INPUT ---
function screenToGame(sx, sy) {
  if (gameC) {
    const z = gameC.scale.x || 1;
    const cx = gameC.x || 0;
    const cy = gameC.y || 0;
    return { x: (sx - cx) / z, y: (sy - cy) / z };
  }
  return { x: sx, y: sy };
}
function onDown(e) {
  const cx = e.clientX || (e.touches && e.touches[0] && e.touches[0].clientX) || 0;
  const cy = e.clientY || (e.touches && e.touches[0] && e.touches[0].clientY) || 0;
  if (gameState !== 'playing' && gameState !== 'paused') return;
  if (cy < height * 0.7) return;
  if (window.initAudio) window.initAudio();
  const g = screenToGame(cx, cy);
  aimFocusX = g.x;
  aimFocusY = g.y;
  touchOffsetY = cannon.y - g.y;
  firingPointerId = e.pointerId;
  isFiring = true;
  firingPointerId = e.pointerId;
  if (instEl) instEl.style.opacity = '0';
}
function onMove(e) {
  if (!isFiring || gameState !== 'playing') return;
  if (e.clientY < height * 0.7) return;
  const g = screenToGame(e.clientX, e.clientY);
  aimFocusX = g.x;
  aimFocusY = g.y;
}
function onUp(e) {
  if (e.pointerId === firingPointerId || firingPointerId < 0) {
    isFiring = false;
    firingPointerId = -1;
  }
}

window.addEventListener('pointerdown', onDown);
window.addEventListener('pointermove', onMove);
window.addEventListener('pointerup', onUp);
window.addEventListener('pointercancel', onUp);
document.addEventListener('touchmove', e => { if (gameState !== 'map') e.preventDefault(); }, { passive: false });
document.addEventListener('gesturestart', e => { if (gameState !== 'map') e.preventDefault(); });
document.addEventListener('gesturechange', e => { if (gameState !== 'map') e.preventDefault(); });
document.addEventListener('gestureend', e => { if (gameState !== 'map') e.preventDefault(); });
// --- UI ---
function updateUI() {
  scoreEl.innerText = Math.floor(score);
  scoreEl.classList.remove('pop'); void scoreEl.offsetWidth; scoreEl.classList.add('pop');
  const layerProgress = maxHealth > 0 ? (health / maxHealth) * 100 : 0;
  healthFill.style.width = Math.max(0, layerProgress) + '%';
  const layerColors = ['#00ffff', '#00ff88', '#ffdd00'];
  if (shieldLayers > 1) {
    healthFill.style.background = 'linear-gradient(90deg, #ff00ff, #00ffff)';
  } else {
    healthFill.style.background = 'linear-gradient(90deg,#0ff,#44ffaa)';
  }
  if (maxHealth > 0) {
    healthLabel.innerText = 'SHIELD ' + health.toFixed(1) + ' / ' + maxHealth;
  }
  const hullLabelEl = document.getElementById('hullLabel');
  if (hullLabelEl) {
      hullLabelEl.innerText = 'HULL: ' + Math.floor(hull) + ' / ' + maxHull;
  }
  const pplLabelEl = document.getElementById('peopleLabel');
  if (pplLabelEl) {
      pplLabelEl.innerText = 'PEOPLE: ' + Math.floor(people).toLocaleString();
  }
  const spShEl = document.getElementById('specialShieldLabel');
  if (spShEl) { spShEl.innerText = specialShieldLayers > 0 ? '✦ SPECIAL SHIELD x' + specialShieldLayers : ''; }
  const comboEl = document.getElementById('comboDisplay');
  if (comboEl) {
    if (combo > 1 && gameState === 'playing') {
      comboEl.innerText = 'x' + combo + ' COMBO';
      comboEl.style.opacity = '1';
      comboEl.style.transform = 'translateX(-50%) scale(' + Math.min(1 + combo * 0.05, 1.8) + ')';
    } else {
      comboEl.style.opacity = '0';
    }
  }
}

let hullDamageAccum = 0;

function takeDamage() {
  if (invincible > 0) return;
  if (shieldLayers > 1) {
    shieldLayers = Math.max(1, shieldLayers - 0.25);
  }
  if (health > 0) {
    health--;
    if (health <= 0 && shieldLayers > 1) {
      shieldLayers--;
      health = maxHealth;
    }
  }
  if (health <= 0) {
    hull -= 10;
    hullDamageAccum += 10;
    while (hullDamageAccum >= 10) {
      hullDamageAccum -= 10;
      people = Math.max(0, people - 15);
    }
    if (hull <= 0) {
      hull = 0;
      gameState = 'gameover';
      gameOverTime = performance.now();
      showGameOver();
      return;
    }
  }
  invincible = 1.2;
  try { if (typeof navigator.vibrate === 'function') navigator.vibrate(30); } catch(_) {}
  try { if (typeof navigator.vibrate === 'function') navigator.vibrate(health <= 0 ? [60,30,80] : 30); } catch(e) {}
  if (activeWeapon && weaponLevels[activeWeapon] > 0) {
    const prev = weaponLevels[activeWeapon];
    weaponLevels[activeWeapon]--;
    const ft = new PIXI.Text('-' + WEAPONS[activeWeapon].name + ' LVL', {
      fontFamily:'sans-serif',fontSize:14,fontWeight:'900',fill:0xff4400,
      dropShadow:true,dropShadowColor:0xff0000,dropShadowBlur:6
    });
    ft.anchor.set(0.5); ft.position.set(cannon.x + (Math.random() - 0.5) * 30, cannon.y + 20); ft.life=1.2; ft.vy=-0.6;
    fxC.addChild(ft); fxT.push(ft);
    if (weaponLevels[activeWeapon] <= 0) {
      const idx = ownedWeapons.indexOf(activeWeapon);
      if (idx >= 0) { ownedWeapons[idx] = ownedWeapons[ownedWeapons.length - 1]; ownedWeapons.pop(); }
      if (ownedWeapons.length > 0) {
        activeWeapon = ownedWeapons[Math.floor(Math.random() * ownedWeapons.length)];
        specialWeapon = activeWeapon;
        refillWeapon(activeWeapon);
        setWeaponLabel(activeWeapon);
      } else {
        activeWeapon = null; specialWeapon = null;
        weaponAmmo = 0; weaponMaxAmmo = 0; weaponTimerMs = 0; weaponMaxTimerMs = 0;
        weaponLabel.style.opacity = 0;
        updateWeaponAmmoDisplay();
      }
    }
    weaponLabel.innerText = WEAPONS[activeWeapon] ? WEAPONS[activeWeapon].name + ' +' + weaponLevels[activeWeapon] : '';
    updateWeaponDial();
  }
  updateUI();
  const isHullHit = health <= 0;
  damageFlashEl.style.background = isHullHit
    ? 'radial-gradient(ellipse at center, transparent 40%, rgba(255,0,0,0.7) 100%)'
    : 'radial-gradient(ellipse at center, transparent 40%, rgba(255,255,255,0.3) 100%)';
  damageFlashEl.style.opacity = '1';
  setTimeout(() => damageFlashEl.style.opacity = '0', isHullHit ? 150 : 80);
  cannonSprite.tint = isHullHit ? 0xff0000 : 0xff4444;
  setTimeout(() => cannonSprite.tint = 0x44ddff, isHullHit ? 200 : 120);
  const ft = new PIXI.Text(isHullHit ? '-10 HULL' : '-1', {
    fontFamily: 'sans-serif', fontSize: isHullHit ? 16 : 22, fontWeight: '900',
    fill: isHullHit ? 0xff0000 : 0xff4444, dropShadow: true, dropShadowColor: isHullHit ? 0x880000 : 0xff0000, dropShadowBlur: 8
  });
  ft.anchor.set(0.5); ft.position.set(cannon.x + (Math.random() - 0.5) * 20, cannon.y - 30); ft.life = 1.0; ft.vy = -1.5;
  fxC.addChild(ft); fxT.push(ft);
  for (let i = 0; i < 8; i++) {
    const p = new PIXI.Sprite(tex4);
    p.anchor.set(0.5);
    p.tint = isHullHit ? 0xff0000 : 0xff4444;
    p.x = cannon.x + (Math.random() - 0.5) * 10;
    p.y = cannon.y + (Math.random() - 0.5) * 10;
    const a = Math.random() * Math.PI * 2, sp = 1 + Math.random() * 4;
    p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp;
    p.life = 0.3 + Math.random() * 0.3;
    p.blendMode = PIXI.BLEND_MODES.ADD;
    p.scale.set(0.006 + Math.random() * 0.015);
    fxC.addChild(p); fxP.push(p);
  }
}

function showGameOver() {
  pauseBtn.style.display = 'none';
  pauseOverlay.classList.remove('show');
  var eo = document.getElementById('encounterOverlay');
  if (eo) eo.classList.remove('show');
  
  if (typeof beamGraphic !== 'undefined' && beamGraphic) beamGraphic.clear();
  if (typeof tethers !== 'undefined') tethers.forEach(t => { if (t && t.gfx) t.gfx.clear(); });
  if (typeof beams !== 'undefined') beams.forEach(b => { if (b && b.graphic) b.graphic.clear(); });
  // Hide lasers and enemy sprites so they don't freeze on screen
  lasers.forEach(l => { l.sprite.visible = false; });
  enemies.forEach(e => { e.sprite.visible = false; if (e.sparkle) e.sparkle.visible = false; if (e.glow) e.glow.visible = false; });
  if (boss) boss.sprite.visible = false;

  const finalScoreEl = document.getElementById('finalScore');
  const waveReachedEl = document.getElementById('waveReached');
  if (finalScoreEl) finalScoreEl.innerText = Math.floor(score);
  if (waveReachedEl) waveReachedEl.innerText = 'Wave ' + wave;
  deathScore = Math.floor(score);
  deathWave = wave;
  deathDiff = difficulty;
  deathTime = Math.floor((performance.now() - gameStartTime) / 1000);
  const m = Math.floor(deathTime / 60), s = deathTime % 60;
  
  const tsEl = document.getElementById('timeSurvived');
  if (tsEl) tsEl.innerText = 'Time: ' + m + 'm ' + s + 's';
  const iiEl = document.getElementById('initialsInput');
  if (iiEl) iiEl.value = '';
  
  const goCol = document.getElementById('gameOverColonists');
  const goHull = document.getElementById('gameOverHull');
  if (goCol) {
     const lost = Math.max(0, maxPeople - people);
     goCol.innerText = Math.floor(lost).toLocaleString();
  }
  if (goHull) {
     const pct = Math.max(0, Math.floor((hull / maxHull) * 100));
     goHull.innerText = pct + '%';
  }
  
  gameOverOverlay.classList.add('show');
  document.getElementById('weaponDial').style.display = 'none';
  
  const continueBtn2 = document.getElementById('gameOverContinueBtn');
  if (continueBtn2) {
    continueBtn2.style.display = people >= 1000 ? '' : 'none';
  }
}

function showVictory() {
  gameState = 'gameover';
  bgmTrack(3);
  pauseBtn.style.display = 'none';
  pauseOverlay.classList.remove('show');
  document.getElementById('weaponDial').style.display = 'none';

  if (typeof beamGraphic !== 'undefined' && beamGraphic) beamGraphic.clear();
  if (typeof tethers !== 'undefined') tethers.forEach(t => { if (t && t.gfx) t.gfx.clear(); });
  if (typeof beams !== 'undefined') beams.forEach(b => { if (b && b.graphic) b.graphic.clear(); });

  enemies.forEach(e => {
    if (e.sprite) { e.sprite.visible = false; enemyPool.push(e.sprite); enemyC.removeChild(e.sprite); }
  });
  enemies.length = 0;
  enemyBullets.forEach(b => { if (b.sprite) { b.sprite.visible = false; enemyBulletPool.push(b.sprite); enemyBulletC.removeChild(b.sprite); } });
  enemyBullets.length = 0;
  
  document.getElementById('victoryScore').innerText = Math.floor(score);
  const lost = Math.max(0, maxPeople - people);
  document.getElementById('victoryColonists').innerText = 'Colonists Lost: ' + Math.floor(lost).toLocaleString();
  const pct = Math.max(0, Math.floor((hull / maxHull) * 100));
  document.getElementById('victoryHull').innerText = 'Hull Integrity: ' + pct + '%';
  
  document.getElementById('victoryOverlay').classList.add('show');
}

document.getElementById('victoryRetryBtn')?.addEventListener('pointerdown', (e) => {
  e.stopPropagation();
  document.getElementById('victoryOverlay').classList.remove('show');
  startGame(difficulty);
});

document.getElementById('victoryMenuBtn')?.addEventListener('pointerdown', (e) => {
  e.stopPropagation();
  document.getElementById('victoryOverlay').classList.remove('show');
  showDifficulty();
});

function setDifficulty(d) {
  difficulty = d;
  const cfg = DIFF[d];
  MAX_ENEMIES = cfg.maxEnemies;
  maxHealth = cfg.health;
  diffOverlay.classList.remove('show');
  diffOverlay.style.display = 'none';
  const dl = document.getElementById('diffLabel');
  if (dl) dl.innerText = d.toUpperCase();
  
  // Start Audio if available
  if (window.initAudio) {
      try { window.initAudio(); } catch(e) { console.error('Audio init error', e); }
  }

  startGame();
}

// Pause / Resume
const pauseBtn = document.getElementById('pauseBtn');
const pauseOverlay = document.getElementById('pauseOverlay');
const resumeBtn = document.getElementById('resumeBtn');
const mainMenuBtn = document.getElementById('mainMenuBtn');
function togglePause() {
  if (gameState === 'playing') {
    gameState = 'paused';
    pauseOverlay.classList.add('show');
    pauseBtn.innerText = '▶';
  } else if (gameState === 'paused') {
    gameState = 'playing';
    pauseOverlay.classList.remove('show');
    pauseBtn.innerText = '⏸';
  }
}
function returnToMainMenu() {
  cleanAll();
  gameState = 'menu';
  if (window.bgmEngine) window.bgmEngine.stop();
  zoom = 1; zoomScale = 1;
  if (gameC) { gameC.scale.set(1); gameC.x = 0; gameC.y = 0; }
  document.getElementById('zoomLabel').innerText = '1x';
  cannonSprite.visible = false;
  cannonSprite.scale.set(1);
  cannonGlow.visible = false;
  cannonGlow.scale.set(6);
  cannonBase.visible = false;
  cannonBase.scale.set(1);
  if (typeof shipHull !== 'undefined') shipHull.visible = false;
  pauseOverlay.classList.remove('show');
  gameOverOverlay.classList.remove('show');
  document.getElementById('weaponDial').style.display = 'none';
  pauseBtn.style.display = 'none';
  diffOverlay.style.display = '';
  document.querySelectorAll('.btn-diff').forEach(b => b.classList.remove('selected'));
  diffOverlay.classList.add('show');
}
pauseBtn.addEventListener('pointerdown', e => { e.preventDefault(); togglePause(); });
pauseOverlay.addEventListener('pointerdown', e => { if (e.target === pauseOverlay) togglePause(); });
resumeBtn.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); togglePause(); });
mainMenuBtn.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); try { returnToMainMenu(); } catch(e) { console.error(e); const errText = new PIXI.Text(e.stack, {fill:0xff0000, fontSize:12, wordWrap:true, wordWrapWidth:800}); errText.y = 100; app.stage.addChild(errText); location.reload(); } });
document.getElementById('dialToggleBtn').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); dialSide = dialSide === 'L' ? 'R' : 'L'; document.getElementById('dialSideLabel').innerText = dialSide; updateWeaponDial(); });
document.getElementById('zoomToggleBtn').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); setZoom(zoom === 1 ? 0.5 : 1); document.getElementById('zoomLabel').innerText = zoom === 1 ? '1x' : '2x'; updateWeaponDial(); });

// Auto-pause & save when app is hidden
document.addEventListener('visibilitychange', () => {
  if (document.hidden && (gameState === 'playing' || gameState === 'map')) { saveGameState(); if (gameState === 'playing') togglePause(); }
});

let _saveTimer = 0, _gemTimer = 0;
function saveGameState() {
  if (gameState !== 'playing' && gameState !== 'map') return;
  try {
    const s = { score, health, maxHealth, wave, difficulty, cannonX: cannon.x, cannonY: cannon.y,
      specialWeapon, cannonWeapon, weaponLevels, ownedWeapons, activeWeapon,
      weaponAmmo, weaponMaxAmmo, weaponTimerMs, weaponMaxTimerMs,
      zoom, shieldLayers, maxShieldLayers, combo, lastKillTime,
      bossEncounter, bossInterval, gameStartTime, waveTimer,
      mapMode, mapCurrentIdx, mapPath, specialShieldLayers,
      people, hull, maxHull, maxPeople, usedContinueThisNode };
    if (mapMode && mapNodes) s.mapNodes = mapNodes;
    localStorage.setItem('cosmicBlastSave', JSON.stringify(s));
  } catch(e) { console.error('saveGameState', e); }
}

function loadGameState() {
  try {
    const raw = localStorage.getItem('cosmicBlastSave');
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (s.score === undefined || s.wave === undefined) { localStorage.removeItem('cosmicBlastSave'); return null; }
    return s;
  } catch(e) { console.error('loadGameState', e); return null; }
}

function clearGameState() {
  localStorage.removeItem('cosmicBlastSave');
}

function showContinueOption() {
  const s = loadGameState();
  const cc = document.getElementById('continueContainer');
  if (!cc) return;
  if (s && s.difficulty != null) {
    cc.style.display = 'block';
    const ci = document.getElementById('continueInfo');
    const diffName = ['EASY','NORMAL','HARD','HARDCORE'][s.difficulty||1];
    if (ci) {
      if (s.mapMode && s.mapNodes && s.mapNodes.length) {
        const cur = s.mapNodes[s.mapCurrentIdx || 0];
        const progress = Math.round(((s.mapCurrentIdx || 0) / (s.mapNodes.length - 1)) * 100);
        ci.textContent = 'Map ' + progress + '% · Score ' + s.score + ' · ' + diffName;
      } else {
        ci.textContent = 'Wave ' + s.wave + ' · Score ' + s.score + ' · ' + diffName;
      }
    }
    document.getElementById('continueBtn').onclick = e => { e.preventDefault(); e.stopPropagation(); resumeGame(s); };
  } else {
    cc.style.display = 'none';
  }
}

function resumeGame(s) {
  score = s.score; health = s.health; maxHealth = s.maxHealth; wave = s.wave; difficulty = s.difficulty;
  shieldLayers = s.shieldLayers; maxShieldLayers = s.maxShieldLayers || 3; specialShieldLayers = s.specialShieldLayers || 0;
  people = s.people !== undefined ? s.people : 300000;
  hull = s.hull !== undefined ? s.hull : (s.maxHull || 500);
  maxHull = s.maxHull || 500;
  maxPeople = s.maxPeople || 300000;
  usedContinueThisNode = s.usedContinueThisNode || false;
  combo = s.combo || 1; lastKillTime = s.lastKillTime || 0;
  frameCount = 0; spawnTimer = -3; invincible = 2; swarmTimer = 8 + Math.random() * 4; hardcoreBlockTimer = 0;
  waveAnnounce = 0; waveTimer = s.waveTimer || 0; gameStartTime = s.gameStartTime || performance.now();
  bossEncounter = s.bossEncounter || 0; bossInterval = s.bossInterval || 5;
  liquidationCount = 0;
  cannon.x = s.cannonX != null ? s.cannonX : CANNON_X;
  cannon.y = s.cannonY != null ? s.cannonY : CANNON_BASE_Y;
  zoom = s.zoom || 1; zoomScale = zoom;
  specialWeapon = s.specialWeapon || null; cannonWeapon = s.cannonWeapon || null;
  weaponLevels = s.weaponLevels || { cannon:1, spread:0, rapid:0, pierce:0, blast:0, beam:0, bolt:0,
    homing:0, saber:0, gravity:0, nova:0, swarm:0, storm:0, shard:0, prism:0, flare:0, vortex:0,
    echo:0, tether:0, rift:0, pulse:0, mine:0, void:0, time:0, zenith:0, singularity:0, phantom:0,
    glacier:0, nebula:0, laser:0, ion:0, siphon:0, pulsecannon:0, vortexcannon:0 };
  ownedWeapons = s.ownedWeapons || []; activeWeapon = s.activeWeapon || null;
  weaponAmmo = s.weaponAmmo || 0; weaponMaxAmmo = s.weaponMaxAmmo || 0;
  weaponTimerMs = s.weaponTimerMs || 0; weaponMaxTimerMs = s.weaponMaxTimerMs || 0;
  const wd = document.getElementById('weaponDial'); if (wd) wd.sliding = false;
  weaponLabel.style.opacity = 0; updateWeaponDial();
  gameOverOverlay.classList.remove('show'); diffOverlay.classList.remove('show');
  diffOverlay.style.display = 'none'; pauseOverlay.classList.remove('show');

  mapMode = s.mapMode || false;
  if (mapMode && s.mapNodes && s.mapNodes.length) {
    mapNodes = s.mapNodes;
    mapCurrentIdx = s.mapCurrentIdx || 0;
    mapPath = s.mapPath || [0];
  } else {
    // Legacy save without map data — generate a fresh map
    generateMap();
  }

  // Rebuild PIXI containers and show the map
  cleanAll();
  [starC,mistC,fgStarC,debrisC,stationC,gameC].forEach(c => { if (c) { app.stage.removeChild(c); c.destroy({children:true}); } });
  enemyPool.length=0; laserPool.length=0; puPool.length=0;
  enemyBulletPool.length=0; spritePool.length=0;
  createContainers();
  createGameSprites();
  cannonSprite.visible = false; cannonGlow.visible = false; cannonBase.visible = false;
  shieldGraphic.visible = false; peopleText.visible = false;
  if (shipHull) shipHull.visible = false;
  pauseBtn.style.display = 'none';
  setZoom(zoom);
  initStars(); initAtmosphere();
  showMapView();
  bgmTrack(0);
  // Update HUD labels so saved state is reflected when gameplay resumes
  scoreEl.innerText = '' + score;
  healthFill.style.width = (health / maxHealth * 100) + '%';
  updateUI();
}

function cleanAll() {
  if (boss) {
    boss.sprite.visible = false; enemyPool.push(boss.sprite); enemyC.removeChild(boss.sprite);
    if (boss.sparkle) { glowC.removeChild(boss.sparkle); boss.sparkle.destroy(); }
    if (boss.glow) { glowC.removeChild(boss.glow); boss.glow.destroy(); }
    if (boss.chromaR) { glowC.removeChild(boss.chromaR); boss.chromaR.destroy(); }
    if (boss.chromaB) { glowC.removeChild(boss.chromaB); boss.chromaB.destroy(); }
    boss = null;
    bossBarOuter.style.display = 'none';
    bossLabel.style.display = 'none';
  }
  enemies.forEach(e => {
    if (e.sparkle) { glowC.removeChild(e.sparkle); e.sparkle.destroy(); }
    if (e.glow) { glowC.removeChild(e.glow); e.glow.destroy(); }
    if (e.aura) { glowC.removeChild(e.aura); e.aura.destroy(); }
    if (e.shimmer) { glowC.removeChild(e.shimmer); e.shimmer.destroy(); }
    if (e.chromaR) { glowC.removeChild(e.chromaR); e.chromaR.destroy(); }
    if (e.chromaB) { glowC.removeChild(e.chromaB); e.chromaB.destroy(); }
    if (e.spriteAccent) { e.spriteAccent.visible = false; enemyPool.push(e.spriteAccent); enemyC.removeChild(e.spriteAccent); }
    if (e.spriteCore) { e.spriteCore.visible = false; enemyPool.push(e.spriteCore); enemyC.removeChild(e.spriteCore); }
    if (e.spriteRing) { e.spriteRing.visible = false; enemyPool.push(e.spriteRing); enemyC.removeChild(e.spriteRing); }
    e.sprite.visible = false; enemyPool.push(e.sprite); enemyC.removeChild(e.sprite);
  });
  enemies.length = 0;
  lasers.forEach(l => {
    if (l.gravGfx) { fxC.removeChild(l.gravGfx); l.gravGfx.destroy(); }
    if (l.orbitals) { l.orbitals.forEach(o => { fxC.removeChild(o.sprite); spritePool.push(o.sprite); }); l.orbitals = null; }
    if (l.ufoAccent) { fxC.removeChild(l.ufoAccent); l.ufoAccent.destroy(); }
    if (l.ufoCore) { fxC.removeChild(l.ufoCore); l.ufoCore.destroy(); }
    if (l.ufoRing) { fxC.removeChild(l.ufoRing); l.ufoRing.destroy(); }
    if (l.ufoGlow) { glowC.removeChild(l.ufoGlow); l.ufoGlow.destroy(); }
    if (l._oblivionGfx) { fxC.removeChild(l._oblivionGfx); l._oblivionGfx.destroy(); }
    if (l.sprite.parent) laserC.removeChild(l.sprite);
    laserPool.push(l.sprite);
  });
  lasers.length = 0;
  powerups.forEach(pu => { puCleanupGlow(pu); pu.sprite.visible = false; puPool.push(pu.sprite); puC.removeChild(pu.sprite); });
  powerups.length = 0;
  enemyBullets.forEach(b => { if (b.glow) { glowC.removeChild(b.glow); b.glow.destroy(); } enemyBulletPool.push(b.sprite); enemyBulletC.removeChild(b.sprite); });
  enemyBullets.length = 0;
  while (eBulletGlowPool.length) { const s = eBulletGlowPool.pop(); glowC.removeChild(s); s.destroy(); }
  while (glowC.children.length) { const c = glowC.children[0]; glowC.removeChild(c); if (c.destroy) c.destroy(); }
  beams.forEach(b => { fxC.removeChild(b.graphic); b.graphic.destroy(); });
  beams.length = 0;
  arcProjectiles.forEach(p => { fxC.removeChild(p.sprite); arcPool.push(p.sprite); });
  arcProjectiles.length = 0;
  for (const m of bossMinis) {
    if (m.sparkle) { glowC.removeChild(m.sparkle); m.sparkle.destroy(); }
    if (m.glow) { glowC.removeChild(m.glow); m.glow.destroy(); }
    if (m.accent) { m.accent.visible = false; enemyPool.push(m.accent); enemyC.removeChild(m.accent); }
    m.sprite.visible = false; enemyPool.push(m.sprite); enemyC.removeChild(m.sprite);
    if (m.spriteAccent) { m.spriteAccent.visible = false; enemyPool.push(m.spriteAccent); enemyC.removeChild(m.spriteAccent); }
  }
  bossMinis.length = 0;
  for (const sm of bossSwarm) { if (sm.sprite) { sm.sprite.visible = false; enemyPool.push(sm.sprite); enemyC.removeChild(sm.sprite); } if (sm.glow) { glowC.removeChild(sm.glow); sm.glow.destroy(); } }
  bossSwarm.length = 0;
  for (const mb of miniBosses) {
    mb.sprite.visible = false; enemyPool.push(mb.sprite); enemyC.removeChild(mb.sprite);
    if (mb.sparkle) { glowC.removeChild(mb.sparkle); mb.sparkle.destroy(); }
    if (mb.glow) { glowC.removeChild(mb.glow); mb.glow.destroy(); }
    if (mb.chromaR) { glowC.removeChild(mb.chromaR); mb.chromaR.destroy(); }
    if (mb.chromaB) { glowC.removeChild(mb.chromaB); mb.chromaB.destroy(); }
  }
  miniBosses.length = 0;
  if (bossTendril) { fxC.removeChild(bossTendril); bossTendril.destroy(); bossTendril = null; }
  if (beamGraphic) { fxC.removeChild(beamGraphic); beamGraphic.destroy(); beamGraphic = null; }
  gems.forEach(g => { 
    if (g && g.sprite && !g.sprite.destroyed) { laserC.removeChild(g.sprite); g.sprite.destroy(); }
    if (g && g.glow && !g.glow.destroyed) { glowC.removeChild(g.glow); g.glow.destroy(); }
  });
  gems.length = 0;
  fxP.forEach(p => { fxC.removeChild(p); p.texture = tex4; spritePool.push(p); });
  fxT.forEach(t => { 
      if (t && t.destroy && typeof t.destroy === 'function' && t instanceof PIXI.DisplayObject && !t.destroyed) {
          fxC.removeChild(t); 
          t.destroy(); 
      }
  });
  fxP.length = 0; fxT.length = 0;
  zones.forEach(z => { if (z && z.gfx && !z.gfx.destroyed) { fxC.removeChild(z.gfx); z.gfx.destroy(); } });
  zones.length = 0;
  satellites.forEach(s => { if (s && s.gfx && !s.gfx.destroyed) { fxC.removeChild(s.gfx); s.gfx.destroy(); } });
  satellites.length = 0;
  tethers.forEach(t => { if (t && t.gfx && !t.gfx.destroyed) { fxC.removeChild(t.gfx); t.gfx.destroy(); } });
  tethers.length = 0;
  mines.forEach(m => { if (m && m.gfx && !m.gfx.destroyed) { fxC.removeChild(m.gfx); m.gfx.destroy(); } });
  mines.length = 0;
  beamLasers.length = 0;
  killQueue.length = 0;
  while (fxC.children.length) { const c = fxC.children[0]; fxC.removeChild(c); if (c.destroy) c.destroy(); }
}

function startGame() {
  try { if (typeof initAdvancedAudio === "function") { initAdvancedAudio(); if (window.bgmEngine) window.bgmEngine.switchTrack(0); } } catch(e) {}
  // Generate map and show it
  mapMode = true;
  // Initialize core state
  score = 0; wave = 1; frameCount = 0; spawnTimer = 0; combo = 1; invincible = 0;
  specialShieldLayers = 0; usedContinueThisNode = false; health = maxHealth; shieldLayers = 1; hull = maxHull; hullDamageAccum = 0; people = maxPeople;
  liquidationCount = 0;
  gameStartTime = performance.now(); bossEncounter = 0; bossInterval = 5;
  weaponLevels = { cannon:1, spread:0, rapid:0, pierce:0, blast:0, beam:0, bolt:0, homing:0, saber:0,
    gravity:0, nova:0, swarm:0, storm:0, shard:0, prism:0, flare:0, vortex:0, echo:0, tether:0,
    rift:0, pulse:0, mine:0, void:0, time:0, zenith:0, singularity:0, phantom:0, glacier:0, nebula:0,
    laser:0, ion:0, siphon:0, pulsecannon:0, vortexcannon:0 };
  ownedWeapons = []; activeWeapon = null; specialWeapon = null;
  weaponAmmo = 0; weaponMaxAmmo = 0; weaponTimerMs = 0; weaponMaxTimerMs = 0;
  const wd = document.getElementById('weaponDial'); if (wd) wd.sliding = false;
  weaponLabel.style.opacity = 0;
  updateWeaponDial();
  clearGameState();
  gameOverOverlay.classList.remove('show');
  diffOverlay.classList.remove('show');
  diffOverlay.style.display = 'none';
  pauseOverlay.classList.remove('show');
  document.getElementById('victoryOverlay')?.classList.remove('show');
  cleanAll();
  // Rebuild containers (destroy old ones)
  [starC,mistC,fgStarC,debrisC,stationC,gameC].forEach(c => { if (c) { app.stage.removeChild(c); c.destroy({children:true}); } });
  enemyPool.length=0; laserPool.length=0; puPool.length=0;
  enemyBulletPool.length=0; spritePool.length=0;
  createContainers();
  createGameSprites();
  cannonSprite.visible = false; cannonGlow.visible = false; cannonBase.visible = false;
  shieldGraphic.visible = false; peopleText.visible = false;
  if (shipHull) shipHull.visible = false;
  pauseBtn.style.display = 'none';
  setZoom(zoom);
  initStars(); initAtmosphere();
  generateMap();
  showMapView();
}

function showDifficulty() {
  cleanAll();
  gameState = 'menu';
  cannonSprite.visible = false;
  cannonGlow.visible = false;
  cannonBase.visible = false;
  shieldGraphic.visible = false;
  peopleText.visible = false;
  if (typeof shipHull !== 'undefined') shipHull.visible = false;
  pauseBtn.style.display = 'none';
  pauseOverlay.classList.remove('show');
  gameOverOverlay.classList.remove('show');
  diffOverlay.style.display = '';
  diffOverlay.classList.add('show');
  showContinueOption();
  if (window.bgmEngine) window.bgmEngine.stop();
}

function continueGame() {
  if (gameState !== 'gameover') return;
  
  gameState = 'playing';
  if (app && app.ticker) app.ticker.start();
  usedContinueThisNode = true;
  
  people = Math.max(0, people - 1000);
  
  // Re-show enemies that were hidden by showGameOver
  enemies.forEach(e => {
    e.sprite.visible = true;
    if (e.sparkle) e.sparkle.visible = true;
    if (e.glow) e.glow.visible = true;
  });
  if (boss && boss.sprite) boss.sprite.visible = true;
  lasers.forEach(l => { l.sprite.visible = true; });
  
  cannonSprite.x = CANNON_X;
  cannonSprite.y = CANNON_BASE_Y;
  if (typeof cannonGlow !== 'undefined') { cannonGlow.x = CANNON_X; cannonGlow.y = CANNON_BASE_Y; }
  if (typeof cannonBase !== 'undefined') { cannonBase.x = CANNON_X; cannonBase.y = CANNON_BASE_Y; }
  shieldGraphic.x = CANNON_X; shieldGraphic.y = CANNON_BASE_Y; shieldGraphic.clear();
  peopleText.x = CANNON_X; peopleText.y = CANNON_BASE_Y + 24;
  if (typeof shipHull !== 'undefined') { shipHull.visible = true; shipHull.position.set(CANNON_X, CANNON_BASE_Y); rebuildShipHull(); }
  
  health = maxHealth;
  shieldLayers = maxShieldLayers;
  hull = maxHull;
  hullDamageAccum = 0;
  
  gameOverOverlay.classList.remove('show');
}
function safeShowMapView(label) {
  try {
    showMapView();
    console.log(label + ': showMapView OK');
  } catch(e) {
    console.error(label + ' error:', e.message, e.stack);
    // Fallback: draw something visible so we know the stage works
    try {
      const fb = new PIXI.Graphics();
      fb.beginFill(0xff0000); fb.drawRect(0, 0, 100, 100); fb.endFill();
      app.stage.addChild(fb);
      const ft = new PIXI.Text(label + ' ERROR', {fill:0xff0000, fontSize:24});
      ft.y = 120;
      app.stage.addChild(ft);
    } catch(ee) {}
  }
}
function returnToMapFromGameOver() {
  if (gameState !== 'gameover') return;
  gameState = 'map';
  document.getElementById('gameOverOverlay').classList.remove('show');
  var eo = document.getElementById('encounterOverlay');
  if (eo) eo.classList.remove('show');
  if (app && app.ticker) app.ticker.start();
  console.log('mapNodes length:', mapNodes ? mapNodes.length : 'null');
  safeShowMapView('returnToMap');
  bgmTrack(0);
}
function abandonToMapFromGameOver() {
  if (gameState !== 'gameover') return;
  if (people < 2000) return;
  people -= 2000;
  const node = mapNodes[mapCurrentIdx];
  if (node) { node.completed = true; node.visited = true; }
  gameState = 'map';
  document.getElementById('gameOverOverlay').classList.remove('show');
  var eo = document.getElementById('encounterOverlay');
  if (eo) eo.classList.remove('show');
  if (app && app.ticker) app.ticker.start();
  console.log('mapNodes length:', mapNodes ? mapNodes.length : 'null');
  safeShowMapView('abandonToMap');
  bgmTrack(0);
}
function onGameOverTap(e) { if (gameState !== 'gameover') return; e.preventDefault(); e.stopPropagation(); continueGame(); }

const BIO_PALETTES = {
  commercial: { hues:[40,50,180,200], sat:[60,80], light:[35,55], accent:0xffd700, station:0x44ddff, name:'urban' },
  abandoned:  { hues:[0,10,20,30],    sat:[20,40], light:[15,35], accent:0xaa6644, station:0x775533, name:'wasteland' },
  military:   { hues:[210,220,140,120],sat:[60,80], light:[25,45], accent:0x44cc66, station:0x4488cc, name:'fortress' },
  strange:    { hues:[280,300,180,320],sat:[70,90], light:[35,55], accent:0x44ffcc, station:0xaa44ff, name:'alien' },
  hostile:    { hues:[0,350,340,20],   sat:[70,90], light:[25,45], accent:0xff6600, station:0xcc2244, name:'inferno' },
};
const FALLBACK_PALETTE = { hues:[280,220,30,0,320,180], sat:[60,80], light:[30,50], accent:0x8888ff, station:0x6666cc, name:'void' };

function getPalette(tags) {
  if (!tags || !tags.length) return FALLBACK_PALETTE;
  for (const t of tags) {
    if (BIO_PALETTES[t]) return BIO_PALETTES[t];
  }
  return FALLBACK_PALETTE;
}

function drawPlanet(cx, pal, w, h) {
  // Base sphere with radial gradient
  const gr = cx.createRadialGradient(w*0.3,h*0.3,w*0.04,w*0.5,w*0.5,w*0.5);
  const baseH = pal.hues[Math.floor(Math.random()*pal.hues.length)];
  gr.addColorStop(0, `hsl(${baseH+10},${pal.sat[0]+10}%,${pal.light[0]+15}%)`);
  gr.addColorStop(0.3, `hsl(${baseH},${pal.sat[0]}%,${pal.light[0]}%)`);
  gr.addColorStop(0.6, `hsl(${baseH-10},${pal.sat[0]-10}%,${pal.light[0]-10}%)`);
  gr.addColorStop(1, `hsl(${baseH-20},${pal.sat[1]-10}%,${pal.light[1]-15}%)`);
  cx.fillStyle = gr; cx.fillRect(0,0,w,h);

  // Biome surface pattern
  const biome = Math.floor(Math.random() * 5);
  const spots = 15 + Math.floor(Math.random() * 25);

  if (biome === 0) {
    // Terrestrial: large continent blobs
    for (let i=0;i<spots;i++) {
      cx.beginPath();
      const bx = w*0.1+Math.random()*w*0.8, by = h*0.1+Math.random()*h*0.8;
      const r = 8+Math.random()*50;
      cx.arc(bx,by,r,0,Math.PI*2);
      cx.fillStyle = `hsla(${baseH+30+Math.random()*40},${pal.sat[0]+10}%,${pal.light[0]+10+Math.random()*15}%,0.25+Math.random()*0.25)`;
      cx.fill();
    }
    // Ocean trenches (darker patches)
    for (let i=0;i<8;i++) {
      cx.beginPath();
      cx.arc(w*0.1+Math.random()*w*0.8, h*0.1+Math.random()*h*0.8, 15+Math.random()*35, 0, Math.PI*2);
      cx.fillStyle = `hsla(${baseH+50},${pal.sat[0]}%,${pal.light[0]-20}%,0.15)`;
      cx.fill();
    }
  } else if (biome === 1) {
    // Gas giant: horizontal bands
    const bandCount = 4+Math.floor(Math.random()*5);
    for (let i=0;i<bandCount;i++) {
      const by = h*0.05 + (h*0.9/bandCount)*i + Math.random()*h*0.05;
      const bh = 8+Math.random()*25;
      const hueShift = Math.random()*40-20;
      const satShift = Math.random()*20-10;
      const lightShift = Math.random()*20-10;
      cx.fillStyle = `hsla(${baseH+hueShift},${pal.sat[0]+satShift}%,${pal.light[0]+lightShift}%,0.2+Math.random()*0.3)`;
      cx.fillRect(w*0.05, by, w*0.9, bh);
    }
    // Storm spot
    cx.beginPath();
    cx.arc(w*0.4+Math.random()*w*0.3, h*0.3+Math.random()*h*0.3, 12+Math.random()*20, 0, Math.PI*2);
    cx.fillStyle = `hsla(${baseH+20},${pal.sat[0]+10}%,${pal.light[0]+10}%,0.35)`;
    cx.fill();
  } else if (biome === 2) {
    // Lava: cracked surface with glowing veins
    for (let i=0;i<spots;i++) {
      const bx = w*0.05+Math.random()*w*0.9, by = h*0.05+Math.random()*h*0.9;
      cx.beginPath(); cx.arc(bx,by,4+Math.random()*15,0,Math.PI*2);
      cx.fillStyle = `hsla(${baseH-10+Math.random()*20},${pal.sat[0]+10}%,${pal.light[0]-10+Math.random()*15}%,0.2+Math.random()*0.3)`;
      cx.fill();
    }
    // Glowing fissures
    for (let i=0;i<12;i++) {
      cx.beginPath(); cx.arc(w*0.1+Math.random()*w*0.8, h*0.1+Math.random()*h*0.8, 2+Math.random()*6, 0, Math.PI*2);
      cx.fillStyle = `hsla(${baseH+40},100%,${55+Math.random()*30}%,0.2+Math.random()*0.4)`;
      cx.fill();
    }
  } else if (biome === 3) {
    // Ice: bright surface with crack lines
    for (let i=0;i<spots;i++) {
      const bx = w*0.05+Math.random()*w*0.9, by = h*0.05+Math.random()*h*0.9;
      cx.beginPath(); cx.arc(bx,by,6+Math.random()*25,0,Math.PI*2);
      cx.fillStyle = `hsla(${baseH+Math.random()*20},${pal.sat[0]-10}%,${pal.light[0]+10+Math.random()*15}%,0.15+Math.random()*0.2)`;
      cx.fill();
    }
    // Cracks
    for (let i=0;i<8;i++) {
      cx.strokeStyle = `hsla(${baseH+20},20%,${pal.light[0]+30}%,0.15+Math.random()*0.2)`;
      cx.lineWidth = 1+Math.random()*2;
      cx.beginPath(); cx.moveTo(w*0.1+Math.random()*w*0.8, h*0.1+Math.random()*h*0.8);
      for (let j=0;j<5;j++) cx.lineTo(w*0.1+Math.random()*w*0.8, h*0.1+Math.random()*h*0.8);
      cx.stroke();
    }
  } else {
    // Crystal: angular faceted shapes
    for (let i=0;i<spots;i++) {
      const bx = w*0.1+Math.random()*w*0.8, by = h*0.1+Math.random()*h*0.8;
      cx.beginPath();
      const sides = 3+Math.floor(Math.random()*4);
      for (let j=0;j<sides;j++) {
        const a = j/sides*Math.PI*2 - Math.PI/2;
        const r = 4+Math.random()*18;
        cx[j===0?'moveTo':'lineTo'](bx+Math.cos(a)*r, by+Math.sin(a)*r);
      }
      cx.closePath();
      cx.fillStyle = `hsla(${baseH+Math.random()*60-30},${pal.sat[0]}%,${pal.light[0]+Math.random()*20}%,0.2+Math.random()*0.25)`;
      cx.fill();
    }
  }

  // Atmosphere glow rim
  const rim = cx.createRadialGradient(w*0.5,w*0.5,w*0.46,w*0.5,w*0.5,w*0.5);
  rim.addColorStop(0, 'hsla(0,0%,100%,0)');
  rim.addColorStop(0.85, `hsla(${baseH+40},${pal.sat[0]}%,60%,0)`);
  rim.addColorStop(0.93, `hsla(${baseH+40},${pal.sat[0]}%,70%,0.15)`);
  rim.addColorStop(1, `hsla(${baseH+40},${pal.sat[0]}%,80%,0)`);
  cx.fillStyle = rim; cx.fillRect(0,0,w,h);
}

function createPlanetSprite(tags) {
  const pal = getPalette(tags);
  const c = document.createElement('canvas');
  const size = 512;
  c.width = size; c.height = size;
  const cx = c.getContext('2d');
  drawPlanet(cx, pal, size, size);
  const tx = PIXI.Texture.from(c, {scaleMode:PIXI.SCALE_MODES.LINEAR});
  const s = new PIXI.Sprite(tx);
  s.anchor.set(0.5); s.scale.set(0.8 + Math.random()*0.6);
  s.alpha = 0.3 + Math.random()*0.2;
  s.blendMode = PIXI.BLEND_MODES.ADD;
  return s;
}

function showEncounter() {
    if (gameState === 'gameover') return;

    enemies.forEach(e => { if(e.sprite){e.sprite.visible=false;enemyPool.push(e.sprite);enemyC.removeChild(e.sprite);} });
    enemies.length = 0;
    enemyBullets.forEach(b => { if(b.sprite){b.sprite.visible=false;enemyBulletPool.push(b.sprite);enemyBulletC.removeChild(b.sprite);} });
    enemyBullets.length = 0;
    boss = null; swarmTimer = 8 + Math.random()*4;
    beamLasers.length = 0; mines.length = 0; zones.length = 0; satellites.length = 0; tethers.length = 0;
    bossMinis.length = 0; bossSwarm.length = 0; miniBosses.length = 0;

    gameState = 'encounter';
    inEncounter = true;
    if (gameC) gameC.visible = false;

    // Pick lore location first to get theme tags
    let encName = "UNKNOWN SECTOR";
    let loreText = "A silent expanse of space greets you.";
    let themes = [];
    if (window.LORE_DATA) {
        const locObj = window.LORE_DATA.locations[Math.floor(Math.random() * window.LORE_DATA.locations.length)];
        encName = locObj.name;
        themes = locObj.tags;
        const pickContextual = (array) => {
            const valid = array.filter(item => item.tags.some(t => themes.includes(t)));
            const pool = valid.length > 0 ? valid : array;
            return pool[Math.floor(Math.random() * pool.length)].text;
        };
        const atmo = pickContextual(window.LORE_DATA.atmospheres);
        const inhab = pickContextual(window.LORE_DATA.inhabitants);
        const act = pickContextual(window.LORE_DATA.actions);
        loreText = `You approach ${encName}. ${atmo} ${inhab} ${act}`;
    }

    // Theme-driven visuals
    const pal = getPalette(themes);

    // Proc gen background: full-screen nebula canvas
    if (window.encounterBg) { stationC.removeChild(window.encounterBg); window.encounterBg.destroy(true); window.encounterBg = null; }
    const bgCanvas = document.createElement('canvas');
    bgCanvas.width = width; bgCanvas.height = height;
    const bgCtx = bgCanvas.getContext('2d');
    // Base gradient
    const baseH = pal.hues[Math.floor(Math.random()*pal.hues.length)];
    const bgGrad = bgCtx.createRadialGradient(width*0.2, height*0.3, 0, width*0.5, height*0.5, Math.max(width,height)*0.8);
    bgGrad.addColorStop(0, `hsla(${baseH},${pal.sat[0]}%,${pal.light[0]*0.3}%,1)`);
    bgGrad.addColorStop(0.4, `hsla(${baseH+30},${pal.sat[0]}%,${pal.light[0]*0.2}%,1)`);
    bgGrad.addColorStop(0.7, `hsla(${baseH+60},${pal.sat[0]}%,${pal.light[0]*0.1}%,1)`);
    bgGrad.addColorStop(1, `hsla(${baseH+90},${pal.sat[0]}%,${pal.light[0]*0.05}%,1)`);
    bgCtx.fillStyle = bgGrad; bgCtx.fillRect(0, 0, width, height);
    // Nebula blotches
    for (let i = 0; i < 12; i++) {
      const nx = Math.random()*width, ny = Math.random()*height;
      const nR = 30 + Math.random()*120;
      const ng = bgCtx.createRadialGradient(nx, ny, 0, nx, ny, nR);
      ng.addColorStop(0, `hsla(${baseH+Math.random()*60-30},${pal.sat[0]+10}%,${pal.light[0]+20}%,${0.04+Math.random()*0.06})`);
      ng.addColorStop(1, `hsla(${baseH+Math.random()*60-30},${pal.sat[0]}%,${pal.light[0]}%,0)`);
      bgCtx.fillStyle = ng; bgCtx.fillRect(nx-nR, ny-nR, nR*2, nR*2);
    }
    // Distant stars
    for (let i = 0; i < 200; i++) {
      bgCtx.fillStyle = `hsla(0,0%,${80+Math.random()*20}%,${0.2+Math.random()*0.5})`;
      bgCtx.fillRect(Math.random()*width, Math.random()*height, Math.random()<0.1?2:1, 1);
    }
    window.encounterBg = new PIXI.Sprite(PIXI.Texture.from(bgCanvas, {scaleMode:PIXI.SCALE_MODES.LINEAR}));
    window.encounterBg.anchor.set(0);
    stationC.addChildAt(window.encounterBg, 0);

    // Destroy and rebuild planets each encounter so biome changes
    if (window.encounterPlanet) { stationC.removeChild(window.encounterPlanet); window.encounterPlanet.destroy({children:true}); window.encounterPlanet = null; }
    if (window.encounterPlanet2) { stationC.removeChild(window.encounterPlanet2); window.encounterPlanet2.destroy({children:true}); window.encounterPlanet2 = null; }
    if (window.encounterPlanetBg) { stationC.removeChild(window.encounterPlanetBg); window.encounterPlanetBg.destroy({children:true}); window.encounterPlanetBg = null; }
    if (window.encounterAnomaly) { stationC.removeChild(window.encounterAnomaly); window.encounterAnomaly.destroy({children:true}); window.encounterAnomaly = null; }
    if (window.encounterDebris) { stationC.removeChild(window.encounterDebris); window.encounterDebris.destroy({children:true}); window.encounterDebris = null; }

    // Massive planet at bottom, extending below screen
    window.encounterPlanetBg = createPlanetSprite(themes);
    window.encounterPlanetBg.scale.set(3.5 + Math.random() * 2);
    window.encounterPlanetBg.position.set(width * (0.3 + Math.random() * 0.4), height * (0.8 + Math.random() * 0.3));
    window.encounterPlanetBg.alpha = 0.5 + Math.random() * 0.3;
    window.encounterPlanetBg.blendMode = PIXI.BLEND_MODES.NORMAL;
    stationC.addChild(window.encounterPlanetBg);

    // Horizon glow above the big planet
    const horizonGlow = new PIXI.Graphics();
    const hCol = pal.accent;
    horizonGlow.beginFill(hCol, 0.06);
    const hw = width * 1.5, hh = height * 0.15;
    const hcy = window.encounterPlanetBg.y - window.encounterPlanetBg.height * window.encounterPlanetBg.scale.y * 0.5 + 10;
    horizonGlow.drawEllipse(width / 2, hcy, hw, hh);
    horizonGlow.endFill();
    stationC.addChild(horizonGlow);
    window.encounterHorizonGlow = horizonGlow;

    // Small far planet/moon in upper area
    window.encounterPlanet = createPlanetSprite(themes);
    window.encounterPlanet.position.set(width * (0.1 + Math.random() * 0.3), height * (0.08 + Math.random() * 0.12));
    window.encounterPlanet.scale.set(0.3 + Math.random() * 0.4);
    window.encounterPlanet.alpha = 0.3 + Math.random() * 0.2;
    window.encounterPlanet.blendMode = PIXI.BLEND_MODES.ADD;
    stationC.addChild(window.encounterPlanet);
    window.encounterPlanet2 = createPlanetSprite(themes);
    window.encounterPlanet2.position.set(width * (0.7 + Math.random() * 0.2), height * (0.12 + Math.random() * 0.15));
    window.encounterPlanet2.scale.set(0.15 + Math.random() * 0.2);
    window.encounterPlanet2.alpha = 0.08 + Math.random() * 0.1;
    window.encounterPlanet2.blendMode = PIXI.BLEND_MODES.ADD;
    stationC.addChild(window.encounterPlanet2);

    // Proc gen space station
    if (window.activeStation) { stationC.removeChild(window.activeStation); window.activeStation.destroy({children:true}); }
    window.activeStation = (() => {
      const c = new PIXI.Container();
      const pal2 = pal;
      const baseHue = pal2.hues[Math.floor(Math.random() * pal2.hues.length)];
      // Main body - random polygon
      const body = new PIXI.Graphics();
      const bodyPts = 5 + Math.floor(Math.random() * 6);
      const bodyR = 20 + Math.random() * 15;
      body.beginFill(pal2.station, 0.7 + Math.random() * 0.2);
      body.moveTo(Math.cos(0) * bodyR, Math.sin(0) * bodyR);
      for (let i = 1; i <= bodyPts; i++) {
        const a = (i / bodyPts) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
        const r = bodyR * (0.7 + Math.random() * 0.3);
        body.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      body.closePath(); body.endFill();
      // Inner core
      body.beginFill(pal2.accent, 0.2);
      body.drawCircle(0, 0, bodyR * 0.3); body.endFill();
      c.addChild(body);
      // Spires / modules
      const moduleCount = 2 + Math.floor(Math.random() * 4);
      for (let i = 0; i < moduleCount; i++) {
        const ma = Math.random() * Math.PI * 2;
        const md = bodyR * (0.7 + Math.random() * 0.5);
        const ms = new PIXI.Graphics();
        const mw = 3 + Math.random() * 8;
        const mh = 5 + Math.random() * 15;
        ms.beginFill(pal2.station, 0.6);
        ms.drawRoundedRect(-mw / 2, -mh, mw, mh, 2); ms.endFill();
        ms.beginFill(pal2.accent, 0.3 + Math.random() * 0.3);
        ms.drawRoundedRect(-mw * 0.4, -mh * 0.5, mw * 0.8, mh * 0.6, 1); ms.endFill();
        ms.x = Math.cos(ma) * md;
        ms.y = Math.sin(ma) * md;
        ms.rotation = ma + Math.PI / 2;
        c.addChild(ms);
      }
      // Ring around station
      const ring = new PIXI.Graphics();
      const ringR = bodyR * (1.3 + Math.random() * 0.5);
      ring.lineStyle(1.5, pal2.accent, 0.3);
      ring.drawCircle(0, 0, ringR);
      ring.lineStyle(3, pal2.accent, 0.08);
      ring.drawCircle(0, 0, ringR * 1.05);
      c.addChild(ring);
      // Glow center
      const glow = new PIXI.Sprite(tex8);
      glow.anchor.set(0.5);
      glow.scale.set(bodyR * 0.08);
      glow.tint = pal2.accent;
      glow.alpha = 0.3 + Math.sin(Math.random() * 100) * 0.1;
      glow.blendMode = PIXI.BLEND_MODES.ADD;
      c.addChild(glow);
      c.scale.set(6 + Math.random() * 6);
      c.position.set(width * (0.3 + Math.random() * 0.4), height * (0.25 + Math.random() * 0.35));
      return c;
    })();
    stationC.addChild(window.activeStation);

    // Random strange things
    const strangeType = Math.floor(Math.random() * 5);

    // Orbital ring (strange thing type 0)
    if (strangeType === 0) {
      window.encounterAnomaly = new PIXI.Graphics();
      const or = 40 + Math.random() * 60;
      window.encounterAnomaly.lineStyle(2, pal.accent, 0.2);
      window.encounterAnomaly.drawEllipse(0, 0, or, or * 0.3);
      window.encounterAnomaly.lineStyle(4, pal.accent, 0.08);
      window.encounterAnomaly.drawEllipse(0, 0, or * 1.1, or * 0.33);
      window.encounterAnomaly.x = width * (0.5 + (Math.random() - 0.5) * 0.6);
      window.encounterAnomaly.y = height * (0.3 + Math.random() * 0.4);
      window.encounterAnomaly.rotation = Math.random() * Math.PI;
      window.encounterAnomaly.alpha = 0.6 + Math.random() * 0.3;
      stationC.addChild(window.encounterAnomaly);
    // Glowing anomaly / vortex (strange thing type 1)
    } else if (strangeType === 1) {
      window.encounterAnomaly = new PIXI.Graphics();
      const ax = width * (0.2 + Math.random() * 0.6);
      const ay = height * (0.2 + Math.random() * 0.5);
      for (let r = 20; r > 0; r -= 3) {
        window.encounterAnomaly.beginFill(pal.accent, 0.02 + (20 - r) * 0.003);
        window.encounterAnomaly.drawCircle(ax, ay, r);
      }
      window.encounterAnomaly.endFill();
      stationC.addChild(window.encounterAnomaly);
      // Spiral arms
      const spiral = new PIXI.Graphics();
      for (let a = 0; a < Math.PI * 4; a += 0.2) {
        const sr = 5 + a * 3;
        const sx = ax + Math.cos(a) * sr;
        const sy = ay + Math.sin(a) * sr;
        spiral.beginFill(pal.accent, 0.04);
        spiral.drawCircle(sx, sy, 2);
      }
      spiral.endFill();
      stationC.addChild(spiral);
      window.encounterSpiral = spiral;
    // Debris field (strange thing type 2)
    } else if (strangeType === 2) {
      window.encounterDebris = new PIXI.Graphics();
      const dx = width * (0.1 + Math.random() * 0.8);
      const dy = height * (0.2 + Math.random() * 0.5);
      for (let i = 0; i < 40; i++) {
        const px = dx + (Math.random() - 0.5) * 150;
        const py = dy + (Math.random() - 0.5) * 100;
        const ps = 1 + Math.random() * 4;
        window.encounterDebris.beginFill(pal.accent, 0.05 + Math.random() * 0.1);
        window.encounterDebris.drawRect(px, py, ps, ps);
      }
      window.encounterDebris.endFill();
      stationC.addChild(window.encounterDebris);
    // Wreckage (strange thing type 3)
    } else if (strangeType === 3) {
      window.encounterAnomaly = new PIXI.Graphics();
      const wx = width * (0.2 + Math.random() * 0.6);
      const wy = height * (0.3 + Math.random() * 0.4);
      const parts = 3 + Math.floor(Math.random() * 5);
      for (let i = 0; i < parts; i++) {
        const px = wx + (Math.random() - 0.5) * 60;
        const py = wy + (Math.random() - 0.5) * 40;
        window.encounterAnomaly.beginFill(pal.accent, 0.15 + Math.random() * 0.2);
        const pts2 = 3 + Math.floor(Math.random() * 3);
        for (let j = 0; j < pts2; j++) {
          const a2 = (j / pts2) * Math.PI * 2;
          const r2 = 3 + Math.random() * 8;
          j === 0 ? window.encounterAnomaly.moveTo(px + Math.cos(a2) * r2, py + Math.sin(a2) * r2) : window.encounterAnomaly.lineTo(px + Math.cos(a2) * r2, py + Math.sin(a2) * r2);
        }
        window.encounterAnomaly.closePath();
      }
      window.encounterAnomaly.endFill();
      stationC.addChild(window.encounterAnomaly);
    // Alien monolith / structure (strange thing type 4)
    } else {
      window.encounterAnomaly = new PIXI.Graphics();
      const mx = width * (0.3 + Math.random() * 0.4);
      const my = height * (0.25 + Math.random() * 0.35);
      const mw2 = 4 + Math.random() * 8;
      const mh2 = 20 + Math.random() * 30;
      window.encounterAnomaly.beginFill(pal.accent, 0.2);
      window.encounterAnomaly.drawRect(mx - mw2 / 2, my - mh2 / 2, mw2, mh2);
      window.encounterAnomaly.endFill();
      window.encounterAnomaly.beginFill(pal.station, 0.1);
      window.encounterAnomaly.drawRect(mx - mw2 * 0.3, my - mh2 * 0.3, mw2 * 1.6, mh2 * 0.6);
      window.encounterAnomaly.endFill();
      // Glow at top of monolith
      const monoglow = new PIXI.Sprite(tex8);
      monoglow.anchor.set(0.5);
      monoglow.scale.set(mw2 * 0.8);
      monoglow.tint = pal.accent;
      monoglow.alpha = 0.2 + Math.random() * 0.2;
      monoglow.blendMode = PIXI.BLEND_MODES.ADD;
      monoglow.x = mx;
      monoglow.y = my - mh2 / 2;
      stationC.addChild(monoglow);
      window.encounterMonoglow = monoglow;
      stationC.addChild(window.encounterAnomaly);
    }

    // Dynamic text updates to reflect lowered prices
    const bShield = document.getElementById('btnBuyShield');
    if (bShield) {
      if (shieldLayers >= maxShieldLayers) {
        bShield.style.display = 'none';
      } else {
        bShield.style.display = '';
        bShield.innerText = 'Max Shield +1 (Cost: 2,000)';
      }
    }
    const bWep = document.getElementById('btnBuyWeapon');
    if (bWep) bWep.innerText = 'Random Special Weapon (Cost: 500)';
    const bRep = document.getElementById('btnRepairHull');
    if (bRep) bRep.innerText = 'Repair Hull (+50) (Cost: 200)';

  const encounterOverlay = document.getElementById('encounterOverlay');
  encounterOverlay.style.display = '';
  encounterOverlay.classList.add('show');

  const scoreEl = document.getElementById('encounterScore');
  if (scoreEl) scoreEl.innerText = 'BALANCE: ' + Math.floor(score).toLocaleString();
  
  document.getElementById('encounterName').innerText = encName;

  const loreEl = document.getElementById('encounterLore');
  if (loreEl) loreEl.innerText = loreText;

  document.getElementById('encounterOverlay').classList.add('show');
  const uiEl = document.getElementById('ui'); if (uiEl) uiEl.classList.remove('show');
}

function leaveEncounter() {
  inEncounter = false;
  if (mapMode) {
    gameState = 'playing';
    if (gameC) gameC.visible = true;
    document.getElementById('encounterOverlay').classList.remove('show');
    const uiEl = document.getElementById('ui'); if (uiEl) uiEl.classList.add('show');
    if (window.encounterPlanet) { window.encounterPlanet.visible = false; }
    if (window.encounterPlanet2) { window.encounterPlanet2.visible = false; }
    if (window.encounterPlanetBg) { window.encounterPlanetBg.visible = false; }
    if (window.encounterHorizonGlow) { window.encounterHorizonGlow.visible = false; }
    if (window.encounterAnomaly) { window.encounterAnomaly.visible = false; }
    if (window.encounterSpiral) { window.encounterSpiral.visible = false; }
    if (window.encounterDebris) { window.encounterDebris.visible = false; }
    if (window.encounterMonoglow) { window.encounterMonoglow.visible = false; }
    if (window.encounterBg) { window.encounterBg.visible = false; }
    // Station nodes complete immediately after encounter
    finishNodePlay();
    return;
  }
  gameState = 'playing';
  if (gameC) gameC.visible = true;
  document.getElementById('encounterOverlay').classList.remove('show');
  const uiEl = document.getElementById('ui'); if (uiEl) uiEl.classList.add('show');
  waveTimer = 0;
  if (window.encounterPlanet) { window.encounterPlanet.visible = false; }
  if (window.encounterPlanet2) { window.encounterPlanet2.visible = false; }
  if (window.encounterPlanetBg) { window.encounterPlanetBg.visible = false; }
  if (window.encounterHorizonGlow) { window.encounterHorizonGlow.visible = false; }
  if (window.encounterAnomaly) { window.encounterAnomaly.visible = false; }
  if (window.encounterSpiral) { window.encounterSpiral.visible = false; }
  if (window.encounterDebris) { window.encounterDebris.visible = false; }
  if (window.encounterMonoglow) { window.encounterMonoglow.visible = false; }
  if (window.encounterBg) { window.encounterBg.visible = false; }
}

document.getElementById('btnLeaveEncounter')?.addEventListener('pointerdown', (e) => {
  e.stopPropagation();
  leaveEncounter();
});

function updateEncounterScore() {
  const scoreEl = document.getElementById('encounterScore');
  if (scoreEl) scoreEl.innerText = 'BALANCE: ' + Math.floor(score).toLocaleString();
}

document.getElementById('btnBuyShield')?.addEventListener('pointerdown', (e) => {
  e.stopPropagation();
  if (score >= 2000) {
    score -= 2000;
    updateUI();
    maxHealth++;
    health = maxHealth;
    updateUI();
    updateEncounterScore();
    playPowerupSnd();
  } else {
    playHitSnd();
  }
});

document.getElementById('btnBuyWeapon')?.addEventListener('pointerdown', (e) => {
  e.stopPropagation();
  if (score >= 500) {
    score -= 500;
    updateUI();
    updateEncounterScore();
    spawnSpecialPowerup(width/2, height*0.8);
    playPowerupSnd();
    leaveEncounter();
  } else {
    playHitSnd();
  }
});

document.getElementById('btnRepairHull')?.addEventListener('pointerdown', (e) => {
  e.stopPropagation();
  if (score >= 200 && hull < maxHull) {
    score -= 200;
    updateUI();
    hull = Math.min(maxHull, hull + 50);
    updateUI();
    updateEncounterScore();
    playPowerupSnd();
  } else {
    playHitSnd();
  }
});

bindBtn('gameOverMenuBtn', e => { returnToMainMenu(); });
bindBtn('menuFromOverBtn', e => { showDifficulty(); });
bindBtn('retryBtn', e => { startGame(difficulty); });
bindBtn('returnToMapBtn', e => { returnToMapFromGameOver(); });
bindBtn('abandonToMapBtn', e => { abandonToMapFromGameOver(); });
bindBtn('gameOverContinueBtn', e => { 
  if (people >= 1000) continueGame(); 
});
bindBtn('restartRunBtn', e => { location.reload(); });


let lbContainer = null;
function closeLeaderboard() {
  if (lbContainer) { app.stage.removeChild(lbContainer); lbContainer.destroy({children:true}); lbContainer = null; }
  if (gameState === 'menu') { diffOverlay.style.display = ''; diffOverlay.classList.add('show'); }
}
function showLeaderboard() {
  closeLeaderboard();
  diffOverlay.classList.remove('show');
  diffOverlay.style.display = 'none';
  lbContainer = new PIXI.Container();
  const bg = new PIXI.Graphics();
  bg.beginFill(0x05050a, 0.95);
  bg.drawRect(0, 0, width, height);
  bg.endFill();
  lbContainer.addChild(bg);

  const title = new PIXI.Text('LEADERBOARD', {
    fontFamily:'sans-serif',fontSize:28,fontWeight:'900',fill:0xffffff,
    dropShadow:true,dropShadowColor:0x00ffff,dropShadowBlur:10,dropShadowDistance:0
  });
  title.anchor.set(0.5); title.position.set(width/2, 40);
  lbContainer.addChild(title);

  const entries = leaderboard.sort((a,b) => b.score - a.score).slice(0, 100);
  if (entries.length === 0) {
    const empty = new PIXI.Text('No scores yet!', { fontFamily:'sans-serif',fontSize:16,fill:0x888888 });
    empty.anchor.set(0.5); empty.position.set(width/2, height*0.45);
    lbContainer.addChild(empty);
  } else {
    const header = new PIXI.Text('#  NAME   SCORE    WAVE  TIME   DIFF', {
      fontFamily:'monospace',fontSize:11,fill:0x8888ff
    });
    header.position.set(width*0.08, 75);
    lbContainer.addChild(header);
    const maxShow = Math.min(entries.length, Math.floor((height - 120) / 18));
    for (let i = 0; i < maxShow; i++) {
      const e = entries[i];
      const m = Math.floor(e.time / 60), s = e.time % 60;
      const row = new PIXI.Text(
        (''+(i+1)).padStart(2)+'  '+(e.name||'---')+'  '+(''+e.score).padStart(7)+'  '+
        ('w'+e.wave).padStart(4)+'  '+(m+':'+(s<10?'0':'')+s)+'  '+(e.diff||'?').toUpperCase(),
        { fontFamily:'monospace',fontSize:11,fill:i < 3 ? 0xffdd44 : 0xcccccc }
      );
      row.position.set(width*0.08, 95 + i * 18);
      lbContainer.addChild(row);
    }
  }

  const back = new PIXI.Text('BACK', {
    fontFamily:'sans-serif',fontSize:20,fontWeight:'700',fill:0x8888ff,letterSpacing:2
  });
  back.anchor.set(0.5); back.position.set(width/2, height - 50);
  back.eventMode = 'static';
  back.cursor = 'pointer';
  back.on('pointerdown', closeLeaderboard);
  lbContainer.addChild(back);

  app.stage.addChild(lbContainer);
}

// --- UPDATE FX ---
function updateFX(dt = 0.016) {
  for (let i = fxP.length - 1; i >= 0; i--) {
    const p = fxP[i];
    p.x += p.vx; p.y += p.vy;
    if (p.rotSpd) p.rotation += p.rotSpd * dt;
    p.life -= dt;
    const ratio = Math.max(0, p.life / (p.maxLife || 1));
    p.alpha = Math.max(0, p.life * 2) * (p.baseAlpha || 1);
    if (p.complexShape && p.texture === particleShapes[1] && ratio < 0.5) {
      p.texture = particleShapes[Math.random() < 0.5 ? 4 : 7];
      p.scale.set(p.scale.x * 0.7);
    } else if (p.complexShape && ratio < 0.25 && p.texture !== particleShapes[0]) {
      p.texture = particleShapes[0];
      p.scale.set(0.08 + Math.random() * 0.08);
      p.complexShape = false;
    }
    if (p.life <= 0) {
      fxC.removeChild(p);
      spritePool.push(p);
      fxP[i] = fxP[fxP.length - 1];
      fxP.pop();
    }
  }
  if (killQueue.length > 0) {
    const batch = killQueue.splice(0, killQueue.length);
    for (const k of batch) {
      const ei = enemies.indexOf(k.e);
      if (ei >= 0 && enemies[ei] && enemies[ei].tier !== undefined) {
        if (k.e.subtype === 'pinata') {
          for(let g=0; g<10; g++) spawnGems(2);
          spawnPowerup(k.x, k.y);
          spawnPowerup(k.x + 20, k.y);
        }
        if (k.e.explodeOnDeath) {
          spawnExplosion(k.x, k.y, 0xff2200, 40);
          for (let ri = 0; ri < 16; ri++) {
            const ra = (ri / 16) * Math.PI * 2 + Math.random() * 0.2;
            const rr = 20 + Math.random() * 30;
            const rp = allocParticle();
            rp.texture = particleShapes[Math.floor(Math.random() * 4)];
            rp.x = k.x; rp.y = k.y;
            rp.vx = Math.cos(ra) * rr; rp.vy = Math.sin(ra) * rr;
            rp.tint = [0xff2200, 0xff6600, 0xffaa00, 0xffffff][Math.floor(Math.random() * 4)];
            rp.scale.set(0.3 + Math.random() * 0.5);
            rp.life = 0.6 + Math.random() * 0.4;
            rp.blendMode = PIXI.BLEND_MODES.ADD;
            rp.baseAlpha = 1.0;
            rp.complexShape = true;
            rp.maxLife = rp.life; fxP.push(rp);
          }
          for (const ne of enemies) {
            if (Math.hypot(ne.x - k.x, ne.y - k.y) < 100) {
              ne.hp -= 5 + Math.floor(k.e.tier || 0) * 2;
              if (ne.hp <= 0 && !ne.dead) { ne.dead = true; killQueue.push({ e: ne, x: ne.x, y: ne.y, tier: ne.tier }); }
            }
          }
        }
        rmEnemy(ei);
        spawnExplosion(k.x, k.y, TIERS[k.tier]?.cl[0] || 0xffffff, 8);
      }
    }
  }
}

// Wire HTML overlay buttons

// ==================== MAP SYSTEM ====================
const MAP_NODE_TYPES = {
  normal:   { label:'●', color:0x4488ff, desc:'Standard encounter' },
  explosive:{ label:'✸', color:0xff4400, desc:'Explosive enemies only' },
  tiny:     { label:'.', color:0xffff00, desc:'Swarm of tiny enemies' },
  boss:     { label:'♦', color:0xff0044, desc:'Boss encounter' },
  swarm:    { label:'◈', color:0x00ff88, desc:'Mass swarm wave' },
  depot:    { label:'☐', color:0x44ffaa, desc:'Repair / restock depot' },
  station:  { label:'⌂', color:0x88ddff, desc:'Station: buy upgrades' },
  empty:    { label:'○', color:0x8866ff, desc:'Gems only, no enemies' },
  encounter:{ label:'?', color:0xffaa00, desc:'Random encounter' },
};
const STANDARD_ENEMY_ROLES = [
  { role:'scout',  hpMul:0.4, spdMul:1.8, dmgMul:0.5, fireRateMul:2.0, weight:6, desc:'fast weak skirmisher' },
  { role:'soldier',hpMul:0.8, spdMul:1.0, dmgMul:1.0, fireRateMul:1.0, weight:8, desc:'balanced standard' },
  { role:'tank',   hpMul:2.5, spdMul:0.5, dmgMul:1.5, fireRateMul:1.3, weight:4, desc:'slow heavy hitter' },
  { role:'shooter',hpMul:0.7, spdMul:0.9, dmgMul:0.8, fireRateMul:0.6, weight:6, desc:'ranged, fires often' },
  { role:'swarmer',hpMul:0.3, spdMul:2.2, dmgMul:0.4, fireRateMul:3.0, weight:5, desc:'many fast weak enemies' },
  { role:'bomber', hpMul:1.0, spdMul:1.3, dmgMul:1.2, fireRateMul:1.0, weight:3, desc:'explodes on death' },
  { role:'elite',  hpMul:1.6, spdMul:0.8, dmgMul:1.3, fireRateMul:0.8, weight:3, desc:'tough all-rounder' },
  { role:'miniboss',hpMul:3.5,spdMul:0.4,dmgMul:2.0,fireRateMul:0.5,weight:1, desc:'semi-boss enemy' },
];
let mapMode = false;
let mapNodes = [];
let mapCurrentIdx = 0;
let mapContainer = null;
let mapContent = null;
let mapShip = null;
let mapNodeWavesDone = 0;
let mapNodeWaveTotal = 0;
let mapNodeEnemyPool = null;
let mapNodeBossEncounter = false;
let mapNodeFaction = null;
let nodeStartScore = 0;
let nodeStartPeople = 0;
let mapActive = false;
let mapScrollX = 0, mapScrollY = 0;
let mapDragStartX = 0, mapDragStartY = 0, mapDragStartSX = 0, mapDragStartSY = 0;
let mapZoom = 1;
let mapPath = [];
let mapGoalSparkles = [];

const FACTIONS = [
  { name:'Crimson Fleet',  body:0xff3344, accent:0xff8866, ring:0xff2244, core:0xffeedd, boss:0xcc0033 },
  { name:'Azure Syndicate',body:0x3388ff, accent:0x66ddff, ring:0x2266ff, core:0xccddff, boss:0x0044cc },
  { name:'Emerald Hive',   body:0x33ff66, accent:0x88ff44, ring:0x22dd44, core:0xddffcc, boss:0x00aa33 },
  { name:'Void Cult',      body:0xaa44ff, accent:0xff66ee, ring:0x8822dd, core:0xffccff, boss:0x6600bb },
  { name:'Solar Legion',   body:0xff8800, accent:0xffcc44, ring:0xff6600, core:0xffeecc, boss:0xcc5500 },
  { name:'Frost Collective',body:0x44ddff, accent:0xaaffff, ring:0x00ccff, core:0xe0ffff, boss:0x0088cc },
  { name:'Nebula Wardens', body:0x66ffcc, accent:0x44ff88, ring:0x22ddaa, core:0xccffee, boss:0x00aa88 },
  { name:'Obsidian Order', body:0xdd4444, accent:0xff8844, ring:0xaa2222, core:0xffcccc, boss:0x881111 },
];

const MAP_W = Math.max(2400, width * 10);
const MAP_H = Math.max(3000, height * 9);
const TRAVEL_RADIUS = 58;

function generateMap() {
  mapNodes = [];
  mapPath = [];
  const padX = width * 0.5;
  const padY = height * 0.5;
  const mapScale = (DIFF[difficulty] && DIFF[difficulty].mapScale) || 0.25;
  const mapW = (MAP_W - padX * 2) * mapScale + padX * 2;
  const mapH = (MAP_H - padY * 2) * mapScale + padY * 2;
  // Jittered grid for organic but consistent density across full rectangle
  const cellSize = 38; // ~2-3 stars within TRAVEL_RADIUS=58
  const cols = Math.floor((mapW - padX * 2) / cellSize);
  const rows = Math.floor((mapH - padY * 2) / cellSize);
  const targetStars = cols * rows * 0.42; // ~1800 stars for 60x78 grid
  const starCount = Math.floor(targetStars);

  // Tier/type distribution: harder toward top-left (goal), easier at bottom-right (start)
  // We'll assign tier based on normalized distance from start corner
  const startX = mapW - padX;
  const startY = mapH - padY;
  const goalX = padX;
  const goalY = padY;
  const maxDist = Math.hypot(mapW - padX * 2, mapH - padY * 2);

  for (let cx = 0; cx < cols; cx++) {
    for (let cy = 0; cy < rows; cy++) {
      // ~42% fill rate
      if (Math.random() > 0.38) continue;

      // Jittered position within cell
      const x = padX + cx * cellSize + cellSize * 0.5 + (Math.random() - 0.5) * cellSize * 0.7;
      const y = padY + cy * cellSize + cellSize * 0.5 + (Math.random() - 0.5) * cellSize * 0.7;

      // Progress = how far from start toward goal (0 at start, 1 at goal)
      const distFromStart = Math.hypot(x - startX, y - startY);
      const progress = Math.min(1, distFromStart / maxDist);

      // Faction varies naturally
      const faction = Math.floor(Math.random() * FACTIONS.length);

      // Tier ramps with progress + some noise
      const tier = Math.min(8, Math.floor(progress * 6 + Math.random() * 3));
      const intensity = 0.5 + Math.random() * 0.8 + (tier / 12) * 0.7;

      // Star type probabilities
      let type = 'normal';
      const r = Math.random();
      if (r < 0.07) type = 'explosive';
      else if (r < 0.12) type = 'tiny';
      else if (r < 0.17) type = 'swarm';
      else if (r < 0.22) type = 'depot';
      else if (r < 0.27) type = 'station';
      else if (r < 0.31) type = 'empty';
      else if (r < 0.35) type = 'encounter';

      let waveCount = 1;
      if (type !== 'empty') {
        const baseWaves = 4 + Math.floor(Math.random() * 12);
        const typeMul = type === 'boss' ? 1.5 : type === 'station' || type === 'depot' ? 0.6 : type === 'encounter' ? 0.8 : 1.0;
        const diffMul = (DIFF[difficulty] && DIFF[difficulty].waveMul) || 1;
        waveCount = Math.max(4, Math.min(15, Math.round(baseWaves * diffMul * typeMul)));
      }

      mapNodes.push({
        idx: mapNodes.length, x, y, type, tier,
        faction, intensity, waveCount,
        visited: false, completed: false,
        enemyPool: buildEnemyPool(type, tier, faction),
        isBossNode: type === 'boss', isStation: type === 'station' || type === 'depot',
        noEnemies: type === 'empty', extraGems: type === 'empty' ? 20 + tier * 5 : 0,
        isGoal: false,
      });
    }
  }

  // Light connectivity: ensure no star is completely isolated (grid already dense)
  // Sort by Y descending (bottom to top)
  mapNodes.sort((a, b) => b.y - a.y);

  // Identify extremes: start=bottom-right, goal=top-left
  let startNode = mapNodes[0], goalNode = mapNodes[0];
  let startScore = -Infinity, goalScore = Infinity;
  for (const n of mapNodes) {
    const sScore = n.x + n.y;          // max at bottom-right
    const gScore = n.x + n.y;          // min at top-left
    if (sScore > startScore) { startScore = sScore; startNode = n; }
    if (gScore < goalScore) { goalScore = gScore; goalNode = n; }
  }

  // Move to fixed positions
  const startAt = mapNodes.indexOf(startNode);
  const goalAt = mapNodes.indexOf(goalNode);
  if (startAt >= 0) { mapNodes.splice(startAt, 1); mapNodes.unshift(startNode); }
  if (goalAt >= 0) { mapNodes.splice(goalAt, 1); mapNodes.push(goalNode); }

  // Replace last with goal at exact top-left corner
  mapNodes[mapNodes.length - 1] = {
    idx: mapNodes.length - 1,
    x: padX + 5, y: padY + 5,
    type: 'goal', tier: 10, faction: -1, intensity: 1.8, waveCount: 0,
    visited: false, completed: false,
    enemyPool: [], isBossNode: false, isStation: false,
    noEnemies: true, extraGems: 0, isGoal: true,
  };

  // Renumber
  for (let i = 0; i < mapNodes.length; i++) mapNodes[i].idx = i;

  // Enforce 2-5 reachable stars within TRAVEL_RADIUS for every node,
  // with at least 2 that go FORWARD (closer to the goal at top-left).
  const goalX2 = padX + 5, goalY2 = padY + 5;
  function isForward(from, to) { return to.x + to.y < from.x + from.y; }
  const extra = [];
  for (const node of mapNodes) {
    let reachable = 0, forward = 0;
    const neighbors = [];
    for (const other of mapNodes) {
      if (other === node) continue;
      if (Math.hypot(other.x - node.x, other.y - node.y) <= TRAVEL_RADIUS) {
        reachable++;
        neighbors.push(other);
        if (isForward(node, other)) forward++;
      }
    }
    if (reachable > 6) continue;
    const minForward = Math.max(2, Math.min(5, Math.ceil(reachable * 0.4)));
    for (let need = Math.max(2 - reachable, minForward - forward); need > 0; need--) {
      for (let a = 0; a < 40; a++) {
        const biasDir = Math.atan2(goalY2 - node.y, goalX2 - node.x);
        const angle = biasDir + (Math.random() - 0.5) * 1.2;
        const dist = 18 + Math.random() * (TRAVEL_RADIUS - 22);
        const nx = node.x + Math.cos(angle) * dist;
        const ny = node.y + Math.sin(angle) * dist;
        if (nx < padX || nx > mapW - padX || ny < padY || ny > mapH - padY) continue;
        const clash = mapNodes.some(m => m !== node && Math.hypot(m.x - nx, m.y - ny) < 12);
        const clashExtra = extra.some(m => Math.hypot(m.x - nx, m.y - ny) < 12);
        if (clash || clashExtra) continue;
        const tier = Math.min(8, Math.max(1, node.tier + Math.floor(Math.random() * 3) - 1));
        const faction = Math.floor(Math.random() * FACTIONS.length);
        const wc = Math.max(4, Math.min(15, Math.round((4 + Math.random() * 12) * ((DIFF[difficulty] && DIFF[difficulty].waveMul) || 1))));
        extra.push({
          idx: -1, x: nx, y: ny, type: 'normal', tier, faction,
          intensity: 0.5 + Math.random() * 0.8 + (tier / 12) * 0.7,
          waveCount: wc, visited: false, completed: false,
          enemyPool: buildEnemyPool('normal', tier, faction),
          isBossNode: false, isStation: false, noEnemies: false, extraGems: 0, isGoal: false,
        });
        break;
      }
    }
  }
  for (const nd of extra) {
    nd.idx = mapNodes.length;
    mapNodes.push(nd);
  }

  // Start at bottom-right
  mapCurrentIdx = 0;
  mapPath = [0];
  mapNodes[0].visited = true;
}

function buildEnemyPool(type, tier, faction) {
  const pool = { scout:0, soldier:0, tank:0, shooter:0, swarmer:0, bomber:0, elite:0, miniboss:0 };
  const base = 2 + tier;
  // Faction flavors add variation
  const fBias = faction % 5;
  const fExtra = Math.floor(base * 0.4);
  if (type === 'explosive') { pool.bomber = base * 4; if (fBias === 0) pool.elite = fExtra; }
  else if (type === 'tiny') { pool.swarmer = base * 3; pool.scout = base * 2; if (fBias === 1) pool.shooter = fExtra; }
  else if (type === 'boss') { pool.miniboss = base; pool.elite = base * 2; pool.tank = base * 3; if (fBias === 2) pool.bomber = fExtra; }
  else if (type === 'swarm') { pool.swarmer = base * 5; pool.scout = base * 3; if (fBias === 3) pool.soldier = fExtra; }
  else if (type === 'empty') { /* no enemies */ }
  else if (type === 'station' || type === 'depot') { pool.soldier = base; pool.scout = base; if (fBias === 4) pool.tank = fExtra; }
  else if (type === 'encounter') { pool.soldier = base * 2; pool.shooter = base; pool.tank = base; if (fBias === 0) pool.elite = fExtra; }
  else {
    pool.soldier = base * 2;
    pool.scout = base;
    pool.shooter = base;
    pool.tank = Math.max(1, Math.floor(base * 0.5));
    pool.bomber = Math.floor(base * 0.3);
    pool.swarmer = Math.floor(base * 0.5);
    pool.elite = Math.floor(base * 0.2);
    if (fBias === 1) pool.swarmer += fExtra;
    else if (fBias === 2) pool.tank += fExtra;
    else if (fBias === 3) pool.shooter += fExtra;
    else if (fBias === 4) pool.bomber += fExtra;
  }
  return pool;
}

function updateMapSparkles(now) {
  if (!mapGoalSparkles || !mapGoalSparkles.length) return;
  for (const s of mapGoalSparkles) {
    if (!s.container || !s.sparkle || s.sparkle._destroyed) continue;
    const pulse = Math.sin(now * 0.008 + s.phase) * 0.5 + 0.5;
    s.sparkle.alpha = 0.4 + pulse * 0.6;
    s.sparkle.scale.set(0.7 + pulse * 0.6);
    s.sparkle.rotation += 0.04;
  }
}

function renderMap() {
  if (!app) return;
  if (mapContainer) {
    app.stage.removeChild(mapContainer);
    mapContainer.destroy({children:true});
    mapContainer = null;
  }
  mapGoalSparkles = [];
  mapContainer = new PIXI.Container();
  // Full-screen opaque black background so NO game content shows through
  const fullBg = new PIXI.Graphics();
  fullBg.beginFill(0x000000);
  fullBg.drawRect(-10, -10, width + 20, height + 20);
  fullBg.endFill();
  mapContainer.addChild(fullBg);
  mapContent = new PIXI.Container();
  const mapUI = new PIXI.Container();
  mapContainer.addChild(mapContent);
  mapContainer.addChild(mapUI);

  // Center on the whole map
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const n of mapNodes) { if (n.x < minX) minX = n.x; if (n.x > maxX) maxX = n.x; if (n.y < minY) minY = n.y; if (n.y > maxY) maxY = n.y; }
  const mapW = maxX - minX || 1, mapH = maxY - minY || 1;
  mapZoom = Math.max(0.3, Math.min(width / mapW * 0.8, (height * 0.8) / mapH));
  const focusX = (minX + maxX) / 2;
  const focusY = (minY + maxY) / 2;
  mapScrollX = width / 2 - focusX * mapZoom;
  mapScrollY = height / 2 - focusY * mapZoom;
  mapContent.position.set(mapScrollX, mapScrollY);
  mapContent.scale.set(mapZoom);

  if (!window._mapBgCanvas) {
    window._mapBgCanvas = document.createElement('canvas');
    window._mapBgCanvas.width = 512; window._mapBgCanvas.height = 512;
    const bgCtx = window._mapBgCanvas.getContext('2d');
    bgCtx.fillStyle = '#000000'; bgCtx.fillRect(0, 0, 512, 512);
    for (let si = 0; si < 120; si++) {
      const sx = Math.random() * 512, sy = Math.random() * 512;
      const sr = 0.2 + Math.random() * 1.0;
      const brightness = 0.06 + Math.random() * 0.12;
      const shade = Math.floor(120 + Math.random() * 80);
      bgCtx.fillStyle = 'rgba(' + shade + ',' + shade + ',' + Math.floor(shade * 1.2) + ',' + brightness + ')';
      bgCtx.beginPath(); bgCtx.arc(sx, sy, sr, 0, Math.PI * 2); bgCtx.fill();
    }
  }
  const bgTex = PIXI.Texture.from(window._mapBgCanvas);
  const bgSprite = new PIXI.TilingSprite(bgTex, MAP_W + width, MAP_H + height);
  bgSprite.x = -width * 0.5; bgSprite.y = -height * 0.5;
  mapContent.addChild(bgSprite);

  window._mapBgEl = new PIXI.Container();
  const padX = width * 0.5, padY = height * 0.5;
    const nebColors = [0xff4466, 0x4488ff, 0x66ff88, 0xff66aa, 0x44ffcc, 0xaa66ff, 0xff8844, 0x88ddff];
    for (let ni = 0; ni < 6; ni++) {
      const nx = padX + 80 + Math.random() * (MAP_W - padX * 2 - 160);
      const ny = padY + 80 + Math.random() * (MAP_H - padY * 2 - 160);
      const nw = 150 + Math.random() * 350;
      const nh = 100 + Math.random() * 250;
      const col = nebColors[Math.floor(Math.random() * nebColors.length)];
      const ng = new PIXI.Graphics();
      ng.beginFill(col, 0.02); ng.drawEllipse(0, 0, nw, nh); ng.endFill();
      ng.beginFill(col, 0.04); ng.drawEllipse(0, 0, nw * 0.6, nh * 0.6); ng.endFill();
      ng.beginFill(col, 0.06); ng.drawEllipse(0, 0, nw * 0.3, nh * 0.3); ng.endFill();
      ng.position.set(nx, ny); ng.rotation = Math.random() * Math.PI * 2;
      window._mapBgEl.addChild(ng);
    }
    const galColors = [0xffd700, 0x88ccff, 0xff88aa, 0x66ffcc];
    for (let gi = 0; gi < 3; gi++) {
      const gx = padX + 200 + Math.random() * (MAP_W - padX * 2 - 400);
      const gy = padY + 150 + Math.random() * (MAP_H - padY * 2 - 300);
      const gs = 80 + Math.random() * 150;
      const col = galColors[gi % galColors.length];
      const gg = new PIXI.Graphics();
      gg.beginFill(col, 0.03); gg.drawEllipse(0, 0, gs, gs * 0.4); gg.endFill();
      gg.beginFill(col, 0.06); gg.drawEllipse(0, 0, gs * 0.6, gs * 0.25); gg.endFill();
      gg.beginFill(col, 0.12); gg.drawEllipse(0, 0, gs * 0.3, gs * 0.12); gg.endFill();
      gg.beginFill(0xffffff, 0.3); gg.drawEllipse(0, 0, gs * 0.12, gs * 0.05); gg.endFill();
      gg.position.set(gx, gy); gg.rotation = Math.random() * Math.PI * 2;
      window._mapBgEl.addChild(gg);
    }
    for (let di = 0; di < 4; di++) {
      const dx = padX + 100 + Math.random() * (MAP_W - padX * 2 - 200);
      const dy = padY + 100 + Math.random() * (MAP_H - padY * 2 - 200);
      const dr = 60 + Math.random() * 150;
      const dg = new PIXI.Graphics();
      for (let pi = 0; pi < 60; pi++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = dr * 0.3 + Math.random() * dr * 0.7;
        const px = Math.cos(angle) * dist, py = Math.sin(angle) * dist;
        const ds = 0.3 + Math.random() * 0.8;
        dg.beginFill(0x888899, 0.1 + Math.random() * 0.2); dg.drawCircle(px, py, ds); dg.endFill();
      }
      dg.position.set(dx, dy);
      window._mapBgEl.addChild(dg);
    }
    for (let si = 0; si < 3; si++) {
      const sx = padX + 100 + Math.random() * (MAP_W - padX * 2 - 200);
      const sy = padY + 100 + Math.random() * (MAP_H - padY * 2 - 200);
      const ss = 1.5 + Math.random() * 2;
      const sg = new PIXI.Graphics();
      sg.beginFill(0x4488aa, 0.25); sg.drawCircle(0, 0, 12 * ss); sg.endFill();
      sg.lineStyle(1.2, 0x66ccff, 0.3); sg.drawCircle(0, 0, 6 * ss);
      sg.lineStyle(0.8, 0x88ddff, 0.2);
      sg.moveTo(-10 * ss, 0); sg.lineTo(10 * ss, 0);
      sg.moveTo(0, -10 * ss); sg.lineTo(0, 10 * ss);
      sg.moveTo(-7 * ss, -7 * ss); sg.lineTo(7 * ss, 7 * ss);
      sg.moveTo(7 * ss, -7 * ss); sg.lineTo(-7 * ss, 7 * ss);
      sg.beginFill(0x66ccff, 0.15); sg.drawCircle(0, 0, 3 * ss); sg.endFill();
      sg.position.set(sx, sy); sg.rotation = Math.random() * Math.PI * 2;
      window._mapBgEl.addChild(sg);
    }
    if (Math.random() < 0.6) {
      const ax = padX + 200 + Math.random() * (MAP_W - padX * 2 - 400);
      const ay = padY + 200 + Math.random() * (MAP_H - padY * 2 - 400);
      const ar = 30 + Math.random() * 80;
      const aCols = [0xaa44ff, 0xff44aa, 0x44ffaa];
      const ac = aCols[Math.floor(Math.random() * aCols.length)];
      const ag = new PIXI.Graphics();
      ag.beginFill(ac, 0.04); ag.drawCircle(0, 0, ar * 2); ag.endFill();
      ag.beginFill(ac, 0.08); ag.drawCircle(0, 0, ar); ag.endFill();
      ag.beginFill(ac, 0.15); ag.drawCircle(0, 0, ar * 0.4); ag.endFill();
      ag.blendMode = PIXI.BLEND_MODES.ADD;
      ag.position.set(ax, ay);
      window._mapBgEl.addChild(ag);
    }
  mapContent.addChild(window._mapBgEl);

  // === Draw retroactive path lines ===
  const pathGfx = new PIXI.Graphics();
  if (mapPath.length > 1) {
    pathGfx.lineStyle(2, 0x4466aa, 0.4);
    for (let pi = 0; pi < mapPath.length - 1; pi++) {
      const a = mapNodes[mapPath[pi]], b = mapNodes[mapPath[pi + 1]];
      pathGfx.moveTo(a.x, a.y); pathGfx.lineTo(b.x, b.y);
    }
    // Subtle glow
    pathGfx.lineStyle(6, 0x4466aa, 0.08);
    for (let pi = 0; pi < mapPath.length - 1; pi++) {
      const a = mapNodes[mapPath[pi]], b = mapNodes[mapPath[pi + 1]];
      pathGfx.moveTo(a.x, a.y); pathGfx.lineTo(b.x, b.y);
    }
  }
  mapContent.addChild(pathGfx);

  // === Jump radius circle around current ===
  const cur = mapNodes[mapCurrentIdx];
  const _goalNode = mapNodes.find(n => n.isGoal) || mapNodes[mapNodes.length - 1];
  if (cur) {
    const radiusGfx = new PIXI.Graphics();
    radiusGfx.lineStyle(1.5, 0x44ddff, 0.15);
    radiusGfx.drawCircle(cur.x, cur.y, TRAVEL_RADIUS);
    radiusGfx.beginFill(0x44ddff, 0.03);
    radiusGfx.drawCircle(cur.x, cur.y, TRAVEL_RADIUS);
    radiusGfx.endFill();
    mapContent.addChild(radiusGfx);
  }

  // === Stars ===
  for (const node of mapNodes) {
    const isCurrent = node.idx === mapCurrentIdx;
    const isVisited = node.completed || node.visited;
    const dist = cur ? Math.hypot(node.x - cur.x, node.y - cur.y) : Infinity;
    const isReachable = !isVisited && dist <= TRAVEL_RADIUS;
    const isGoal = node.isGoal;
    const ng = new PIXI.Container();

    const intens = node.intensity || 1;
    if (isGoal) {
      const g = new PIXI.Graphics();
      const gs = 0.2;
      g.beginFill(0xffd700, (isVisited ? 0.15 : 0.25) * intens);
      g.drawCircle(0, 0, 50 * intens * gs);
      g.endFill();
      g.beginFill(0xffd700, (isVisited ? 0.35 : 0.55) * intens);
      g.drawCircle(0, 0, 30 * intens * gs);
      g.endFill();
      g.beginFill(0xffd700, 0.9 * intens);
      g.drawCircle(0, 0, 16 * intens * gs);
      g.endFill();
      g.beginFill(0xffffff, 0.95 * intens);
      g.drawCircle(0, 0, 8 * intens * gs);
      g.endFill();
      for (let ri = 0; ri < 12; ri++) {
        const a = (ri / 12) * Math.PI * 2;
        g.lineStyle(0.6, 0xffd700, (isReachable ? 0.4 : 0.2) * intens);
        g.moveTo(0, 0);
        g.lineTo(Math.cos(a) * 36 * intens * gs, Math.sin(a) * 36 * intens * gs);
      }
      ng.addChild(g);
      const sparkle = new PIXI.Graphics();
      sparkle.name = 'sparkle';
      sparkle.beginFill(0xffffff, 0.9);
      sparkle.drawCircle(0, -10 * gs * intens, 1.2);
      sparkle.endFill();
      sparkle.beginFill(0xffffff, 0.9);
      sparkle.drawCircle(8 * gs * intens, 4 * gs * intens, 1.0);
      sparkle.endFill();
      sparkle.beginFill(0xffffff, 0.9);
      sparkle.drawCircle(-8 * gs * intens, 4 * gs * intens, 1.0);
      sparkle.endFill();
      ng.addChild(sparkle);
      if (!mapGoalSparkles) mapGoalSparkles = [];
      mapGoalSparkles.push({ container: ng, sparkle, phase: Math.random() * Math.PI * 2 });
    } else if (isCurrent) {
      const f = FACTIONS[node.faction];
      const gGlow = new PIXI.Graphics();
      gGlow.beginFill(0x44ddff, 0.12 * intens);
      gGlow.drawCircle(0, 0, 38 * intens);
      gGlow.endFill();
      gGlow.beginFill(0xffffff, 0.18 * intens);
      gGlow.drawCircle(0, 0, 22 * intens);
      gGlow.endFill();
      gGlow.blendMode = PIXI.BLEND_MODES.ADD;
      const g = new PIXI.Graphics();
      g.beginFill(f.body, 0.25 * intens);
      g.drawCircle(0, 0, 18 * intens);
      g.endFill();
      g.beginFill(f.body, 0.8 * intens);
      g.drawCircle(0, 0, 11 * intens);
      g.endFill();
      g.beginFill(0xffffff, 1);
      g.drawCircle(0, 0, 5 * intens);
      g.endFill();
      ng.addChild(gGlow);
      ng.addChild(g);
    } else if (isReachable) {
      const f = FACTIONS[node.faction];
      const sz = 13 * intens;
      const gGlow = new PIXI.Graphics();
      gGlow.beginFill(f.ring || f.body, 0.04 * intens);
      gGlow.drawCircle(0, 0, sz * 4.5);
      gGlow.endFill();
      gGlow.beginFill(f.ring || f.body, 0.08 * intens);
      gGlow.drawCircle(0, 0, sz * 2.5);
      gGlow.endFill();
      gGlow.blendMode = PIXI.BLEND_MODES.ADD;
      const g = new PIXI.Graphics();
      g.beginFill(f.body, 0.25 * intens);
      g.drawCircle(0, 0, sz * 1.6);
      g.endFill();
      g.beginFill(f.body, 0.7 * intens);
      g.drawCircle(0, 0, sz);
      g.endFill();
      g.beginFill(f.core || 0xffffff, 0.9 * intens);
      g.drawCircle(0, 0, sz * 0.4);
      g.endFill();
      ng.addChild(gGlow);
      ng.addChild(g);
      const hint = new PIXI.Graphics();
      const hx = sz * 0.7, hy = -sz * 0.7, hs = sz * 0.22;
      const hAlpha = 0.5 * intens;
      switch (node.type) {
        case 'depot':
        case 'station':
          hint.lineStyle(1.2, 0xffffff, hAlpha); hint.drawRect(hx - hs, hy - hs, hs * 2, hs * 2);
          break;
        case 'encounter':
          hint.lineStyle(1.2, 0xaaddff, hAlpha);
          hint.moveTo(hx, hy - hs); hint.lineTo(hx + hs, hy); hint.lineTo(hx, hy + hs); hint.lineTo(hx - hs, hy); hint.closePath();
          break;
        case 'empty':
          hint.beginFill(0x88ffaa, hAlpha); hint.drawCircle(hx, hy, hs * 0.6); hint.endFill();
          break;
        case 'explosive':
          hint.lineStyle(1.2, 0xff6644, hAlpha);
          hint.moveTo(hx - hs, hy - hs); hint.lineTo(hx + hs, hy + hs);
          hint.moveTo(hx + hs, hy - hs); hint.lineTo(hx - hs, hy + hs);
          break;
        case 'tiny':
          hint.beginFill(0x66ccff, hAlpha); hint.drawCircle(hx, hy, hs * 0.5); hint.endFill();
          break;
        case 'swarm':
          hint.beginFill(0x88ff44, hAlpha); hint.drawCircle(hx - hs * 0.3, hy, hs * 0.35); hint.endFill();
          hint.beginFill(0x88ff44, hAlpha); hint.drawCircle(hx + hs * 0.3, hy - hs * 0.3, hs * 0.35); hint.endFill();
          hint.beginFill(0x88ff44, hAlpha); hint.drawCircle(hx + hs * 0.3, hy + hs * 0.3, hs * 0.35); hint.endFill();
          break;
        default:
          hint.beginFill(0xffffff, hAlpha * 0.6); hint.drawCircle(hx, hy, hs * 0.4); hint.endFill();
      }
      ng.addChild(hint);
      // Forward-direction arrow on reachable stars that lead toward the goal
      if (cur && node.x + node.y < cur.x + cur.y) {
        const dirArrow = new PIXI.Graphics();
        const arrowSize = sz * 0.5;
        const ang = Math.atan2(_goalNode.y - node.y, _goalNode.x - node.x);
        const ax = Math.cos(ang) * sz * 1.3;
        const ay = Math.sin(ang) * sz * 1.3;
        dirArrow.beginFill(0x44ffaa, 0.7);
        dirArrow.moveTo(Math.cos(ang) * arrowSize, Math.sin(ang) * arrowSize);
        dirArrow.lineTo(Math.cos(ang + 2.3) * arrowSize * 0.6, Math.sin(ang + 2.3) * arrowSize * 0.6);
        dirArrow.lineTo(Math.cos(ang - 2.3) * arrowSize * 0.6, Math.sin(ang - 2.3) * arrowSize * 0.6);
        dirArrow.closePath(); dirArrow.endFill();
        dirArrow.x = ax; dirArrow.y = ay;
        ng.addChild(dirArrow);
      }
    } else if (isVisited) {
      const f = FACTIONS[node.faction];
      const sz = 10 * intens;
      const g = new PIXI.Graphics();
      g.beginFill(f.body, 0.1 * intens);
      g.drawCircle(0, 0, sz * 2.2);
      g.endFill();
      g.beginFill(f.body, 0.25 * intens);
      g.drawCircle(0, 0, sz);
      g.endFill();
      g.beginFill(0x8899aa, 0.3 * intens);
      g.drawCircle(0, 0, sz * 0.45);
      g.endFill();
      ng.addChild(g);
    } else {
      const g = new PIXI.Graphics();
      g.beginFill(0x555577, 0.15 * intens);
      g.drawCircle(0, 0, 8 * intens);
      g.endFill();
      g.beginFill(0x8899bb, 0.2 * intens);
      g.drawCircle(0, 0, 4 * intens);
      g.endFill();
      ng.addChild(g);
    }
    ng.x = node.x; ng.y = node.y;
    mapContent.addChild(ng);
  }

  // === Ship at current ===
  if (cur) {
    mapShip = new PIXI.Container();
    const s = new PIXI.Graphics();
    s.beginFill(0xffffff); s.moveTo(0, -14); s.lineTo(10, 10); s.lineTo(-10, 10); s.closePath(); s.endFill();
    s.beginFill(0x44ddff, 0.85); s.moveTo(0, -6); s.lineTo(5, 5); s.lineTo(-5, 5); s.closePath(); s.endFill();
    mapShip.addChild(s);
    const g2 = new PIXI.Graphics(); g2.beginFill(0x44ddff, 0.08); g2.drawCircle(0, 0, 20); g2.endFill();
    mapShip.addChild(g2);
    mapShip.x = cur.x; mapShip.y = cur.y;
    mapContent.addChild(mapShip);
  }

  // === Border frame around the map ===
  const borderPad = 4;
  const borderGfx = new PIXI.Graphics();
  borderGfx.lineStyle(1.5, 0x44ddff, 0.15); borderGfx.drawRect(borderPad, borderPad, width - borderPad * 2, height - borderPad * 2);
  borderGfx.lineStyle(3, 0x44ddff, 0.06); borderGfx.drawRect(borderPad, borderPad, width - borderPad * 2, height - borderPad * 2);
  mapUI.addChild(borderGfx);

  const uiTop = 30;

  // === UI overlay ===
  const title = new PIXI.Text('✦ S E A   O F   S T A R S ✦', {
    fontFamily: 'Orbitron', fontSize: 12, fill: 0xccccff, letterSpacing: 3,
    dropShadow: true, dropShadowColor: '#000', dropShadowBlur: 4, dropShadowDistance: 0,
  });
  title.anchor.set(0.5); title.x = width / 2; title.y = uiTop;
  mapUI.addChild(title);

  const visitedCount = mapNodes.filter(n => n.completed).length;
  const totalCount = mapNodes.length;
  const progY = uiTop + 18;
  const progW = Math.min(width - 80, 200);
  const progX = (width - progW) / 2;
  const progBg = new PIXI.Graphics();
  progBg.beginFill(0x222244, 0.5); progBg.drawRoundedRect(progX, progY, progW, 4, 2); progBg.endFill();
  mapUI.addChild(progBg);
  const progFill = new PIXI.Graphics();
  progFill.beginFill(0x44ddff, 0.6);
  progFill.drawRoundedRect(progX, progY, Math.max(3, progW * (visitedCount / totalCount)), 4, 2);
  progFill.endFill();
  mapUI.addChild(progFill);
  const progText = new PIXI.Text(visitedCount + '/' + totalCount, {
    fontFamily: 'Orbitron', fontSize: 7, fill: 0x8888cc,
  });
  progText.position.set(progX + progW + 5, progY - 1);
  mapUI.addChild(progText);

  if (cur && cur.type !== 'goal') {
    const fc = FACTIONS[cur.faction];
    const descInfo = MAP_NODE_TYPES[cur.type] || MAP_NODE_TYPES.normal;
    const ni = new PIXI.Text((fc ? fc.name + ' ' : '') + descInfo.desc + ' ⚡' + (cur.tier + 1), {
      fontFamily: 'Orbitron', fontSize: 7, fill: fc ? fc.body : 0x44ddff,
    });
    ni.anchor.set(0.5); ni.position.set(width / 2, uiTop + 34);
    mapUI.addChild(ni);
  }

  const instr = new PIXI.Text('Drag · Pinch · Tap a Star', {
    fontFamily: 'Orbitron', fontSize: 7, fill: 0x555577,
  });
  instr.anchor.set(0.5); instr.position.set(width / 2, height - 8);
  mapUI.addChild(instr);

  const backText = new PIXI.Text('← BACK', {
    fontFamily: 'Orbitron', fontSize: 13, fill: 0x44ddff,
    dropShadow: true, dropShadowColor: '#000', dropShadowBlur: 4, dropShadowDistance: 0,
  });
  backText.x = 6; backText.y = uiTop;
  backText.eventMode = 'static'; backText.cursor = 'pointer';
  backText.on('pointerdown', (e) => { e.stopPropagation(); returnToMainMenuFromMap(); });
  mapUI.addChild(backText);

  // === Persistent stats (fixed, unmoving) ===
  const statsText = new PIXI.Text(Math.floor(score).toLocaleString() + ' pts  |  ' + Math.floor(people) + ' saved', {
    fontFamily: 'Orbitron', fontSize: 7, fill: 0x8888cc,
  });
  statsText.x = width - 6; statsText.y = uiTop; statsText.anchor.set(1, 0);
  mapUI.addChild(statsText);

  // === Legend toggle button ===
  let legendExpanded = false;
  const legendBtn = new PIXI.Text('LEGEND', { fontFamily: 'Orbitron', fontSize: 10, fill: 0x44ddff, dropShadow: true, dropShadowColor: '#000', dropShadowBlur: 4, dropShadowDistance: 0 });
  legendBtn.x = width - 6; legendBtn.y = uiTop + 12; legendBtn.anchor.set(1, 0);
  legendBtn.eventMode = 'static'; legendBtn.cursor = 'pointer';
  const legendPanel = new PIXI.Container();
  legendPanel.visible = false;
  function buildLegend() {
    legendPanel.removeChildren();
    const colW = 105, rowH = 14, colGap = 105;
    const nRows = 9, nCols = 2;
    const pw = colW * nCols + 12, ph = rowH * nRows + 12;
    const lg = new PIXI.Graphics();
    lg.beginFill(0x000011, 0.92); lg.drawRoundedRect(-6, 0, pw, ph, 6); lg.endFill();
    lg.lineStyle(1, 0x44ddff, 0.3); lg.drawRoundedRect(-6, 0, pw, ph, 6);
    legendPanel.addChild(lg);
    const items = [
      { lbl: 'Your position', clr: 0x44ddff, col:0 },
      { lbl: 'Goal (boss)', clr: 0xffd700, col:0 },
      { lbl: 'Reachable star', clr: 0x88aaff, col:0 },
      { lbl: 'Completed', clr: 0x445577, col:0 },
      { lbl: 'Unreachable', clr: 0x555577, col:0 },
      { lbl: 'Station / Depot', sym:'□', clr:0xffffff, col:1 },
      { lbl: 'Encounter (rand.)', sym:'△', clr:0xaaddff, col:1 },
      { lbl: 'Explosive', sym:'✕', clr:0xff6644, col:1 },
      { lbl: 'Swarm', sym:'∴', clr:0x88ff44, col:1 },
    ];
    items.forEach((it, i) => {
      const cx = 10 + (it.col || 0) * colGap;
      const cy = 16 + i * rowH;
      if (it.sym) {
        const t = new PIXI.Text(it.sym, { fontFamily:'Orbitron', fontSize:7, fill:it.clr });
        t.x = cx; t.y = cy; legendPanel.addChild(t);
      } else {
        const dot = new PIXI.Graphics();
        dot.beginFill(it.clr, 0.8); dot.drawCircle(cx + 4, cy + 4, 3); dot.endFill();
        legendPanel.addChild(dot);
      }
      const lbl = new PIXI.Text(it.lbl, { fontFamily:'Orbitron', fontSize:6, fill:0xaaaacc });
      lbl.x = cx + 12; lbl.y = cy; legendPanel.addChild(lbl);
    });
    legendPanel.x = width - 6 - pw; legendPanel.y = uiTop + 26;
  }
  buildLegend();
  mapUI.addChild(legendPanel);
  legendBtn.on('pointerdown', (e) => { e.stopPropagation(); legendExpanded = !legendExpanded; legendPanel.visible = legendExpanded; legendBtn.text = legendExpanded ? '◆' : '◇'; });
  mapUI.addChild(legendBtn);

  // === Direction compass — always points toward the goal ===
  if (cur && !cur.isGoal) {
    const compGfx = new PIXI.Graphics();
    const compAng = Math.atan2(_goalNode.y - cur.y, _goalNode.x - cur.x);
    const cx2 = 50, cy2 = height - 36;
    compGfx.lineStyle(1.5, 0xffd700, 0.5);
    compGfx.drawCircle(cx2, cy2, 14);
    compGfx.lineStyle(2, 0xffd700, 0.7);
    compGfx.moveTo(cx2, cy2);
    compGfx.lineTo(cx2 + Math.cos(compAng) * 14, cy2 + Math.sin(compAng) * 14);
    compGfx.beginFill(0xffd700, 0.6);
    compGfx.drawCircle(cx2 + Math.cos(compAng) * 14, cy2 + Math.sin(compAng) * 14, 3);
    compGfx.endFill();
    // Cardinal dot at top of compass ring
    compGfx.beginFill(0xffd700, 0.3);
    compGfx.drawCircle(cx2, cy2 - 14, 1.5);
    compGfx.endFill();
    mapUI.addChild(compGfx);
    const compLabel = new PIXI.Text('GOAL', {
      fontFamily: 'Orbitron', fontSize: 6, fill: 0xffd700,
    });
    compLabel.anchor.set(0.5, 0);
    compLabel.x = cx2; compLabel.y = cy2 + 16;
    mapUI.addChild(compLabel);
  }

  app.stage.addChild(mapContainer);
  setupMapCanvasEvents();
  mapActive = true;
}

let mapPointers = {};
let mapLastPinchDist = 0;

function setupMapCanvasEvents() {
  const canvas = app.view;
  if (!canvas) return;
  teardownMapCanvasEvents();
  function pd(e) {
    if (!mapActive || !mapContainer) return;
    const r = canvas.getBoundingClientRect();
    const px = e.clientX - r.left, py = e.clientY - r.top;
    mapPointers[e.pointerId] = { x: px, y: py, sx: px, sy: py, t: Date.now() };
    const keys = Object.keys(mapPointers);
    if (keys.length === 1) {
      mapDragStartX = px; mapDragStartY = py;
      mapDragStartSX = mapScrollX; mapDragStartSY = mapScrollY;
    } else if (keys.length === 2) {
      const p1 = mapPointers[keys[0]], p2 = mapPointers[keys[1]];
      mapLastPinchDist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
    }
    e.preventDefault();
  }
  function pm(e) {
    if (!mapActive || !mapContainer || !mapPointers[e.pointerId]) return;
    const r = canvas.getBoundingClientRect();
    mapPointers[e.pointerId].x = e.clientX - r.left;
    mapPointers[e.pointerId].y = e.clientY - r.top;
    const keys = Object.keys(mapPointers);
    if (keys.length === 1) {
      mapScrollX = mapDragStartSX + (mapPointers[keys[0]].x - mapDragStartX);
      mapScrollY = mapDragStartSY + (mapPointers[keys[0]].y - mapDragStartY);
      mapContent.position.set(mapScrollX, mapScrollY);
    } else if (keys.length >= 2) {
      const p1 = mapPointers[keys[0]], p2 = mapPointers[keys[1]];
      const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
      if (mapLastPinchDist > 0) {
        const oldZoom = mapZoom;
        const scale = dist / mapLastPinchDist;
        mapZoom = Math.max(0.3, Math.min(4, mapZoom * scale));
        const actualScale = mapZoom / oldZoom;
        mapContent.scale.set(mapZoom);
        const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
        mapContent.position.set(mx - (mx - mapScrollX) * actualScale, my - (my - mapScrollY) * actualScale);
        mapScrollX = mapContent.x;
        mapScrollY = mapContent.y;
      }
      mapLastPinchDist = dist;
    }
    e.preventDefault();
  }
  function pu(e) {
    if (!mapActive) return;
    const beforeDelete = Object.keys(mapPointers).length;
    const ptr = mapPointers[e.pointerId];
    if (ptr && beforeDelete === 1) {
      const dx = ptr.x - ptr.sx, dy = ptr.y - ptr.sy;
      if (Math.hypot(dx, dy) < 12 && Date.now() - ptr.t < 400) {
        handleMapTap(ptr.x, ptr.y);
      }
    }
    delete mapPointers[e.pointerId];
    const remaining = Object.keys(mapPointers).length;
    if (remaining === 1 && beforeDelete >= 2) {
      const k = Object.keys(mapPointers)[0];
      mapDragStartX = mapPointers[k].x;
      mapDragStartY = mapPointers[k].y;
      mapDragStartSX = mapScrollX;
      mapDragStartSY = mapScrollY;
    }
    if (remaining < 2) mapLastPinchDist = 0;
    e.preventDefault();
  }
  function pc(e) {
    if (!mapActive) return;
    const beforeDelete = Object.keys(mapPointers).length;
    delete mapPointers[e.pointerId];
    const remaining = Object.keys(mapPointers).length;
    if (remaining === 1 && beforeDelete >= 2) {
      const k = Object.keys(mapPointers)[0];
      mapDragStartX = mapPointers[k].x;
      mapDragStartY = mapPointers[k].y;
      mapDragStartSX = mapScrollX;
      mapDragStartSY = mapScrollY;
    }
    if (remaining < 2) mapLastPinchDist = 0;
  }
  canvas._mapEv = { pd, pm, pu, pc };
  canvas.addEventListener('pointerdown', pd, { passive: false });
  canvas.addEventListener('pointermove', pm, { passive: false });
  canvas.addEventListener('pointerup', pu, { passive: false });
  canvas.addEventListener('pointercancel', pc, { passive: false });
  canvas.style.touchAction = 'none';
}

function teardownMapCanvasEvents() {
  const canvas = app.view;
  if (!canvas || !canvas._mapEv) return;
  const { pd, pm, pu, pc } = canvas._mapEv;
  canvas.removeEventListener('pointerdown', pd);
  canvas.removeEventListener('pointermove', pm);
  canvas.removeEventListener('pointerup', pu);
  canvas.removeEventListener('pointercancel', pc);
  delete canvas._mapEv;
  mapPointers = {};
  mapLastPinchDist = 0;
  if (canvas.style) canvas.style.touchAction = '';
}

function handleMapTap(cx, cy) {
  const mx = (cx - mapScrollX) / mapZoom;
  const my = (cy - mapScrollY) / mapZoom;
  const cur = mapNodes[mapCurrentIdx];
  if (!cur) return;
  let best = null, bestD = Infinity;
  for (const node of mapNodes) {
    if (node.completed || node.visited || node.idx === mapCurrentIdx) continue;
    const dist = Math.hypot(node.x - cur.x, node.y - cur.y);
    if (dist > TRAVEL_RADIUS) continue;
    const d = Math.hypot(node.x - mx, node.y - my);
    if (d < bestD && d < 100) { bestD = d; best = node; }
  }
  if (best) onMapNodeTap(best.idx);
}

function onMapNodeTap(idx) {
  const target = mapNodes[idx];
  if (!target || target.completed || target.visited) return;
  const cur = mapNodes[mapCurrentIdx];
  if (!cur) return;
  const dist = Math.hypot(target.x - cur.x, target.y - cur.y);
  if (dist > TRAVEL_RADIUS) return;
  // Navigate to this star
  mapPath.push(idx);
  mapCurrentIdx = idx;
  saveGameState();
  if (target.isGoal) {
    target.completed = true; target.visited = true;
    teardownMapCanvasEvents();
    showVictory();
    return;
  }
  beginNodePlay(idx);
}

function beginNodePlay(idx) {
  const node = mapNodes[idx];
  if (!node) return;
  // Ambush chance: peaceful-looking stars may be hostile traps
  const peacefulTypes = ['station', 'depot', 'encounter', 'empty'];
  if (peacefulTypes.includes(node.type) && !node.ambushChecked) {
    node.ambushChecked = true;
    if (Math.random() < 0.50) {
      node.originalType = node.type;
      node.type = 'normal';
      node.noEnemies = false;
      node.isStation = false;
      node.waveCount = Math.max(4, Math.min(12, node.waveCount + Math.floor(Math.random() * 3)));
      node.enemyPool = buildEnemyPool('normal', node.tier, node.faction);
    }
  }
  nodeStartScore = score;
  nodeStartPeople = people;
  mapNodeWavesDone = 0;
  mapNodeWaveTotal = node.waveCount;
  mapNodeEnemyPool = node.enemyPool;
  mapNodeBossEncounter = node.isBossNode;
  mapNodeFaction = node.faction;
  teardownMapCanvasEvents();
  if (mapContainer) { app.stage.removeChild(mapContainer); mapContainer.destroy({children:true}); mapContainer = null; mapContent = null; mapActive = false; }
  bgmTrack(1);
  // Restore ALL game containers
  if (starC) starC.visible = true;
  if (mistC) mistC.visible = true;
  if (fgStarC) fgStarC.visible = true;
  if (debrisC) debrisC.visible = true;
  if (stationC) stationC.visible = true;
  if (gameC) gameC.visible = true;
  var uiEl = document.getElementById('ui');
  if (uiEl) uiEl.style.display = '';
  // Fresh load each star level: clean dynamic state and regenerate background
  cleanAll();
  initStars();
  initAtmosphere();
  gameState = 'playing';
  usedContinueThisNode = false;
  invincible = 0; health = maxHealth; shieldLayers = 1 + specialShieldLayers; maxShieldLayers = 3 + specialShieldLayers; hullDamageAccum = 0;
  cannon.x = CANNON_X; cannon.y = CANNON_BASE_Y;
  cannonSprite.tint = 0x44ddff; cannonSprite.alpha = 1;
  cannonGlow.tint = 0x44ddff;
  cannonSprite.visible = true; cannonGlow.visible = true;
  cannonBase.visible = true; shieldGraphic.visible = true;
  shieldGraphic.clear();
  peopleText.visible = true;
  if (shipHull) { shipHull.visible = true; rebuildShipHull(); }
  cannonSprite.position.set(CANNON_X, CANNON_BASE_Y);
  cannonGlow.position.set(CANNON_X, CANNON_BASE_Y);
  cannonBase.position.set(CANNON_X, CANNON_BASE_Y + 10);
  shieldGraphic.position.set(CANNON_X, CANNON_BASE_Y);
  peopleText.position.set(CANNON_X, CANNON_BASE_Y + 24);
  if (shipHull) { shipHull.position.set(CANNON_X, CANNON_BASE_Y); gameC.addChild(shipHull); }
  gameC.addChild(cannonSprite); gameC.addChild(cannonGlow); gameC.addChild(cannonBase);
  gameC.addChild(shieldGraphic); gameC.addChild(peopleText);
  setZoom(zoom);
  pauseBtn.style.display = 'block';
  document.getElementById('ui').classList.add('show');
  wave = 1;
  waveTimer = 0;
  spawnTimer = 0;
  spawnAggression = 1;
  waveEl.innerText = 'WAVE 1 / ' + node.waveCount;
  scoreEl.innerText = Math.floor(score).toLocaleString();
  if (node.noEnemies) { waveEl.innerText = 'GEMS ONLY'; }
  if (node.extraGems > 0) spawnGems(node.extraGems);
  if (node.isStation) { showEncounter(); }
}

function finishNodePlay() {
  const node = mapNodes[mapCurrentIdx];
  if (node) {
    node.visited = true;
    node.completed = true;
    if (!usedContinueThisNode) {
      specialShieldLayers++;
    }
  }
  saveGameState();
  cleanAll();
  if (node && node.isGoal) {
    teardownMapCanvasEvents();
    showVictory();
    return;
  }
  showMapView();
}

function showMapView() {
  // Hide ALL game containers so map is a fully separate view
  if (starC) starC.visible = false;
  if (mistC) mistC.visible = false;
  if (fgStarC) fgStarC.visible = false;
  if (debrisC) debrisC.visible = false;
  if (stationC) stationC.visible = false;
  if (gameC) gameC.visible = false;
  pauseBtn.style.display = 'none';
  // Hide game HUD completely — map is its own screen
  var uiEl = document.getElementById('ui');
  if (uiEl) uiEl.style.display = 'none';
  var eo = document.getElementById('encounterOverlay');
  if (eo) eo.classList.remove('show');
  gameState = 'map';
  renderMap();
}

function returnToMainMenuFromMap() {
  teardownMapCanvasEvents();
  if (mapContainer) { app.stage.removeChild(mapContainer); mapContainer.destroy({children:true}); mapContainer = null; mapContent = null; }
  mapActive = false; mapMode = false;
  showDifficulty();
}

// ==================== END MAP SYSTEM ====================




// Auto skip when animation ends
const crawlText = document.getElementById('crawlText');
if (crawlText) {
  crawlText.addEventListener('animationend', () => {
    document.getElementById('crawlOverlay').classList.remove('show');
    diffOverlay.style.display = '';
    diffOverlay.classList.add('show');
  });
}

['diffEasy','diffNormal','diffHard','diffHardcore'].forEach(id => {
    let picking = false;
    bindBtn(id, e => {
    e.preventDefault();
    if (picking) return;
    picking = true;
    document.querySelectorAll('.btn-diff').forEach(b => b.classList.remove('selected'));
    const btn = document.getElementById(id);
    if (btn) btn.classList.add('selected');
    const diffName = id.replace('diff','').toLowerCase();
    setTimeout(() => { setDifficulty(diffName); }, 150);
  });
});
const lbBtn = document.getElementById('btnLeaderboard');
if (lbBtn) {
  lbBtn.addEventListener('pointerdown', e => {
    e.preventDefault();
    try { showLeaderboard(); }
    catch(e) { console.error(e); const errText = new PIXI.Text(e.stack, {fill:0xff0000, fontSize:12, wordWrap:true, wordWrapWidth:800}); errText.y = 100; app.stage.addChild(errText); location.reload(); }
  });
}

// Lock portrait during gameplay
function checkOrientation() {
  const lock = document.getElementById('orientationLock');
  if (!lock) return;
  if (gameState === 'playing' && !mapActive && window.innerWidth > window.innerHeight) {
    lock.style.display = 'flex';
  } else {
    lock.style.display = 'none';
  }
}
window.addEventListener('resize', checkOrientation);

// --- MAIN LOOP ---
app.ticker.add(() => { try {
  const dt = Math.min(app.ticker.deltaMS / 1000, 0.05);
  frameCount++;
  const now = performance.now();
  LASER_GRID.clear();
  for(let j = lasers.length - 1; j >= 0; j--) {
    const l = lasers[j];
    const cx = Math.floor(l.x / 60), cy = Math.floor(l.y / 60);
    const key = cx + ',' + cy;
    if (LASER_GRID.has(key)) LASER_GRID.get(key).push(l);
    else LASER_GRID.set(key, [l]);
  }


  if (gameState !== 'map') {
    for (const s of stars) {
      s.sprite.y += s.vy * 60 * dt;
      if (s.sprite.y > height + 10) {
        s.sprite.y = -10;
        const gap = Math.random() < 0.15 ? 60 + Math.random() * 120 : 0;
        s.sprite.x = Math.max(0, Math.min(width, s.clusterX + (Math.random() - 0.5) * 50 + (Math.random() < 0.5 ? gap : -gap)));
      }
    }
  }
  updateAtmosphere(dt, now);

  if (gameState === 'gameover') { updateFX(dt); return; }
  if (gameState === 'map') { updateFX(dt); updateMapSparkles(now); return; }
  if (gameState === 'paused' || gameState === 'encounter') {
    for (const s of stars) { s.sprite.y += s.vy * 60 * dt; if (s.sprite.y > height + 10) { s.sprite.y = -10; const gap = Math.random() < 0.15 ? 60 + Math.random() * 120 : 0; s.sprite.x = Math.max(0, Math.min(width, s.clusterX + (Math.random() - 0.5) * 50 + (Math.random() < 0.5 ? gap : -gap))); } }
    updateAtmosphere(dt, now);
    updateFX(dt); return;
  }
  if (gameState !== 'playing') { updateFX(dt); return; }

  checkOrientation();
  // Periodic auto-save every 5s
  _saveTimer += dt;
  if (_saveTimer > 5) { _saveTimer = 0; saveGameState(); }
  
  if (hull <= maxHull * 0.5 && hull > 0) {
      if (!window._bleedTimer) window._bleedTimer = 0;
      window._bleedTimer += dt;
      if (window._bleedTimer >= 5) {
          window._bleedTimer = 0;
          updateUI();
          const ft = new PIXI.Text('HULL LEAK', { fontFamily:'Orbitron', fontSize:14, fill:0xff0000 });
          ft.x = cannonSprite.x - 40; ft.y = cannonSprite.y - 60;
          if(fxC) { fxC.addChild(ft); ft.life = 2.0; ft.vy = -1.0; fxT.push(ft); }
      }
  }
  _gemTimer += dt;
  if (_gemTimer > 6 && gems.length < 20) { _gemTimer = 0; spawnGems(3 + Math.min(Math.floor(wave / 4), 6)); }

  // Cannon slide + aim + Y follow (respects zoom)
  const z = gameC ? gameC.scale.x || 1 : 1;
  const cx = gameC ? gameC.x : 0;
  const cy = gameC ? gameC.y : 0;
  const visibleLeft = -cx / z;
  const visibleRight = (width - cx) / z;
  const visibleTop = -cy / z;
  const visibleBottom = (height - cy) / z;
  CANNON_BASE_Y = visibleBottom - 44 / z;
  const margin = CANNON_MARGIN / z;
  const targetCannonX = Math.max(visibleLeft + margin, Math.min(visibleRight - margin, aimFocusX));
  cannon.x += (targetCannonX - cannon.x) * CANNON_SLIDE_SPEED;
  const targetAngle = AIM_ARC_START + ((aimFocusX - visibleLeft) / (visibleRight - visibleLeft)) * (AIM_ARC_END - AIM_ARC_START);
  let diff = targetAngle - cannon.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  cannon.angle += diff * AIM_SMOOTH;
  // Y follows finger tip, clamped within visible area
  const visibleHeight = visibleBottom - visibleTop;
  const cannonMinY = visibleTop + visibleHeight * 0.7; // cannon stays in bottom 30%
  cannon.y = Math.max(cannonMinY, Math.min(visibleBottom - 44 / z, aimFocusY + touchOffsetY));

  cannonSprite.position.set(cannon.x, cannon.y);
  cannonSprite.rotation = cannon.angle + Math.PI / 2;
  cannonGlow.position.set(cannon.x, cannon.y);
  cannonGlow.rotation = cannon.angle + Math.PI / 2;
  cannonGlow.alpha = 0.06 + (isFiring ? 0.08 : 0);
  cannonBase.position.set(cannon.x, cannon.y + 10);
  if (typeof shipHull !== 'undefined') shipHull.position.set(cannon.x, CANNON_BASE_Y);

  shieldGraphic.position.set(cannon.x, cannon.y);
  shieldGraphic.rotation = 0;
  shieldGraphic.clear();
  const sRatio = maxHealth > 0 ? health / maxHealth : 0;
  const sLayers = Math.max(1, Math.floor(shieldLayers));
  for (let si = 0; si < sLayers; si++) {
    const sRad = 28 + si * 4;
    const sAlpha = 0.1 + (sRatio * 0.2);
    const sColor = sRatio > 0.5 ? 0x44ddff : sRatio > 0.25 ? 0xffaa00 : 0xff4444;
    shieldGraphic.lineStyle(2, sColor, sAlpha);
    shieldGraphic.drawCircle(0, 0, sRad);
    shieldGraphic.lineStyle(4, sColor, sAlpha * 0.3);
    shieldGraphic.drawCircle(0, 0, sRad + 2);
  }
  if (sRatio < 0.5) {
    const flicker = Math.sin(now * 0.01) * 0.3 + 0.7;
    shieldGraphic.lineStyle(1, 0xff4444, flicker * 0.15);
    shieldGraphic.drawCircle(0, 0, 24);
  }

  peopleText.position.set(cannon.x, cannon.y + 24);
  peopleText.text = Math.floor(people).toLocaleString();

  if (invincible > 0) {
    invincible -= dt;
    cannonSprite.alpha = 0.4 + Math.sin(invincible * 20) * 0.3;
    cannonGlow.alpha = 0.3 + Math.sin(invincible * 20) * 0.25;
    cannonGlow.tint = 0xff4444;
  } else {
    cannonSprite.alpha = 1;
    cannonGlow.tint = 0x44ddff;
  }

  // Weapon ammo/timer depletion
  if (specialWeapon) {
    if (WEAPONS[specialWeapon].time && isFiring) {
      weaponTimerMs -= dt * 1000;
      if (weaponTimerMs <= 0) {
        weaponTimerMs = 0;
        const expWeapon = specialWeapon;
        depleteWeaponLevel();
        const ft = new PIXI.Text(WEAPONS[expWeapon].name+' EXPIRED', {
          fontFamily:'sans-serif',fontSize:14,fontWeight:'900',fill:0xff4444,
          dropShadow:true,dropShadowColor:0xff0000,dropShadowBlur:6
        });
        ft.anchor.set(0.5); ft.position.set(width/2, height*0.35); ft.life=1.5; ft.vy=-0.5;
        fxC.addChild(ft); fxT.push(ft);
      }
    }
    updateWeaponAmmoDisplay();
  }


  // Continuous Raycast Weapons
  // Saber: full-screen continuous sweep, destroys everything in its path
  if (isFiring && gameState === 'playing' && activeWeapon === 'saber') {
      const sv = weaponLevels.saber || 0;
      const sx = cannon.x;
      const sy = cannon.y - 10;
      const ang = cannon.rotation;
      const len = Math.max(width, height) * 1.5;
      const ex = sx + Math.cos(ang) * len;
      const ey = sy + Math.sin(ang) * len;
      const dmg = (400 + sv * 150) * dt;
      
      const targets = [].concat(enemies, boss ? [boss] : [], miniBosses || [], bossMinis || []);
      for (const e of targets) {
          if (e.y < 0 || e.dead || e.deadZone) continue;
          const dx = e.x - sx, dy = e.y - sy;
          const px = ex - sx, py = ey - sy;
          const lenSq = px*px + py*py;
          if (lenSq < 1) continue;
          let t = Math.max(0, Math.min(1, (dx*px + dy*py) / lenSq));
          const projX = sx + t * px, projY = sy + t * py;
          const distSq = (e.x - projX)**2 + (e.y - projY)**2;
          
          if (distSq < (e.size + 20)**2) {
              e.hp -= dmg;
              if (Math.random() < 0.3) spawnExplosion(e.x, e.y, 0x00ff44, 2);
          }
      }
  }

  // Firing
  const lvlNow = specialWeapon ? (weaponLevels[specialWeapon] || 0) : 0;
  const lvlFireMul = Math.max(0.5, 1 - lvlNow * 0.04);
  const baseFireRate = specialWeapon === 'rapid' ? 0.015 : specialWeapon === 'beam' ? 0.020 : 0.015;
  const fireRate = baseFireRate * lvlFireMul;
  if (isFiring && gameState === 'playing') {
    fireTimer += dt;
    if (fireTimer >= fireRate) {
      fireTimer = 0;
      spawnLaser(); playWeaponSnd(specialWeapon);
      if (specialWeapon === 'rapid' && fireRate < 0.03) playWeaponSnd(specialWeapon);
      // Ammo-based weapons: consume per-laser-instance for multi-projectile weapons
      if (specialWeapon && !WEAPONS[specialWeapon].time) {
        let ammoCost = 1;
        if (specialWeapon === 'spread') ammoCost = 2;
        else if (specialWeapon === 'rapid') ammoCost = 3;
        else if (specialWeapon === 'swarm') ammoCost = 2;
        else if (specialWeapon === 'prism') ammoCost = 3;
        else if (specialWeapon === 'vortex') ammoCost = 4;
        else if (specialWeapon === 'pulsecannon') ammoCost = 2;
        else if (specialWeapon === 'vortexcannon') ammoCost = 2;
        else if (specialWeapon === 'ufo') ammoCost = 5;
        weaponAmmo -= ammoCost;
        updateWeaponAmmoDisplay();
        if (weaponAmmo <= 0) {
          weaponAmmo = 0;
          const expWeapon = specialWeapon;
          depleteWeaponLevel();
          const ft = new PIXI.Text(WEAPONS[expWeapon].name+' EXPIRED', {
            fontFamily:'sans-serif',fontSize:14,fontWeight:'900',fill:0xff4444,
            dropShadow:true,dropShadowColor:0xff0000,dropShadowBlur:6
          });
          ft.anchor.set(0.5); ft.position.set(width/2, height*0.35); ft.life=1.5; ft.vy=-0.5;
          fxC.addChild(ft); fxT.push(ft);
        }
      }
    }
  }

  // Wave progression (time-based per difficulty)
  waveTimer += dt;
  const waveDuration = mapMode ? 20 : difficulty === 'easy' ? 27 : difficulty === 'normal' ? 40 : difficulty === 'hard' ? 72 : 108;
  if (waveTimer >= waveDuration) {
    if (mapMode && mapNodeWaveTotal > 0) {
      mapNodeWavesDone++;
      if (mapNodeWavesDone >= mapNodeWaveTotal) {
        finishNodePlay();
        return;
      }
      wave++;
      waveTimer = 0;
      waveEl.innerText = 'WAVE ' + (wave) + ' / ' + mapNodeWaveTotal;
      if (mapNodeBossEncounter && wave % 3 === 0) { spawnBoss(); }
      { const g = screenToGame(30 + Math.random() * (width - 60), height * 0.2); spawnPowerup(g.x, g.y); }
      spawnGems(2 + Math.min(Math.floor(wave / 3), 5));
      return;
    }
    if (wave >= 200) {
       showVictory();
       return;
    } else {
       wave++;
    }
    waveTimer = 0;
    isSwarmWave = false;
    isSnakeWave = false;
    
    // Random encounter: 10% chance after every wave
    if (Math.random() < 0.1 && wave % 9 !== 0) {
      showEncounter();
    // Encounter Logic (Every 9th Wave)
    } else if (wave % 9 === 0) {
      showEncounter();
    // Boss Logic (Every 4th Wave)
    } else if (wave % 4 === 0) {
      waveEl.innerText = 'WAVE ' + wave + ' - BOSS';
      bossEncounter++;
      spawnBoss();
    // Swarm Logic (Every 6th Wave)
    } else if (wave % 6 === 0) {
      waveEl.innerText = 'SWARM INCOMING';
      isSwarmWave = true;
      const ft = new PIXI.Text('SWARM DETECTED', { fontFamily: 'sans-serif', fontSize: 32, fontWeight: '900', fill: 0xff0044 });
      ft.anchor.set(0.5); ft.position.set(width/2, height*0.3); ft.life = 2.5; ft.vy = -0.3; fxC.addChild(ft); fxT.push(ft);
    // Snake Nest Logic (Every 5th Wave)
    } else if (wave % 5 === 0) {
      waveEl.innerText = 'SNAKE NEST';
      isSnakeWave = true;
    // Super Wave Logic
    } else if (wave % 6 === 3) {
      waveEl.innerText = 'SUPER WAVE ' + wave;

      const ft = new PIXI.Text('SUPER WAVE ' + wave, {
        fontFamily: 'sans-serif', fontSize: 32, fontWeight: '900',
        fill: 0xff8800, dropShadow: true, dropShadowColor: 0xffff00, dropShadowBlur: 12
      });
      ft.anchor.set(0.5); ft.position.set(width/2, height * 0.35); ft.life = 2; ft.vy = -0.5;
      fxC.addChild(ft); fxT.push(ft);
      playEmpowerSnd();
      // Free powerup on wave start + extra gems
      { const g = screenToGame(30 + Math.random() * (width - 60), height * 0.2); spawnPowerup(g.x, g.y); }
      spawnGems(3 + Math.min(Math.floor(wave / 3), 6));
    } else {
      waveEl.innerText = 'Wave ' + wave;
      const ft = new PIXI.Text('WAVE ' + wave, {
        fontFamily: 'sans-serif', fontSize: 24, fontWeight: '900',
        fill: 0x4488ff, dropShadow: true, dropShadowColor: 0x0044ff, dropShadowBlur: 10
      });
      ft.anchor.set(0.5); ft.position.set(width/2, height * 0.35); ft.life = 1.8; ft.vy = -0.5;
      fxC.addChild(ft); fxT.push(ft);
      // Free powerup on wave start + respawn gems
      { const g = screenToGame(30 + Math.random() * (width - 60), height * 0.2); spawnPowerup(g.x, g.y); }
      spawnGems(2 + Math.min(Math.floor(wave / 3), 5));
    }
  }

  // Spawn enemies (no regular spawns during boss fight)
  const d = DIFF[difficulty];
  if (enemies.length <= 5) { spawnAggression = Math.min(spawnAggression * (1 + 0.6 * dt), 4); }
  else if (enemies.length > 15) { spawnAggression = Math.max(1, spawnAggression * (1 - 0.3 * dt)); }
  if (!boss) {
    spawnTimer += dt;
    const isSuper = wave % 5 === 3;
    const superMul = isSuper ? (difficulty === 'hard' ? 0.6 : difficulty === 'hardcore' ? 0.4 : 0.8) : 1;
    let mapSpawnBoost = 1;
    if (mapMode && mapNodes.length > 0) {
      const node = mapNodes[mapCurrentIdx];
      const nodeTier = node ? node.tier : 0;
      mapSpawnBoost = 1 + nodeTier * 0.15;
    }
    const baseRate = Math.max(0.15, 0.8 - wave * 0.012) / (d.spawnMul * spawnAggression * mapSpawnBoost) * (zoom || 1) / superMul;
    if (spawnTimer >= baseRate) {
      spawnTimer = 0;
      spawnEnemy();
      if (Math.random() < (0.2 + wave * 0.015) * d.spawnMul * spawnAggression) spawnEnemy();
      if (Math.random() < (0.05 + wave * 0.008) * d.spawnMul * spawnAggression) spawnEnemy();
    }
  }

  // Swarm events (disabled during boss)
  if (!boss) {
    swarmTimer -= dt;
    if (swarmTimer <= 0) {
      let swarmBoost = 1;
    if (mapMode && mapNodes.length > 0) {
      const node = mapNodes[mapCurrentIdx];
      const nodeTier = node ? node.tier : 0;
      swarmBoost = 1 + nodeTier * 0.12;
    }
    swarmTimer = Math.max(8, (15 - wave * 0.3) / swarmBoost) + Math.random() * 8;
      spawnSwarm();
    }
    if (difficulty === 'hardcore') {
      if (!hardcoreBlockTimer) hardcoreBlockTimer = Math.random() * 5 + 3;
      hardcoreBlockTimer -= dt;
      if (hardcoreBlockTimer <= 0) {
        let hcBoost = 1;
        if (mapMode && mapNodes.length > 0) {
          const node = mapNodes[mapCurrentIdx];
          const nodeTier = node ? node.tier : 0;
          hcBoost = 1 + nodeTier * 0.1;
        }
        hardcoreBlockTimer = Math.max(2, (5 - wave * 0.08) / hcBoost) + Math.random() * 2;
        spawnHardcoreBlock();
      }
    }
  }

  // Update gems (reveal animation)
  for (let i = gems.length - 1; i >= 0; i--) {
    const g = gems[i];
    if (!g || !g.sprite || !g.sprite.transform || !g.glow || !g.glow.transform) { gems[i] = gems[gems.length - 1]; gems.pop(); continue; }
    if (g.reveal < 1) {
      g.reveal = Math.min(1, g.reveal + dt * 3);
      const s = g.reveal * g.reveal * (3 - 2 * g.reveal);
      g.sprite.scale.set(s * 8 / 4);
      g.sprite.alpha = 0.7 + s * 0.3;
      g.glow.scale.set(s * 16 / 8);
      g.glow.alpha = s * 0.5;
    } else {
      const pulse = Math.sin(now * 0.004 + g.phase) * 0.5 + 0.5;
      g.sprite.scale.set(1.6 + pulse * 0.6);
      g.sprite.alpha = 0.8 + pulse * 0.2;
      g.glow.scale.set(1.6 + pulse * 1.2);
      g.glow.alpha = 0.3 + pulse * 0.4;
    }
    if (g.vy) {
      g.y += g.vy * dt;
      g.sprite.y = g.y;
      g.glow.y = g.y;
    }
  }

  // Update lasers + homing tracking
  for (let i = lasers.length - 1; i >= 0; i--) {
    const l = lasers[i];
    if (l.dead) {
      l.sprite.visible = false; laserPool.push(l.sprite); laserC.removeChild(l.sprite);
      if (l.ufoAccent) { fxC.removeChild(l.ufoAccent); l.ufoAccent.destroy(); l.ufoAccent = null; }
      if (l.ufoCore) { fxC.removeChild(l.ufoCore); l.ufoCore.destroy(); l.ufoCore = null; }
      if (l.ufoRing) { fxC.removeChild(l.ufoRing); l.ufoRing.destroy(); l.ufoRing = null; }
      if (l.ufoGlow) { glowC.removeChild(l.ufoGlow); l.ufoGlow.destroy(); l.ufoGlow = null; }
      lasers[i] = lasers[lasers.length - 1]; lasers.pop(); continue;
    }
    if (l.homing) homingUpdate(l);
    const dist = Math.sqrt(l.vx * l.vx + l.vy * l.vy) * dt;
    l.distTraveled += dist;
    l.x += l.vx * dt; l.y += l.vy * dt;
    l.life -= dt;
    if (l.life <= 0 || l.dead) {
      if (l.gravGfx) { fxC.removeChild(l.gravGfx); l.gravGfx.destroy(); l.gravGfx = null; }
      if (l.orbitals) { for (const orb of l.orbitals) { fxC.removeChild(orb.sprite); spritePool.push(orb.sprite); } l.orbitals = null; }
      if (l.ufoBody) { fxC.removeChild(l.ufoBody); l.ufoBody.destroy(); l.ufoBody = null; }
      if (l.ufoRing) { fxC.removeChild(l.ufoRing); l.ufoRing.destroy(); l.ufoRing = null; }
      if (l.ufoGlow) { glowC.removeChild(l.ufoGlow); l.ufoGlow.destroy(); l.ufoGlow = null; }
      if (l._oblivionGfx) { fxC.removeChild(l._oblivionGfx); l._oblivionGfx.destroy(); l._oblivionGfx = null; }
      if (l.sprite.parent) laserC.removeChild(l.sprite);
      l.sprite.visible = false; laserPool.push(l.sprite);
      { lasers[i] = lasers[lasers.length - 1]; lasers.pop(); }
      continue;
    }
    l.sprite.position.set(l.x, l.y);
    if (l.mine) {
      l.sprite.rotation += dt * 4;
      if (l.orbitals) {
        for (const orb of l.orbitals) {
          orb.angle += orb.speed * dt;
          orb.sprite.x = l.x + Math.cos(orb.angle) * orb.radius;
          orb.sprite.y = l.y + Math.sin(orb.angle) * orb.radius;
          orb.sprite.rotation += dt * 3;
          orb.sprite.alpha = Math.min(1, l.life * 1.8) * 0.8;
        }
      }
      l.trailTimer -= dt;
      if (l.trailTimer <= 0) {
        l.trailTimer = 0.04;
        const tp = allocParticle();
        tp.texture = particleShapes[Math.random() < 0.5 ? 0 : 2];
        tp.x = l.x + (Math.random() - 0.5) * 3; tp.y = l.y + (Math.random() - 0.5) * 3;
        tp.tint = l.sprite.tint; tp.scale.set(0.06 + Math.random() * 0.08);
        tp.life = 0.25 + Math.random() * 0.15; tp.vx = (Math.random() - 0.5) * 0.4; tp.vy = (Math.random() - 0.5) * 0.4;
        tp.blendMode = PIXI.BLEND_MODES.ADD; tp.baseAlpha = 0.5; tp.complexShape = false;
        tp.maxLife = tp.life; fxP.push(tp);
      }
    }
    if (l.gravity) {
      if (!l.gravGfx) { l.gravGfx = new PIXI.Graphics(); fxC.addChild(l.gravGfx); }
      l.gravGfx.clear();
      const gravR = 120 + (l.gravLvl || 0) * 10;
      l.gravGfx.lineStyle(1, 0xff4400, 0.12); l.gravGfx.drawCircle(l.x, l.y, gravR);
      l.gravGfx.lineStyle(2, 0xff6600, 0.06); l.gravGfx.drawCircle(l.x, l.y, gravR * 0.6);
      l.gravGfx.lineStyle(3, 0xffaa00, 0.04); l.gravGfx.drawCircle(l.x, l.y, gravR * 0.3);
    }
    // Player lasers can destroy enemy bullets
    for (let bi = enemyBullets.length - 1; bi >= 0; bi--) {
      const eb = enemyBullets[bi];
      const bdx = l.x - eb.x, bdy = l.y - eb.y;
      if (bdx * bdx + bdy * bdy < 20 * 20) {
        spawnExplosion(eb.x, eb.y, 0x88ffff, 4);
        if (eb.glow) { eb.glow.visible = false; eBulletGlowPool.push(eb.glow); glowC.removeChild(eb.glow); }
        eb.sprite.visible = false; enemyBulletPool.push(eb.sprite); enemyBulletC.removeChild(eb.sprite);
        { enemyBullets[bi] = enemyBullets[enemyBullets.length - 1]; enemyBullets.pop(); }
        if (l.ion) {
            spawnExplosion(eb.x, eb.y, 0x00aaff, 20);
            for (const oe of enemies) {
                if (Math.hypot(oe.x - eb.x, oe.y - eb.y) < 150) {
                    oe.hp -= 20;
                    oe.slowTimer = 3;
                }
            }
        }
        if (!l.pierce) {
          l.sprite.visible = false; laserPool.push(l.sprite); laserC.removeChild(l.sprite);
          { lasers[i] = lasers[lasers.length - 1]; lasers.pop(); }
        }
        break;
      }
    }
    const distRatio = l.distTraveled / l.maxDist;
    if (distRatio > 0.75) {
      l.sprite.alpha = Math.min(1, l.life * 2) * (1 - (distRatio - 0.75) * 4);
    } else {
      l.sprite.alpha = Math.min(1, l.life * 2);
    }
    const z = gameC ? gameC.scale.x || 1 : 1;
    const cx = gameC ? gameC.x : 0;
    const cy = gameC ? gameC.y : 0;
    const lDropLeft = -cx / z;
    const lDropRight = (width - cx) / z;
    const lDropTop = -cy / z;
    const lDropBottom = (height - cy) / z;
    if (l.bounce > 0 && (l.x < lDropLeft - 10 || l.x > lDropRight + 10 || l.y < lDropTop - 10 || l.y > lDropBottom + 10)) {
      const bounceCol = [0xff8844, 0xffaa44, 0xffcc66, 0x44ff88][l.bounce % 4];
      if (l.x < lDropLeft - 10) { l.x = lDropLeft - 10; l.vx = -l.vx; l.bounce--; spawnExplosion(l.x, l.y, bounceCol, 8 + Math.floor(Math.random() * 4)); }
      if (l.x > lDropRight + 10) { l.x = lDropRight + 10; l.vx = -l.vx; l.bounce--; spawnExplosion(l.x, l.y, bounceCol, 8 + Math.floor(Math.random() * 4)); }
      if (l.y < lDropTop - 10) { l.y = lDropTop - 10; l.vy = -l.vy; l.bounce--; spawnExplosion(l.x, l.y, bounceCol, 8 + Math.floor(Math.random() * 4)); }
      if (l.y > lDropBottom + 10) { l.y = lDropBottom + 10; l.vy = -l.vy; l.bounce--; spawnExplosion(l.x, l.y, bounceCol, 8 + Math.floor(Math.random() * 4)); }
      l.sprite.tint = bounceCol;
      if (l.orbitals) { for (const orb of l.orbitals) { orb.sprite.tint = bounceCol; } }
      l.sprite.rotation += Math.PI * 0.25;
    }
    // Range cap at top 10% of visible screen — effectiveness drops to 10% at the limit
    const topLimit = lDropTop + (lDropBottom - lDropTop) * 0.1;
    l.rangeMul = 1;
    if (l.y < topLimit) {
      const pct = (l.y - lDropTop) / (topLimit - lDropTop);
      l.rangeMul = 0.1 + 0.9 * Math.max(0, Math.min(1, pct));
      if (l.y < lDropTop) { l.life = 0; } // below screen edge, kill
    }
    // Fusion weapon behaviors
    if (l.inferno) {
      l.sprite.tint = [0xff2200, 0xff6600, 0xffaa00, 0xff4400][Math.floor(Math.random() * 4)];
      const _szi = 1 / (1 + (l.infernoLvl || 0) * 0.08); l.sprite.scale.set((3.5 + Math.sin(now * 0.02)) * _szi);
      l.plasmaTimer = (l.plasmaTimer || 0) + dt;
      if (l.plasmaTimer > 0.15) {
        l.plasmaTimer = 0;
        const pz = { x: l.x + (Math.random() - 0.5) * 10, y: l.y + (Math.random() - 0.5) * 10, lvl: l.infernoLvl || 0, life: 2, radius: 20, dmgTimer: 0 };
        const pg = new PIXI.Graphics();
        pg.beginFill(0xff2200, 0.08); pg.drawCircle(0, 0, pz.radius); pg.endFill();
        pg.beginFill(0xff6600, 0.06); pg.drawCircle(0, 0, pz.radius * 0.6); pg.endFill();
        pg.position.set(pz.x, pz.y); pg.blendMode = PIXI.BLEND_MODES.NORMAL;
        fxC.addChild(pg); pz.gfx = pg;
        zones.push(pz);
      }
    }
    if (l.railgun) {
      l.sprite.tint = [0x44aaff, 0x88ccff, 0xffffff][Math.floor(Math.random() * 3)];
      const _szr = 1 / (1 + (l.railgunLvl || 0) * 0.08); l.sprite.scale.set((1.5 + Math.sin(now * 0.05) * 0.5) * _szr);
    }
    if (l.starburst) {
      const pulse = Math.sin(now * 0.01) * 0.3 + 0.7;
      const _szsb = 1 / (1 + (l.starburstLvl || 0) * 0.08); l.sprite.scale.set((2 + pulse * 0.75) * _szsb);
      l.sprite.tint = 0xffaa00;
    }
    if (l.vortexstorm) {
      l.sprite.rotation += dt * 8;
      const pulse = Math.sin(now * 0.015) * 0.5 + 0.5;
      const _szvs = 1 / (1 + (l.vortexstormLvl || 0) * 0.08); l.sprite.scale.set((1.25 + pulse * 0.5) * _szvs);
      l.sprite.tint = 0x44ddff;
    }
    if (l.phantomflare) {
      l.sprite.alpha = 0.4 + Math.sin(now * 0.02) * 0.3;
      l.sprite.tint = [0x8844ff, 0xaa66ff, 0xcc88ff][Math.floor(Math.random() * 3)];
    }
    if (l.oblivion) {
      const _szob = 1 / (1 + (l.oblivionLvl || 0) * 0.08); l.sprite.scale.set((4.5 + Math.sin(now * 0.03) * 1.5) * _szob);
      l.sprite.tint = [0x440066, 0x660088, 0x8800aa][Math.floor(Math.random() * 3)];
      l.oblivionTimer = (l.oblivionTimer || 0) + dt;
      const pullR = (l.pullRadius || 80) * (0.3 + Math.sin(l.oblivionTimer * 3) * 0.2);
      const pullS = (l.pullStrength || 60) * dt;
      for (const pe of enemies) {
        const dx = l.x - pe.x, dy = l.y - pe.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < pullR && dist > 1 && pe.y > 0) {
          pe.x += (dx / dist) * pullS * (1 - dist / pullR);
          pe.y += (dy / dist) * pullS * (1 - dist / pullR);
        }
      }
      if (!l._oblivionGfx) {
        l._oblivionGfx = new PIXI.Graphics(); fxC.addChild(l._oblivionGfx);
      }
      l._oblivionGfx.clear();
      const phase = Math.sin(now * 0.005) * 0.5 + 0.5;
      l._oblivionGfx.lineStyle(1, 0x8800aa, 0.08 + phase * 0.08); l._oblivionGfx.drawCircle(l.x, l.y, pullR);
      l._oblivionGfx.lineStyle(2, 0xaa44ff, 0.04 + phase * 0.06); l._oblivionGfx.drawCircle(l.x, l.y, pullR * 0.5);
    }
    if (l.ufo) {
      if (!l.ufoGlow) {
        l.ufoGlow = new PIXI.Sprite(tex4); l.ufoGlow.anchor.set(0.5); l.ufoGlow.tint = 0xff0044; l.ufoGlow.blendMode = PIXI.BLEND_MODES.ADD; glowC.addChild(l.ufoGlow);
      }
      l.ufoGlow.position.set(l.x, l.y);
      const pulse = Math.sin(now * 0.008 + l.phase) * 0.5 + 0.5;
      const _szuf = 1 / (1 + (l.ufoLvl || 0) * 0.08);
      const miniScale = (3.5 + pulse * 1.5) * _szuf;
      l.ufoGlow.scale.set((1.5 + pulse * 2) * _szuf);
      l.ufoGlow.alpha = 0.3 + pulse * 0.4;
      l.sprite.scale.set(miniScale);
      l.sprite.tint = [0xff0044, 0xff2244, 0xff4466][Math.floor(l.ufoTick || 0) % 3];
      l.sprite.rotation += dt * 2;
      if (l.ufoAccent) { l.ufoAccent.position.set(l.x, l.y); l.ufoAccent.scale.set(miniScale * 0.7); l.ufoAccent.rotation = -l.sprite.rotation; l.ufoAccent.alpha = 0.6 + pulse * 0.3; }
      if (l.ufoCore) { l.ufoCore.position.set(l.x, l.y); l.ufoCore.scale.set(miniScale * 0.35); l.ufoCore.alpha = 0.5 + pulse * 0.4; }
      if (l.ufoRing) { l.ufoRing.position.set(l.x, l.y); l.ufoRing.scale.set(miniScale * 1.4); l.ufoRing.rotation += dt * 3; l.ufoRing.alpha = 0.3 + pulse * 0.2; }
      let closest = null, closeDist = 999999;
      for (const ue of enemies) {
        if (ue.y < 0 || ue.dead) continue;
        const d = Math.hypot(ue.x - l.x, ue.y - l.y);
        if (d < closeDist) { closeDist = d; closest = ue; }
      }
      if (closest && closeDist < 300) {
        const ang = Math.atan2(closest.y - l.y, closest.x - l.x);
        const turnSpeed = 4 + (l.ufoLvl || 0) * 0.5;
        const vAng = Math.atan2(l.vy, l.vx);
        let diff = ang - vAng;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        const newVAng = vAng + Math.sign(diff) * Math.min(Math.abs(diff), turnSpeed * dt);
        const spd = Math.sqrt(l.vx * l.vx + l.vy * l.vy);
        l.vx = Math.cos(newVAng) * spd;
        l.vy = Math.sin(newVAng) * spd;
      }
      l.ufoTick = (l.ufoTick || 0) + 1;
    }
    if (l.life <= 0 || l.x < lDropLeft - 20 || l.x > lDropRight + 20 || l.y < lDropTop - 20 || l.y > lDropBottom + 20 || distRatio >= 1) {
      if (l.gravGfx) { fxC.removeChild(l.gravGfx); l.gravGfx.destroy(); l.gravGfx = null; }
      if (l.orbitals) { for (const orb of l.orbitals) { fxC.removeChild(orb.sprite); spritePool.push(orb.sprite); } l.orbitals = null; }
      if (l.void) {
        const lvl = l.voidLvl || 0;
        const voidTop = lDropTop + (lDropBottom - lDropTop) * 0.1;
        const z = { x: Math.max(lDropLeft, Math.min(lDropRight, l.x)), y: Math.max(voidTop, Math.min(lDropBottom, l.y)), lvl, life: 3 + lvl * 0.5, radius: 40 + lvl * 6, dmgTimer: 0 };
        const g = new PIXI.Graphics();
        g.beginFill(0x440088, 0.03); g.drawCircle(0, 0, z.radius * 1.2); g.endFill();
        g.beginFill(0x6600aa, 0.06); g.drawCircle(0, 0, z.radius * 0.8); g.endFill();
        g.beginFill(0x8844cc, 0.08); g.drawCircle(0, 0, z.radius * 0.55); g.endFill();
        g.beginFill(0x06000a, 0.3); g.drawCircle(0, 0, z.radius * 0.22); g.endFill();
        g.position.set(z.x, z.y); g.blendMode = PIXI.BLEND_MODES.ADD;
        fxC.addChild(g); z.gfx = g;
        zones.push(z);
      }
      if (l.time) {
        const slowR = 120 + l.timeLvl * 15;
        enemies.forEach(e => { const d = Math.hypot(e.x - l.x, e.y - l.y); if (d < slowR && e.y > 0) { e.slowTimer = Math.max(e.slowTimer || 0, 1.5 + l.timeLvl * 0.3); } });
        spawnExplosion(l.x, l.y, 0x44ddff, 25);
      }
      if (l.oblivion) {
        const lvl = l.oblivionLvl || 0;
        const blastR = 100 + lvl * 15;
        spawnExplosion(l.x, l.y, 0x440066, 50);
        spawnExplosion(l.x, l.y, 0x8800aa, 35);
        spawnExplosion(l.x, l.y, 0xcc44ff, 20);
        for (const oe of enemies) {
          const d = Math.hypot(oe.x - l.x, oe.y - l.y);
          if (d < blastR && oe.y > 0) {
            const dmg = Math.round((15 + lvl * 5) * (1 - d / blastR));
            oe.hp -= dmg;
            if (oe.hp <= 0 && !oe.dead) { oe.dead = true; killQueue.push({ e: oe, x: oe.x, y: oe.y, tier: oe.tier }); }
          }
        }
        if (l._oblivionGfx) { fxC.removeChild(l._oblivionGfx); l._oblivionGfx.destroy(); l._oblivionGfx = null; }
      }
      if (l.inferno) {
        spawnExplosion(l.x, l.y, 0xff2200, 25);
        for (let pi = 0; pi < 3 + (l.infernoLvl || 0); pi++) {
          const pz = { x: l.x + (Math.random() - 0.5) * 40, y: l.y + (Math.random() - 0.5) * 40, lvl: l.infernoLvl || 0, life: 3, radius: 25, dmgTimer: 0 };
          const pg = new PIXI.Graphics();
          pg.beginFill(0xff2200, 0.10); pg.drawCircle(0, 0, pz.radius); pg.endFill();
          pg.beginFill(0xff6600, 0.06); pg.drawCircle(0, 0, pz.radius * 0.6); pg.endFill();
          pg.position.set(pz.x, pz.y); pg.blendMode = PIXI.BLEND_MODES.NORMAL;
          fxC.addChild(pg); pz.gfx = pg;
          zones.push(pz);
        }
      }
      if (l.ufoAccent) { fxC.removeChild(l.ufoAccent); l.ufoAccent.destroy(); l.ufoAccent = null; }
      if (l.ufoCore) { fxC.removeChild(l.ufoCore); l.ufoCore.destroy(); l.ufoCore = null; }
      if (l.ufoRing) { fxC.removeChild(l.ufoRing); l.ufoRing.destroy(); l.ufoRing = null; }
      if (l.ufoGlow) { glowC.removeChild(l.ufoGlow); l.ufoGlow.destroy(); l.ufoGlow = null; }
      l.sprite.visible = false; laserPool.push(l.sprite); laserC.removeChild(l.sprite);
      { lasers[i] = lasers[lasers.length - 1]; lasers.pop(); }
    }
  }
  // Draw beam/saber visuals (one Graphics object, reused each frame)
  let hasBeam = false;
  for (const l of lasers) {
    if (l.beam || l.saber) {
      hasBeam = true;
      if (!beamGraphic) { beamGraphic = new PIXI.Graphics(); fxC.addChild(beamGraphic); }
      beamGraphic.clear();
      const isBeam = l.beam;
      const displayLvl = isBeam ? (l.beamLvl || 0) : (l.saberLvl || 0);
      const baseColor = isBeam ? 0x00ffff : [0x00ff44, 0x0088ff, 0xff2200, 0xaa00ff, 0xffaa00, 0xff00ff, 0x00ffff, 0xffffff][Math.min(displayLvl, 7)];
      const coreColor = isBeam ? 0x00ffff : 0xffffff;
      const glowWid = isBeam ? 6 + displayLvl * 1.2 : 4 + displayLvl * 0.5;
      beamGraphic.lineStyle(glowWid * 0.4, coreColor, 1.0); beamGraphic.moveTo(cannon.x, cannon.y); beamGraphic.lineTo(l.x, l.y);
      beamGraphic.lineStyle(glowWid, baseColor, 0.55); beamGraphic.moveTo(cannon.x, cannon.y); beamGraphic.lineTo(l.x, l.y);
      beamGraphic.lineStyle(glowWid * 3, baseColor, 0.15); beamGraphic.moveTo(cannon.x, cannon.y); beamGraphic.lineTo(l.x, l.y);
      beamGraphic.lineStyle(glowWid * 6, baseColor, 0.04); beamGraphic.moveTo(cannon.x, cannon.y); beamGraphic.lineTo(l.x, l.y);
      const spkCount = 3 + displayLvl;
      for (let si = 0; si < spkCount; si++) {
        const st = Math.random();
        const sx = cannon.x + (l.x - cannon.x) * st;
        const sy = cannon.y + (l.y - cannon.y) * st;
        const sp = allocParticle();
        sp.texture = particleShapes[Math.floor(Math.random() * 4)];
        sp.x = sx + (Math.random() - 0.5) * (isBeam ? 12 : 10); sp.y = sy + (Math.random() - 0.5) * (isBeam ? 12 : 10);
        sp.tint = isBeam ? 0xffffff : baseColor; sp.scale.set(isBeam ? 0.04 + Math.random() * 0.05 : 0.05 + Math.random() * 0.08);
        sp.life = 0.08 + Math.random() * 0.08; sp.vx = (Math.random() - 0.5) * 0.6; sp.vy = (Math.random() - 0.5) * 0.6;
        sp.blendMode = PIXI.BLEND_MODES.NORMAL; sp.baseAlpha = 0.4 + Math.random() * 0.3; sp.complexShape = false;
        sp.maxLife = sp.life; fxP.push(sp);
      }
      break;
    }
  }
  // Draw laser visuals (pew-pew line from cannon to projectile)
  if (!hasBeam) {
    for (const l of lasers) {
      if (l.laser) {
        if (!beamGraphic) { beamGraphic = new PIXI.Graphics(); fxC.addChild(beamGraphic); }
        beamGraphic.clear();
        const lasLvl = l.laserLvl || 0;
        const lasWid = 3 + lasLvl * 0.4;
        beamGraphic.lineStyle(lasWid, 0xff6666, 0.7); beamGraphic.moveTo(cannon.x, cannon.y); beamGraphic.lineTo(l.x, l.y);
        beamGraphic.lineStyle(lasWid * 3, 0xff2222, 0.25); beamGraphic.moveTo(cannon.x, cannon.y); beamGraphic.lineTo(l.x, l.y);
        break;
      }
    }
  }
  // Clear beamGraphic when no beam active (don't destroy - reuse to avoid GC thrash)
  if (!hasBeam && beamGraphic) beamGraphic.clear();

  // Arc projectiles (BEAM weapon)
  const apz = gameC ? gameC.scale.x || 1 : 1;
  const apCx = gameC ? gameC.x : 0;
  const apCy = gameC ? gameC.y : 0;
  const apB = (height - apCy) / apz;
  for (let i = arcProjectiles.length - 1; i >= 0; i--) {
    const p = arcProjectiles[i];
    p.vy += p.gravity * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    p.sprite.position.set(p.x, p.y);
    p.sprite.alpha = Math.max(0, p.life / 2.5);
    if (!p.exploded) {
      for (let j = enemies.length - 1; j >= 0; j--) {
        const e = enemies[j];
        const dx = e.x - p.x, dy = e.y - p.y;
        if (dx * dx + dy * dy < (e.size * 0.5 + 12) * (e.size * 0.5 + 12)) {
          explodeArc(p, i);
          break;
        }
      }
      if (!p.exploded && p.y > apB - 50) {
        explodeArc(p, i);
      }
    }
    if (p.life <= 0) {
      fxC.removeChild(p.sprite);
      arcPool.push(p.sprite);
      { arcProjectiles[i] = arcProjectiles[arcProjectiles.length - 1]; arcProjectiles.pop(); }
    }
  }

  function explodeArc(p, idx) {
    if (p.exploded) return;
    p.exploded = true;
    spawnExplosion(p.x, p.y, 0x00ffff, 10);
    for (let j = enemies.length - 1; j >= 0; j--) {
      const e = enemies[j];
      const dx = e.x - p.x, dy = e.y - p.y;
      if (dx * dx + dy * dy < 60 * 60) {
        e.hp -= 2;
        if (e.hp <= 0 && !e.dead) { e.dead = true;
          const _t = TIERS[e.tier];
          if (_t) {
            const pts = _t.pt;
            score += pts;
            playPopSnd(e.tier);
            spawnExplosion(e.x, e.y, _t.cl[0], 8);
            spawnPowerup(e.x, e.y);
            if (Math.random() < ((DIFF[difficulty].dropChance || 0.4) * 0.08)) spawnSpecialPowerup(e.x, e.y);
            updateUI();
          }
          killQueue.push({ e, x: e.x, y: e.y, tier: e.tier });
        }
      }
    }
  }

  // Swarm small cleanup: any remaining single-spawn stragglers
  if (swarmStateRemaining > 0) {
    swarmSpawnTimer += dt;
    if (swarmSpawnTimer > 0.6) {
      swarmSpawnTimer = 0;
      swarmStateRemaining--;
      const z = zoom || 1;
      const cx = gameC ? gameC.x : 0;
      const cy = gameC ? gameC.y : 0;
      const visTop = -cy / z;
      const visibleLeft = -cx / z;
      const visibleRight = (width - cx) / z;
      const ox = visibleLeft + Math.random() * (visibleRight - visibleLeft);
      const oy = visTop - 20 - Math.random() * 60;
      const e = spawnEnemy(ox, oy, 0);
      if (e) {
        e.size *= 0.6;
        e.hp = (e.hp || 10) * 0.4;
        e.speedMul = (e.speedMul || 1) * (1.5 + wave * 0.03);
        e.uniqueBehavior = 'swarmDiver';
        e.phase = Math.random() * Math.PI * 2;
      }
    }
  }

  // Update enemies
  const ez = gameC ? gameC.scale.x || 1 : 1;
  const ecx = gameC ? gameC.x : 0;
  const ecy = gameC ? gameC.y : 0;
  const eDL = -ecx / ez;
  const eDR = (width - ecx) / ez;
  const eDT = -ecy / ez;
  const eDB = (height - ecy) / ez;
  const dCfg = DIFF[difficulty];
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    const slowResist = e.slowResist || 0;
    const slowMul = e.slowTimer > 0 ? (0.4 + slowResist * 0.6) : 1.0;
    
    if (e.aiState === 'entering') {
      e.x += e.vx * dt * slowMul;
      e.y += e.vy * dt * slowMul;
      if (e.y >= e.targetY) {
        e.aiState = 'holding';
        e.phase = Math.random() * Math.PI * 2;
      }
    } else if (e.aiState === 'holding') {
      e.x += Math.sin(performance.now()*0.002 + e.phase) * 60 * dt * slowMul;
      e.vy = 0;
      if (e.dodgeCooldown > 0) e.dodgeCooldown -= dt;
      
      // Dodge mechanics
      if (e.dodgeCooldown <= 0 && lasers.length > 0 && Math.random() < 0.05) {
        for (let li=0; li<Math.min(lasers.length, 5); li++) {
           const l = lasers[li];
           if (Math.abs(l.x - e.x) < 40 && l.y > e.y) {
              e.x += (e.x > l.x ? 60 : -60);
              e.dodgeCooldown = 1.0;
              break;
           }
        }
      }
      
      // Randomly swoop
      if (Math.random() < 0.001) {
         e.aiState = 'swooping';
         e.vy = 100 + Math.random()*100;
      }
    } else if (e.aiState === 'swooping') {
      e.y += e.vy * dt * slowMul;
      if (e.x < cannon.x) e.x += 30 * dt * slowMul;
      if (e.x > cannon.x) e.x -= 30 * dt * slowMul;
    } else {
      e.x += e.vx * dt * slowMul;
      e.y += e.vy * dt * slowMul;
    }

    if (e.slowTimer > 0) { e.slowTimer -= dt * (1 + slowResist * 2); }
    if (e.ionDOT > 0) { e.ionDOT -= dt; e.hp -= dt * 8; }

    if (Math.abs(e.vx) < 0.5 && Math.abs(e.vy) < 0.5) e.vy = e.size > 20 ? 15 : 25;
    if (e.x < eDL + e.size) { e.x = eDL + e.size; e.vx = Math.abs(e.vx) * 0.5; }
    if (e.x > eDR - e.size) { e.x = eDR - e.size; e.vx = -Math.abs(e.vx) * 0.5; }

    // Buffed enemies rush the player aggressively
    if (e.buffed && e.y > 0 && !e.hardcoreBlock) {
      const dxP = cannon.x - e.x;
      const dyP = cannon.y - e.y;
      const distP = Math.hypot(dxP, dyP) || 1;
      const rushSpeed = Math.min(80 + 400 / Math.max(distP, 20), 250) * dt;
      e.vx += (dxP / distP) * rushSpeed;
      e.vy += (dyP / distP) * rushSpeed;
      e.vx = Math.max(-150, Math.min(150, e.vx));
      e.vy = Math.max(-80, Math.min(150, e.vy));
    }

    // Tiny enemies zigzag dodge incoming lasers (millisecond intercept prediction)
    if (e.size < 15 && !e.buffed && !e.hardcoreBlock && lasers.length > 0) {
      let closestT = Infinity, dodgeDir = 0, dodgeRX = 0, dodgeRY = 0;
      const checkCount = Math.min(lasers.length, 8);
      for (let li = 0; li < checkCount; li++) {
        const l = lasers[li];
        const rx = l.x - e.x, ry = l.y - e.y;
        const rvx = l.vx - e.vx, rvy = l.vy - e.vy;
        const a = rvx * rvx + rvy * rvy;
        if (a < 0.01) continue;
        const b = 2 * (rx * rvx + ry * rvy);
        const c = rx * rx + ry * ry - (e.size + 6) * (e.size + 6);
        const disc = b * b - 4 * a * c;
        if (disc < 0) continue;
        const sqrtDisc = Math.sqrt(disc);
        const t1 = (-b - sqrtDisc) / (2 * a);
        const t2 = (-b + sqrtDisc) / (2 * a);
        let tHit = t1 > 0.001 ? t1 : (t2 > 0.001 ? t2 : Infinity);
        if (tHit < closestT && tHit < 0.35) {
          closestT = tHit; dodgeDir = rx * rvy - ry * rvx > 0 ? 1 : -1;
          dodgeRX = rx; dodgeRY = ry;
        }
      }
      if (closestT < 0.35) {
        if (!e._dodgePhase || e._dodgePhase < closestT) {
          const dist = Math.hypot(dodgeRX || 1, dodgeRY || 1);
          const burst = (120 + 80 * (1 - closestT / 0.35)) * dt;
          e.vx += dodgeDir * (-dodgeRY / dist) * burst * 6;
          e.vy += dodgeDir * (dodgeRX / dist) * burst * 6;
          e._dodgePhase = closestT + 0.1;
        }
      }
    }

    // Shielded enemies zigzag more aggressively
    if (e.subtype === 'shielded' && e.y > 0 && !e.hardcoreBlock) {
      if (!e._zigTimer) e._zigTimer = 0;
      e._zigTimer += dt;
      if (e._zigTimer > 0.3 + Math.random() * 0.4) {
        e._zigTimer = 0;
        
        if (boss && Math.random() < 0.05 * d.spawnMul * 1) {
          const angToPlayer = Math.atan2(cannon.y - boss.y, cannon.x - boss.x);
          const a = angToPlayer + (Math.random() - 0.5) * 2;
          const chainLength = 1 + Math.floor(Math.random() * 4);
          for(let i=0; i<chainLength; i++) {
            setTimeout(() => {
                if (boss && !boss.dead) {
                    const b = spawnEnemyBullet(boss.x, boss.y + 20, a, null, false, true);
                    if (b && b.sprite) {
                        b.sprite.texture = particleShapes[1 + Math.floor(Math.random()*(particleShapes.length-1))];
                        b.sprite.scale.set(0.8);
                        b.sprite.rotation = Math.random() * Math.PI;
                    }
                }
            }, i * 150);
          }
        }
        const zigDir = (Math.random() - 0.5) * 2;
        e.vx += zigDir * (60 + Math.random() * 40) * dt;
      }
      e.vx = Math.max(-120, Math.min(120, e.vx));
      e.vy = Math.max(-30, Math.min(30, e.vy));
      if (!e._shieldPulse) e._shieldPulse = 0;
      e._shieldPulse += dt;
      e.sprite.tint = 0x00ffff + (Math.sin(e._shieldPulse * 4) * 0x444444 & 0x444444);
    }

    // Unique enemy behavior
    if (e.uniqueBehavior && e.reveal > 0.3 && e.y > 0 && !e.hardcoreBlock) {
      const ub = e.uniqueBehavior;
      if (ub === 'spiral') {
        e.vx += Math.sin(now * 0.004 + e.phase) * 60 * dt;
        e.vy += Math.cos(now * 0.004 + e.phase) * 20 * dt;
      } else if (ub === 'burst') {
        if (!e._burstTimer) e._burstTimer = 0;
        e._burstTimer += dt;
        if (e._burstTimer > 0.8) { e._burstTimer = 0; e.vx += (Math.random() - 0.5) * 120 * dt; e.vy -= 40 * dt; }
      } else if (ub === 'weave') {
        e.vx += Math.sin(now * 0.006 + e.phase) * 80 * dt;
      } else if (ub === 'swarmDiver') {
        const stY = cannon.y + 80;
        const cdx = cannon.x - e.x, cdy = stY - e.y;
        const cdl = Math.max(1, Math.hypot(cdx, cdy));
        e.vx += (cdx / cdl) * 120 * dt;
        e.vy += (cdy / cdl) * 150 * dt;
        e.vx += Math.sin(now * 0.008 + e.phase) * 100 * dt;
      } else if (ub === 'swarmGroup') {
        if (e.leader && !e.leader.dead) {
          const tdx = e.leader.x - e.x, tdy = e.leader.y - e.y;
          const tdl = Math.max(1, Math.hypot(tdx, tdy));
          e.vx += (tdx / tdl) * 80 * dt + Math.sin(now * 0.006 + e.phase) * 60 * dt;
          e.vy += (tdy / tdl) * 80 * dt + Math.cos(now * 0.005 + e.phase) * 60 * dt;
        } else {
          const stY = cannon.y + 80;
          const cdx = cannon.x - e.x, cdy = stY - e.y;
          const cdl = Math.max(1, Math.hypot(cdx, cdy));
          e.vx += (cdx / cdl) * 100 * dt;
          e.vy += (cdy / cdl) * 120 * dt;
        }
      } else if (ub === 'orbit') {
        const ox = cannon.x + Math.sin(now * 0.002 + e.phase) * 100;
        const oy = cannon.y - 60 + Math.cos(now * 0.002 + e.phase) * 50;
        e.vx += (ox - e.x) * dt * 0.8;
        e.vy += (oy - e.y) * dt * 0.8;
      } else if (ub === 'dodger') {
        let dodgeDir = 0;
        for (let j = 0; j < lasers.length; j++) {
           const l = lasers[j];
           if (l.dead || l.y < e.y) continue;
           if (Math.abs(l.x - e.x) < 60 && l.vy < -50) {
               dodgeDir += Math.sign(e.x - l.x) * 300 * dt;
               if (dodgeDir === 0) dodgeDir = (Math.random() > 0.5 ? 1 : -1) * 300 * dt;
           }
        }
        e.vx += dodgeDir;
      } else if (ub === 'hoverShooter') {
        const targetY = height * 0.15 + Math.sin(now * 0.002 + e.phase) * 30;
        if (e.y < targetY) e.vy += 80 * dt;
        else e.vy -= 80 * dt;
        e.vx += Math.cos(now * 0.003 + e.phase) * 60 * dt;
        e.vy *= 0.92;
      } else if (ub === 'snake') {
        if (!e._snakeInit) {
          e._snakeInit = true; e._segments = []; e._trail = []; e._growTimer = 0;
          let prev = e;
          for (let s = 0; s < 3; s++) {
             const seg = spawnEnemy(e.x, e.y - 20 * (s+1), 0);
             if (seg) { seg.uniqueBehavior = 'snakeSegment'; seg.leader = prev; seg.size *= 0.7; seg.hp = (e.hp || 10) * 0.4; e._segments.push(seg); prev = seg; }
          }
        }
        if (!e._trail) e._trail = [];
        e._trail.unshift({x: e.x, y: e.y});
        if (e._trail.length > 30) e._trail.pop();
        e.vx += Math.sin(now * 0.005 + e.phase) * 60 * dt;
        e._growTimer += dt;
        if (e._growTimer > 2.0 && e._segments.length < 3) {
             e._growTimer = 0;
             const tail = e._segments.length > 0 ? e._segments[e._segments.length - 1] : e;
             const seg = spawnEnemy(tail.x, tail.y - 20, 0);
             if (seg) { seg.uniqueBehavior = 'snakeSegment'; seg.leader = tail; seg.size *= 0.7; seg.hp = (e.hp || 10) * 0.4; e._segments.push(seg); }
        }
      } else if (ub === 'snakeSegment') {
        if (e.leader && !e.leader.dead && !e.leader.deadZone) {
           if (e.leader._trail && e.leader._trail.length > 8) {
              const tgt = e.leader._trail[8];
              e.vx += (tgt.x - e.x) * 10 * dt; e.vy += (tgt.y - e.y) * 10 * dt;
           }
           if (!e._trail) e._trail = [];
           e._trail.unshift({x: e.x, y: e.y});
           if (e._trail.length > 30) e._trail.pop();
        }
      } else if (ub === 'charge') {
        const stY = cannon.y + 80;
        const cdx = cannon.x - e.x, cdy = stY - e.y;
        const cdd = Math.hypot(cdx, cdy) || 1;
        e.vx += (cdx / cdd) * 50 * dt;
        e.vy += (cdy / cdd) * 30 * dt;
      } else if (ub === 'retreat') {
        if (e.y < cannon.y - 100) e.vy += 10 * dt;
        else e.vy -= 20 * dt;
      } else if (ub === 'pulsate') {
        const pulseS = 0.5 + Math.sin(now * 0.005 + e.phase) * 0.5;
        e.sprite.scale.set(0.2 + pulseS * 0.4);
      } else if (ub === 'flank') {
        const fdx = cannon.x - e.x, fdy = cannon.y - e.y;
        const fdd = Math.hypot(fdx, fdy) || 1;
        const perpX = -fdy / fdd, perpY = fdx / fdd;
        e.vx += perpX * 40 * dt;
        e.vy += perpY * 20 * dt + Math.sin(now * 0.003 + e.phase) * 30 * dt;
      } else if (ub === 'ambush') {
        if (e.y > cannon.y * 0.3) e.vy -= 30 * dt;
        else e.vy += 60 * dt;
      } else if (ub === 'swarmLeader') {
        if (!e._swarmTimer) e._swarmTimer = 0;
        e._swarmTimer += dt;
        if (e._swarmTimer > 2 && enemies.length < MAX_ENEMIES * 0.6) {
          e._swarmTimer = 0;
          for (let si = 0; si < 3; si++) spawnEnemy(e.x + (Math.random() - 0.5) * 30, -5);
        }
      }
      e.vx = Math.max(-90, Math.min(90, e.vx));
      e.vy = Math.max(-60, Math.min(80, e.vy));
    }

    if (difficulty === 'hardcore' && e.hardcoreBlock) {
      const blockEnemies = enemies.filter(oe => oe.hardcoreBlock === e.hardcoreBlock);
      if (blockEnemies.length > 1) {
        const cx = blockEnemies.reduce((sum, oe) => sum + oe.x, 0) / blockEnemies.length;
        const cy = blockEnemies.reduce((sum, oe) => sum + oe.y, 0) / blockEnemies.length;
        const tx = cx + e.blockOffsetX;
        const ty = cy + e.blockOffsetY;
        const k = 0.05;
        const dx = tx - e.x, dy = ty - e.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 2) {
          const force = Math.min(dist * k, 50) * dt;
          e.vx += dx / dist * force;
          e.vy += dy / dist * force;
        }
        e.vx *= 0.98;
        e.vy *= 0.98;
        const targetDist = 30;
        for (const oe of blockEnemies) {
          if (oe === e) continue;
          const ndx = oe.x - e.x, ndy = oe.y - e.y;
          const ndist = Math.hypot(ndx, ndy);
          if (ndist > 0) {
            if (ndist > targetDist * 1.2) {
              const push = Math.min(ndist - targetDist, 20) * 0.03 * dt;
              e.vx -= ndx / ndist * push;
              e.vy -= ndy / ndist * push;
            } else if (ndist < targetDist * 0.8) {
              const push = Math.min(targetDist - ndist, 20) * 0.03 * dt;
              e.vx += ndx / ndist * push;
              e.vy += ndy / ndist * push;
            }
          }
        }
        e.vy += 8 * dt;
      }
    }

    if (e.subtype === 'stealth') {
      e.sprite.alpha = 0.2 + Math.sin(now * 0.005 + e.phase) * 0.4;
      if (e.spriteCore) e.spriteCore.alpha = e.sprite.alpha;
      if (e.spriteRing) e.spriteRing.alpha = e.sprite.alpha;
      if (e.glow) e.glow.alpha = e.sprite.alpha * 0.5;
    } else if (e.subtype === 'bomber' && e.reveal > 0.3 && e.y > 0) {
      if (!e._mineTimer) e._mineTimer = 0;
      e._mineTimer += dt;
      if (e._mineTimer > 3) {
        e._mineTimer = 0;
        spawnEnemyBullet(e.x, e.y, 0, e, false, e.size, false, false, true);
      }
    } else if (e.subtype === 'pinata' && e.reveal > 0.3) {
      const dx = e.x - cannon.x, dy = e.y - cannon.y;
      const d = Math.hypot(dx, dy) || 1;
      e.vx += (dx / d) * 150 * dt;
      e.vy -= 100 * dt;
      e.vx = Math.max(-150, Math.min(150, e.vx));
      e.vy = Math.max(-150, Math.min(50, e.vy));
      if (!e._pinataTimer) e._pinataTimer = 0;
      e._pinataTimer += dt;
      if (e._pinataTimer > 0.5) {
         e._pinataTimer = 0;
         spawnGems(1);
      }
      if (e.y < -50) {
        rmEnemy(i);
        continue;
      }
    }

    // Raider: 3rd-party enemy that fights player + other enemies for powerups
    if (e.subtype === 'raider' && e.reveal > 0.3 && e.y > 0) {
      if (!e._raiderTimer) e._raiderTimer = 0;
      e._raiderTimer += dt;
      const rx = e.x, ry = e.y;
      let targetX = cannon.x, targetY = cannon.y;
      let targetIsEnemy = false;
      // Find nearest powerup to chase
      let nearestPu = null, puDist = Infinity;
      for (const pu of powerups) {
        if (pu._stolen) continue;
        const d = Math.hypot(pu.x - rx, pu.y - ry);
        if (d < puDist) { puDist = d; nearestPu = pu; }
      }
      if (nearestPu && puDist < 250) {
        targetX = nearestPu.x; targetY = nearestPu.y;
      } else {
        // Attack nearest regular enemy
        let nearestEnemy = null, enDist = Infinity;
        for (const oe of enemies) {
          if (oe === e || oe.subtype === 'raider' || oe.hardcoreBlock) continue;
          const d = Math.hypot(oe.x - rx, oe.y - ry);
          if (d < enDist) { enDist = d; nearestEnemy = oe; }
        }
        if (nearestEnemy && enDist < 200) {
          targetX = nearestEnemy.x; targetY = nearestEnemy.y;
          targetIsEnemy = true;
        }
      }
      const dxT = targetX - rx, dyT = targetY - ry;
      const distT = Math.hypot(dxT, dyT) || 1;
      const raiderSpeed = (120 + Math.random() * 40) * dt;
      e.vx += (dxT / distT) * raiderSpeed * 0.8;
      e.vy += (dyT / distT) * raiderSpeed * 0.6;
      e.vx = Math.max(-160, Math.min(160, e.vx));
      e.vy = Math.max(-60, Math.min(120, e.vy));
      e.rotV = (targetIsEnemy ? (dxT > 0 ? 0.05 : -0.05) : (Math.random() - 0.5) * 0.1);
      // Fire at target
      if (e._raiderTimer > 0.8 + Math.random() * 0.5) {
        e._raiderTimer = 0;
        spawnEnemyBlaster(rx, ry, targetX, targetY, e.size);
        if (Math.random() < 0.3) spawnEnemyBlaster(rx, ry, cannon.x, cannon.y, e.size);
      }
      // Steal powerup on contact
      if (nearestPu && puDist < 24) {
        const puIdx = powerups.indexOf(nearestPu);
        if (puIdx >= 0) {
          destroyPowerup(nearestPu);
          { powerups[puIdx] = powerups[powerups.length - 1]; powerups.pop(); }
          spawnExplosion(nearestPu.x, nearestPu.y, 0xff66aa, 6);
        }
      }
    }

    e.rotation += e.rotV;
    const eScreenY = e.y * ez + ecy;
    const eScreenSize = e.size * ez;
    const progress = Math.max(0, Math.min(1, (eScreenY + eScreenSize) / (height * 0.75)));
    const easeProgress = progress * progress * (3 - 2 * progress);
    e.reveal = easeProgress;
    const rv = e.reveal;
    e.sprite.alpha = rv * 0.9;
    const scl = (0.3 + 0.15 * rv);
    e.sprite.scale.set(scl);
    e.sprite.position.set(e.x, e.y);
    e.sprite.rotation = e.rotation;
    if (e.buffed) {
      e.sprite.tint = 0xaa88ff;
      if (e.buffedTimer > 0) {
        e.buffedTimer -= dt;
        if (e.buffedTimer <= 0) { e.buffed = false; e.buffedTimer = 0; e.enemyWeapon = null; }
      }
    }
    if (e.slowTimer > 0) e.sprite.tint = 0x44ccff;
    else if (e._origTint) e.sprite.tint = e._origTint;
    if (e.spriteAccent) {
      e.spriteAccent.scale.set(scl * 0.8);
      e.spriteAccent.position.set(e.x - 2 + Math.sin(now * 0.004 + e.phase) * 2, e.y + 1);
      e.spriteAccent.rotation = -e.rotation;
      if (e.slowTimer > 0) { e.spriteAccent.alpha = rv * 0.8; e.spriteAccent.tint = 0x88ddff; }
      else { e.spriteAccent.alpha = rv * 0.5; e.spriteAccent.tint = 0xffffff; }
    }
    if (e.spriteCore) {
      e.spriteCore.scale.set(scl * 0.6);
      e.spriteCore.position.set(e.x, e.y);
      e.spriteCore.rotation = e.rotation * 2 + now * 0.002;
      e.spriteCore.alpha = rv * (0.5 + Math.sin(now * 0.008 + e.phase) * 0.3);
      e.spriteCore.tint = e.slowTimer > 0 ? 0x88ddff : 0xffffff;
    }
    if (e.spriteRing) {
      e.spriteRing.scale.set(scl * 1.4);
      e.spriteRing.position.set(e.x, e.y);
      e.spriteRing.rotation = e.rotation + (now * (e.ringRotV || 0.02));
      e.spriteRing.alpha = rv * (0.5 + Math.sin(now * 0.005 + e.phase) * 0.3);
    }

    const pu = Math.sin(now * 0.002 * e.sparkleSpeed + e.phase) * 0.5 + 0.5;
    const pu2 = Math.sin(now * 0.003 * e.sparkleSpeed + e.phase + 0.3) * 0.5 + 0.5;
    if (rv > 0.05) {
      if (e.sparkle) {
        e.sparkle.alpha = (0.4 + pu * 0.6) * rv;
        e.sparkle.scale.set((2 + pu * 3));
        e.sparkle.position.set(e.x, e.y);
        e.sparkle.rotation = now * 0.003 + e.phase;
        e.sparkle.tint = e.slowTimer > 0 ? 0x88ddff : rcol();
      }
      if (e.glow) {
        e.glow.alpha = e.slowTimer > 0 ? (0.5 + pu2 * 0.4) * rv : (0.2 + pu2 * 0.5) * rv;
        e.glow.scale.set((1.5 + pu2 * 3));
        e.glow.position.set(e.x, e.y);
        e.glow.tint = e.slowTimer > 0 ? 0x88ddff : (e.buffed ? rcol() : (e.glow.tint || 0xffffff));
      }
      if (e.aura) {
        e.aura.alpha = (0.3 + pu * 0.4) * rv;
        e.aura.scale.set(4 + pu * 2);
        e.aura.position.set(e.x, e.y);
        e.aura.rotation = now * 0.001;
      }
      if (e.shimmer) {
        e.shimmer.alpha = (0.2 + pu2 * 0.5) * rv;
        e.shimmer.scale.set((3 + pu * 3));
        e.shimmer.position.set(e.x, e.y);
        e.shimmer.rotation = -now * 0.002 + e.phase;
      }
      if (e.chromaR) {
        e.chromaR.alpha = pu * (e.buffed ? 0.6 : 0.4) * rv;
        e.chromaR.scale.set((0.5 + pu * 2));
        e.chromaR.position.set(e.x - 3 - pu * 3, e.y - 1 - pu);
      }
      if (e.chromaB) {
        e.chromaB.alpha = pu2 * (e.buffed ? 0.6 : 0.4) * rv;
        e.chromaB.scale.set((0.5 + pu2 * 2));
        e.chromaB.position.set(e.x + 3 + pu2 * 3, e.y + 1 + pu2);
      }
    }

    // Buffed enemies dodge incoming lasers
    if (e.buffed && e.y > 0) {
      let dodgeX = 0, dodgeY = 0;
      for (let li = 0; li < lasers.length && li < 10; li++) {
        const l = lasers[li];
        const ldx = l.x - e.x, ldy = l.y - e.y;
        const lDist = Math.hypot(ldx, ldy);
        if (lDist < 180 && lDist > 5) {
          const lDot = (ldx * l.vx + ldy * l.vy) / (lDist || 1);
          if (lDot > 0) {
            const perpX = -ldy / lDist, perpY = ldx / lDist;
            const strength = Math.max(0, 1 - lDist / 180) * 120;
            dodgeX += perpX * strength;
            dodgeY += perpY * strength;
          }
        }
      }
      if (dodgeX || dodgeY) {
        e.vx += dodgeX * dt;
        e.vy += dodgeY * dt;
        e.vx = Math.max(-100, Math.min(100, e.vx));
        e.vy = Math.max(-80, Math.min(80, e.vy));
      }
    }

    if (e.y > height + 50 && e.subtype !== 'raider' && e.uniqueBehavior !== 'stealth' && !e.pinata) {
      if (e.hardcoreBlock) {
        rmEnemy(i);
      } else {        
        takeDamage();
        updateUI();
        playPenaltySnd();
        const ft = new PIXI.Text('ESCAPED', {
          fontFamily: 'sans-serif', fontSize: 18, fontWeight: '900',
          fill: 0xff4444, dropShadow: true, dropShadowColor: 0xff0000, dropShadowBlur: 6
        });
        ft.anchor.set(0.5); ft.position.set(width / 2, height * 0.6); ft.life = 1.2; ft.vy = -1.2;
        fxC.addChild(ft); fxT.push(ft);
        rmEnemy(i);
      }
    }

    if (e.fireInterval > 0 && e.reveal > 0.4 && e.y > 0) {
      e.fireTimer -= dt * (e.buffed ? 3 : 1);
      if (e.fireTimer <= 0) {
        e.fireTimer = e.fireInterval;
        const ang = Math.atan2(cannon.y - e.y, cannon.x - e.x);
        let fired = false;
        // Unique weapon firing
        if (e.uniqueWeapon && !fired) {
          const uw = e.uniqueWeapon;
          if (uw === 'spread') { for (let si = -3; si <= 3; si++) spawnEnemyBullet(e.x, e.y, ang + si * 0.08, e, false, e.size); fired = true; }
          else if (uw === 'rapid') { spawnEnemyBullet(e.x, e.y, ang, e, false, e.size); spawnEnemyBullet(e.x, e.y, ang + 0.06, e, false, e.size); fired = true; }
          else if (uw === 'pierce') { spawnEnemyBullet(e.x, e.y, ang, e, false, e.size); spawnEnemyBullet(e.x, e.y, ang, e, false, e.size * 0.5); fired = true; }
          else if (uw === 'blast') { for (let bi = -5; bi <= 5; bi++) spawnEnemyBullet(e.x, e.y, ang + bi * 0.06, e, false, e.size); fired = true; }
          else if (uw === 'beam') { spawnEnemyBullet(e.x, e.y, ang, e, false, e.size, false, false, true); fired = true; }
          else if (uw === 'bolt') { spawnEnemyBullet(e.x, e.y, ang, e, false, e.size); if (Math.random() < 0.5) spawnEnemyBullet(e.x, e.y, ang + 0.15, e, false, e.size); fired = true; }
          else if (uw === 'homing') { spawnEnemyBullet(e.x, e.y, ang, e, false, e.size, false, true); fired = true; }
          else if (uw === 'saber') { for (let si = -2; si <= 2; si++) spawnEnemyBullet(e.x, e.y, ang + si * 0.1, e, false, e.size); fired = true; }
          else if (uw === 'swarm') { for (let wi = 0; wi < 3; wi++) spawnEnemyBullet(e.x, e.y, ang + (wi - 1) * 0.2, e, false, e.size, false, true); fired = true; }
          else if (uw === 'prism') { for (let pi = -1; pi <= 1; pi++) spawnEnemyBullet(e.x, e.y, ang + pi * 0.25, e, false, e.size); fired = true; }
          else if (uw === 'flare') { spawnEnemyBullet(e.x, e.y, ang, e, false, e.size); e.slowTimer = Math.max(e.slowTimer || 0, 0.5); fired = true; }
          else if (uw === 'vortex') { for (let vi = 0; vi < 6; vi++) spawnEnemyBullet(e.x, e.y, (vi / 6) * Math.PI * 2 + e.phase, e, false, e.size); fired = true; }
          else if (uw === 'mine') { spawnEnemyBullet(e.x, e.y, ang, e, false, e.size, true); fired = true; }
          else if (uw === 'glacier') { spawnEnemyBullet(e.x, e.y, ang, e, false, e.size); e.slowTimer = Math.max(e.slowTimer || 0, 1); fired = true; }
          else if (uw === 'nebula') { for (let ni = -2; ni <= 2; ni++) spawnEnemyBullet(e.x, e.y, ang + ni * 0.15, e, false, e.size); fired = true; }
        }
        if (e.tier >= 0 && !fired) {
          const t = e.tier;
          const cRing = t >= 4 ? Math.min(0.04 * t, 0.25) : 0;
          const cSpread = t >= 3 ? Math.min(0.05 * t, 0.25) : 0;
          const cBounce = t >= 6 ? Math.min(0.02 * (t - 4), 0.1) : 0;
          const cHoming = t >= 4 ? Math.min(0.02 * (t - 2), 0.1) : 0;
          const total = cRing + cSpread + cBounce + cHoming + 1;
          let roll = Math.random() * total;
          if ((roll -= cRing) <= 0) {
            const n = 4 + Math.floor(t / 2);
            for (let i = 0; i < n; i++) spawnEnemyBullet(e.x, e.y, (i / n) * Math.PI * 2 + e.phase, e, false, e.size);
            fired = true;
          } else if ((roll -= cSpread) <= 0) {
            const n = 1 + Math.floor(t / 4);
            for (let i = -n; i <= n; i++) spawnEnemyBullet(e.x, e.y, ang + i * (0.15 + t * 0.008), e, false, e.size);
            fired = true;
          } else if ((roll -= cBounce) <= 0) {
            spawnEnemyBullet(e.x, e.y, ang, e, false, e.size, true);
            fired = true;
          } else if ((roll -= cHoming) <= 0) {
            spawnEnemyBullet(e.x, e.y, ang, e, false, e.size, false, true);
            fired = true;
          }
        }
        if (!fired) {
          spawnEnemyBullet(e.x, e.y, ang, e, false, e.size);
        }
      }
    }

    // Enemy blaster weapon fire
    if (e.enemyWeapon === 'blaster' && e.y > 0 && e.reveal > 0.4) {
      if (!e.weaponFireTimer || e.weaponFireTimer <= 0) e.weaponFireTimer = 2;
      e.weaponFireTimer -= dt;
      if (e.weaponFireTimer <= 0) {
        e.weaponFireTimer = 2 + Math.random() * 0.5;
        spawnEnemyBlaster(e.x, e.y, cannon.x, cannon.y, e.size);
      }
    }

    
    const cx = Math.floor(e.x / 60), cy = Math.floor(e.y / 60);
    const nearbyLasers = [];
    for(let dx=-1;dx<=1;dx++) for(let dy=-1;dy<=1;dy++) {
      const arr = LASER_GRID.get((cx+dx)+','+(cy+dy));
      if(arr) nearbyLasers.push(...arr);
    }
    for (let j = 0; j < nearbyLasers.length; j++) {
      const l = nearbyLasers[j];
      if (l.dead || (l.hitEnemies && l.hitEnemies.indexOf(e) >= 0)) continue;

      // Off-screen enemies cannot be hit
      if (e.y < eDT - e.size || e.y > eDB + e.size || e.x < eDL - e.size || e.x > eDR + e.size) continue;
      let hit = false;
      let hitRadius = Math.max(e.size * 0.5, 12);
      // Range falloff: enemies higher on screen (further from player) are harder to hit
      const rangeY = Math.max(0, cannon.y - e.y) / cannon.y;
      const rangeFalloff = Math.max(0.25, 1 - rangeY * 0.6);
      hitRadius *= rangeFalloff;
      if (l.beam) hitRadius = Math.max(hitRadius, 32);
      else if (l.nova) hitRadius = Math.max(hitRadius, 24);
      else if (l.singularity) hitRadius = Math.max(hitRadius, 26);
      else if (l.blast) hitRadius = Math.max(hitRadius, 30 + (l.blastLvl||0)*4);
      else if (l.vortex) hitRadius = Math.max(hitRadius, 24);
      else if (l.pulse) hitRadius = Math.max(hitRadius, 8);
      else if (l.prism) hitRadius = Math.max(hitRadius, 18);
      else if (l.swarm) hitRadius = Math.max(hitRadius, 16);
      else if (l.gravity) hitRadius = Math.max(hitRadius, 18);
      else if (l.flare) hitRadius = Math.max(hitRadius, 16);
      else if (l.shard) hitRadius = Math.max(hitRadius, 14);
      else if (l.rift) hitRadius = Math.max(hitRadius, 24);
      else if (l.bolt) hitRadius = Math.max(hitRadius, 18);
      else if (l.homing) hitRadius = Math.max(hitRadius, 16);
      else if (l.pierce) hitRadius = Math.max(hitRadius, 14);
      else if (l.mine) hitRadius = Math.max(hitRadius, 18);
      else if (l.nebula) hitRadius = Math.max(hitRadius, 20);
      else if (l.void) hitRadius = Math.max(hitRadius, 20);
      else if (l.time) hitRadius = Math.max(hitRadius, 18);
      else if (l.glacier) hitRadius = Math.max(hitRadius, 16);
      else if (l.phantom) hitRadius = Math.max(hitRadius, 18);
      else if (l.echo) hitRadius = Math.max(hitRadius, 18);
      else if (l.tether) hitRadius = Math.max(hitRadius, 18);
      else if (l.inferno) hitRadius = Math.max(hitRadius, 20);
      else if (l.railgun) hitRadius = Math.max(hitRadius, 14);
      else if (l.starburst) hitRadius = Math.max(hitRadius, 18);
      else if (l.vortexstorm) hitRadius = Math.max(hitRadius, 20);
      else if (l.prismsaber) hitRadius = Math.max(hitRadius, 18);
      else if (l.phantomflare) hitRadius = Math.max(hitRadius, 18);
      else if (l.oblivion) hitRadius = Math.max(hitRadius, 22);
      else if (l.ufo) hitRadius = Math.max(hitRadius, 16);
      else if (l.saber) hitRadius = Math.max(hitRadius, 22);
      else if (l.beam) hitRadius = Math.max(hitRadius, 30);
      if ((l.saber || l.beam) && l.distTraveled > 0) {
        const sx = cannon.x, sy = cannon.y;
        const ldx = l.x - sx, ldy = l.y - sy;
        const llen2 = ldx * ldx + ldy * ldy;
        if (llen2 > 1) {
          const edx = e.x - sx, edy = e.y - sy;
          const t = Math.max(0, Math.min(1, (edx * ldx + edy * ldy) / llen2));
          const px = sx + t * ldx, py = sy + t * ldy;
          const ddx = e.x - px, ddy = e.y - py;
          if (ddx * ddx + ddy * ddy < hitRadius * hitRadius) hit = true;
        }
      } else {
        const dx = e.x - l.x, dy = e.y - l.y;
        if (dx * dx + dy * dy < hitRadius * hitRadius) hit = true;
      }
      if (hit) {
        if (l.mine) {
          if (l.hitEnemies.indexOf(e) < 0) {
            l.hitEnemies.push(e);
            const ang = Math.atan2(l.vy, l.vx);
            const norm = Math.atan2(e.y - l.y, e.x - l.x);
            const reflect = 2 * norm - ang;
            l.vx = Math.cos(reflect) * l.speed;
            l.vy = Math.sin(reflect) * l.speed;
            l.x += l.vx * 0.02; l.y += l.vy * 0.02;
            l.sprite.tint = [0xcc8844, 0x44cc88, 0x8844cc, 0xcc6644][l.hitEnemies.length % 4];
            spawnExplosion(l.x, l.y, 0xcc8844, 2);
          } else { continue; }
        }
        if (l.bolt) {
            if (!l.hitEnemies) l.hitEnemies = [];
            if (l.hitEnemies.indexOf(e) < 0) {
              l.hitEnemies.push(e);
              const ddCfg = DIFF[difficulty];
              const bWpnCfg = specialWeapon ? WEAPONS[specialWeapon] : null;
              const bAdj = bWpnCfg ? (e.shield > 0 ? bWpnCfg.shieldMul : bWpnCfg.wepMul) : 1;
              const chainLvl = l.chainLvl || 1;
              e.hp -= Math.round((1 + Math.floor(Math.sqrt(wave))) * ddCfg.dmgMul * (2 + chainLvl) * bAdj * (e.armored && !l.pierce ? 0.3 : 1));
              if (e.hp <= 0 && !e.dead) { e.dead = true;
                const dTier = TIERS[e.tier];
                if (dTier) { score += dTier.pt; playPopSnd(e.tier); spawnExplosion(e.x, e.y, dTier.cl[0], 8); spawnPowerup(e.x, e.y); if (Math.random() < ((DIFF[difficulty].dropChance || 0.4) * 0.08)) spawnSpecialPowerup(e.x, e.y); updateUI(); }
                killQueue.push({ e, x: e.x, y: e.y, tier: e.tier });
              }
              if (!l.skipChain && (!l.stormBolt || !l._chainFired)) {
                if (l.stormBolt) l._chainFired = true;
                let nearby = false;
                const checkLimit = Math.min(enemies.length, 50);
                for (let oi = 0; oi < checkLimit; oi++) {
                  const oe = enemies[oi];
                  if (oe === e || oe.tier === undefined) continue;
                  const dx = oe.x - e.x, dy = oe.y - e.y;
                  if (dx * dx + dy * dy < 22500) { nearby = true; break; }
                }
                if (nearby) chainLightning(e, Math.min(l.chainLvl, 3), l.x, l.y, {
                  stormBolt: l.stormBolt || false,
                  maxChains: 6
                });
              }
              l.sprite.visible = false; laserPool.push(l.sprite); laserC.removeChild(l.sprite);
              l.dead = true;
            }
            break;
        }
        if (l.beam) {
          if (l.hitEnemies.indexOf(e) >= 0) continue;
          l.hitEnemies.push(e);
        }
        const wpnCfg = specialWeapon ? WEAPONS[specialWeapon] : null;
        const wpnAdj = wpnCfg ? (e.shield > 0 ? wpnCfg.shieldMul : wpnCfg.wepMul) : 1;
        let laserDmg = Math.round((1 + Math.min(6, Math.floor(Math.sqrt(wave)))) * dCfg.dmgMul * (l.cannonMul || 1) * (l.dmgMul || 1) * wpnAdj * (l.rangeMul || 1));
        if (!l.beam && !l.saber && !l.laser) {
          const distRatio = Math.max(0, Math.min(1, (cannon.y - e.y) / cannon.y));
          const rangeFalloff = Math.max(0.01, 1 - Math.pow(distRatio * 1.08, 5));
          laserDmg = Math.round(laserDmg * rangeFalloff);
        }
        if (specialWeapon === 'spread') {
          const sz = gameC ? gameC.scale.x || 1 : 1;
          const scx = gameC ? gameC.x : 0;
          const eLeft = -scx / sz;
          const eRight = (width - scx) / sz;
          const eWidth = eRight - eLeft;
          const falloffStart = eLeft + eWidth * 0.10;
          const falloffEnd = eLeft + eWidth * 0.50;
          const ft = Math.max(0, Math.min(1, (l.distTraveled - falloffStart) / (falloffEnd - falloffStart)));
          laserDmg = Math.round(laserDmg * (1 - ft * 0.5));
          laserDmg = Math.max(1, laserDmg);
        }
        // Ammo range falloff — smooth gradient toward top of play area
        const pHeight = eDB - eDT;
        const fromBot = (e.y - eDT) / pHeight;
        const progress = Math.max(0, Math.min(1, 1 - fromBot));
        const rangeMult = Math.max(0.01, 1 - Math.pow(progress, 3));
        laserDmg = Math.round(laserDmg * rangeMult);
        laserDmg = Math.max(1, laserDmg);
        let saberMulti = 1;
        if (l.saber) {
          const slvl = l.saberLvl != null ? l.saberLvl : 0;
          saberMulti = slvl >= 0 ? 2 : 1;
          if (slvl >= 1) e.slowTimer = 0.8;
          if (slvl >= 3) { health = Math.min(maxHealth, health + 0.2); updateUI(); }
        }
        if (l.ion) {
          e.slowTimer = Math.max(e.slowTimer || 0, 3);
          e.ionDOT = (e.ionDOT || 0) + 5 + (l.ionLvl || 0) * 1.5;
        }
        let wpnMul = 1;
        const rm = l.rangeMul || 1;
        if (l.gravity) {
          for (const ge of enemies) { const gd = Math.hypot(ge.x - l.x, ge.y - l.y); if (gd < 120 + l.gravLvl * 10) { const pull = 180 / Math.max(gd, 10); ge.vx += (l.x - ge.x) / gd * pull; ge.vy += (l.y - ge.y) / gd * pull; } }
          wpnMul = 0.8 + l.gravLvl * 0.2;
        }
        if (l.flare) {
          for (const fe of enemies) { const fd = Math.hypot(fe.x - l.x, fe.y - l.y); if (fd < 50 + l.flareLvl * 8) { fe.hp -= 0.5 * rm; } }
          spawnExplosion(l.x, l.y, 0xff6600, 6);
          wpnMul = 0.7 + l.flareLvl * 0.15;
        }
        if (l.nova) {
          for (const ne of enemies) { const nd = Math.hypot(ne.x - l.x, ne.y - l.y); if (nd < 40 + l.novaLvl * 6) { ne.hp -= (2 + l.novaLvl * 0.5) * rm; } }
          spawnExplosion(l.x, l.y, 0xff0066, 20);
          wpnMul = 0.5 + l.novaLvl * 0.1;
        }
        if (l.singularity) {
          for (const se of enemies) { const sd = Math.hypot(se.x - l.x, se.y - l.y); if (sd < 80 + l.singLvl * 10) { se.hp -= (3 + l.singLvl) * rm; se.vx += (l.x - se.x) / Math.max(sd,5) * 200; se.vy += (l.y - se.y) / Math.max(sd,5) * 200; } }
          spawnExplosion(l.x, l.y, 0x660066, 30);
          wpnMul = 0.6 + l.singLvl * 0.1;
        }
        if (l.blast) {
          for (const be of enemies) { const bd = Math.hypot(be.x - l.x, be.y - l.y); if (bd < 55 + (l.blastLvl||0)*6) { be.hp -= (2 + (l.blastLvl||0)*0.5) * rm; } }
          spawnExplosion(l.x, l.y, 0xaa44ff, 16);
        }
        if (l.vortex) {
          for (const ve of enemies) { const vd = Math.hypot(ve.x - l.x, ve.y - l.y); if (vd < 50 + (l.vortexLvl||0)*5) { ve.hp -= (1 + (l.vortexLvl||0)*0.3) * rm; } }
          spawnExplosion(l.x, l.y, 0x00aaff, 10);
        }
        if (l.pulse) {
          for (const pe of enemies) { 
            const pd = Math.hypot(pe.x - l.x, pe.y - l.y); 
            if (pd < 40 + (l.pulseLvl||0)*4) { 
              if (!l.pulseHit) l.pulseHit = {};
              if (!l.pulseHit[pe.uid]) {
                l.pulseHit[pe.uid] = true;
                pe.hp -= (0.5 + (l.pulseLvl||0)*0.15) * rm;
                if (pe.hp <= 0 && !pe.dead) { pe.dead = true; const _pt = TIERS[pe.tier]; if (_pt) { score += _pt.pt; spawnExplosion(pe.x, pe.y, _pt.cl[0], 8); spawnPowerup(pe.x, pe.y); } killQueue.push({ e: pe, x: pe.x, y: pe.y, tier: pe.tier }); }
              }
            } 
          }
          spawnExplosion(l.x, l.y, 0x66ffcc, 14);
      if (l.prism) {
            for (const pe of enemies) { 
                const pd = Math.hypot(pe.x - l.x, pe.y - l.y); 
                if (pd < 25) { 
                    pe.hp -= 1 * rm; 
                    if (pe.hp <= 0 && !pe.dead) {
                        pe.dead = true;
                        const pTier = TIERS[pe.tier];
                        if (pTier) { score += pTier.pt; playPopSnd(pe.tier); spawnExplosion(pe.x, pe.y, pTier.cl[0], 8); spawnPowerup(pe.x, pe.y); if (Math.random() < ((DIFF[difficulty].dropChance || 0.4) * 0.08)) spawnSpecialPowerup(pe.x, pe.y); updateUI(); }
                        killQueue.push({ e: pe, x: pe.x, y: pe.y, tier: pe.tier });
                    }
                } 
            }
          }
        }
        if (l.rift) {
          for (const re of enemies) { 
            const rd = Math.hypot(re.x - l.x, re.y - l.y); 
            if (rd < 30) { 
              re.hp -= 2 * rm; 
            } 
          }
        }
        if (l.glacier) {
          for (const ge of enemies) { const gd = Math.hypot(ge.x - l.x, ge.y - l.y); if (gd < 60 + l.glacierLvl * 8) { ge.slowTimer = Math.max(ge.slowTimer || 0, 1.5 + l.glacierLvl * 0.3); } }
          spawnExplosion(l.x, l.y, 0x00ccff, 10);
        }
        if (l.time) {
          for (const te of enemies) { const td = Math.hypot(te.x - l.x, te.y - l.y); if (td < 120 + l.timeLvl * 15 && te.y > 0) { te.slowTimer = Math.max(te.slowTimer || 0, 2 + l.timeLvl * 0.4); } }
          const tz = { x: l.x, y: l.y, lvl: l.timeLvl, life: 2 + l.timeLvl * 0.3, radius: 80 + l.timeLvl * 8, dmgTimer: 0, time: true };
          const tg = new PIXI.Graphics();
          tg.beginFill(0x44ddff, 0.12); tg.drawCircle(0, 0, tz.radius); tg.endFill();
          tg.beginFill(0x88eeff, 0.08); tg.drawCircle(0, 0, tz.radius * 0.5); tg.endFill();
          tg.position.set(tz.x, tz.y); tg.blendMode = PIXI.BLEND_MODES.ADD;
          fxC.addChild(tg); tz.gfx = tg;
          zones.push(tz);
          spawnExplosion(l.x, l.y, 0x44ddff, 22);
        }
        if (l.nebula) {
          const nlvl = l.nebulaLvl || 0;
          const nx = Math.max(eDL, Math.min(eDR, l.x));
          const ny = Math.max(eDT, Math.min(eDB, l.y));
          const nz = { x: nx, y: ny, lvl: nlvl, life: 2 + nlvl * 0.4, radius: 30 + nlvl * 5, dmgTimer: 0, nebula: true };
          const ng = new PIXI.Graphics();
          ng.beginFill(0xff88aa, 0.04); ng.drawCircle(0, 0, nz.radius * 1.5); ng.endFill();
          ng.beginFill(0xffaacc, 0.06); ng.drawCircle(0, 0, nz.radius * 1.0); ng.endFill();
          ng.beginFill(0xcc6688, 0.08); ng.drawCircle(0, 0, nz.radius * 0.5); ng.endFill();
          ng.position.set(nx, ny); ng.blendMode = PIXI.BLEND_MODES.ADD;
          fxC.addChild(ng); nz.gfx = ng;
          zones.push(nz);
          spawnExplosion(l.x, l.y, 0xff88aa, 8);
        }
        if (l.void) {
          const lvl = l.voidLvl || 0;
          const zx = Math.max(eDL, Math.min(eDR, l.x));
          const voidTop = eDT + (eDB - eDT) * 0.1;
          const zy = Math.max(voidTop, Math.min(eDB, l.y));
          const z = { x: zx, y: zy, lvl, life: 3 + lvl * 0.5, radius: 40 + lvl * 6, dmgTimer: 0 };
          const g = new PIXI.Graphics();
          g.beginFill(0x440088, 0.03); g.drawCircle(0, 0, z.radius * 1.2); g.endFill();
          g.beginFill(0x6600aa, 0.06); g.drawCircle(0, 0, z.radius * 0.8); g.endFill();
          g.beginFill(0x8844cc, 0.08); g.drawCircle(0, 0, z.radius * 0.55); g.endFill();
          g.beginFill(0x06000a, 0.3); g.drawCircle(0, 0, z.radius * 0.22); g.endFill();
          g.position.set(z.x, z.y); g.blendMode = PIXI.BLEND_MODES.ADD;
          fxC.addChild(g); z.gfx = g;
          zones.push(z);
          spawnExplosion(l.x, l.y, 0x4488ff, 10);
        }
        if (l.inferno) {
          e.slowTimer = Math.max(e.slowTimer || 0, 1);
          e.hp -= (2 + (l.infernoLvl || 0) * 0.5) * rm;
          const poolR = 30 + (l.infernoLvl || 0) * 5;
          const pz = { x: l.x + (Math.random() - 0.5) * 10, y: l.y + (Math.random() - 0.5) * 10, lvl: l.infernoLvl || 0, life: 2.5, radius: poolR, dmgTimer: 0 };
          const pg = new PIXI.Graphics();
          pg.beginFill(0xff2200, 0.08); pg.drawCircle(0, 0, pz.radius); pg.endFill();
          pg.beginFill(0xff6600, 0.04); pg.drawCircle(0, 0, pz.radius * 0.5); pg.endFill();
          pg.position.set(pz.x, pz.y); pg.blendMode = PIXI.BLEND_MODES.NORMAL;
          fxC.addChild(pg); pz.gfx = pg;
          zones.push(pz);
        }
        if (l.railgun) {
          e.hp -= (1 + (l.railgunLvl || 0) * 0.3) * rm;
          const chainR = 80 + (l.railgunLvl || 0) * 10;
          for (let ci = 0; ci < Math.min(enemies.length, 20); ci++) {
            const oe = enemies[ci];
            if (oe === e || oe.y < 0) continue;
            if (Math.hypot(oe.x - l.x, oe.y - l.y) < chainR) {
              oe.hp -= Math.round(laserDmg * 0.3);
              spawnExplosion(oe.x, oe.y, 0x44aaff, 4);
              if (oe.hp <= 0 && !oe.dead) { oe.dead = true; killQueue.push({ e: oe, x: oe.x, y: oe.y, tier: oe.tier }); }
            }
          }
          spawnExplosion(l.x, l.y, 0x44aaff, 12);
        }
        if (l.starburst) {
          const buries = enemies.filter(be2 => be2 !== e && Math.hypot(be2.x - l.x, be2.y - l.y) < 60 + (l.starburstLvl || 0) * 8);
          for (const be2 of buries) { be2.hp -= (1 + (l.starburstLvl || 0) * 0.2) * rm; if (be2.hp <= 0 && !be2.dead) { be2.dead = true; killQueue.push({ e: be2, x: be2.x, y: be2.y, tier: be2.tier }); } }
          spawnExplosion(l.x, l.y, 0xffaa00, 14);
        }
        if (l.vortexstorm) {
          e.slowTimer = Math.max(e.slowTimer || 0, 0.5);
          e.hp -= (0.5 + (l.vortexstormLvl || 0) * 0.2) * rm;
          if (Math.random() < 0.3) {
            l.vx += (Math.random() - 0.5) * 30; l.vy += (Math.random() - 0.5) * 30;
            const spd = Math.sqrt(l.vx * l.vx + l.vy * l.vy);
            l.vx = (l.vx / spd) * l.speed; l.vy = (l.vy / spd) * l.speed;
          }
          spawnExplosion(l.x, l.y, 0x44ddff, 6);
        }
        if (l.prismsaber) {
          e.hp -= (0.5 + (l.prismsaberLvl || 0) * 0.1) * rm;
        }
        if (l.phantomflare) {
          e.slowTimer = Math.max(e.slowTimer || 0, 2 + (l.phantomflareLvl || 0) * 0.3);
          for (const pfe of enemies) { const pfd = Math.hypot(pfe.x - l.x, pfe.y - l.y); if (pfd < 60 && pfe !== e && pfe.y > 0) { pfe.slowTimer = Math.max(pfe.slowTimer || 0, 1 + (l.phantomflareLvl || 0) * 0.2); } }
        }
        if (l.oblivion) {
          e.hp -= (3 + (l.oblivionLvl || 0) * 0.8) * rm;
          for (const oe of enemies) {
            const od = Math.hypot(oe.x - l.x, oe.y - l.y);
            if (od < 80 + (l.oblivionLvl || 0) * 10 && oe !== e && oe.y > 0) {
              oe.x += (l.x - oe.x) / Math.max(od, 1) * 60 * dt;
              oe.y += (l.y - oe.y) / Math.max(od, 1) * 60 * dt;
            }
          }
          spawnExplosion(l.x, l.y, 0x440066, 15);
        }
        if (l.ufo) {
          e.hp -= (8 + (l.ufoLvl || 0) * 2.5) * rm;
          spawnExplosion(l.x, l.y, 0xff0044, 35);
          l.sprite.visible = false; laserPool.push(l.sprite); laserC.removeChild(l.sprite);
          l.dead = true;
          if (l.ufoAccent) { fxC.removeChild(l.ufoAccent); l.ufoAccent.destroy(); l.ufoAccent = null; }
          if (l.ufoCore) { fxC.removeChild(l.ufoCore); l.ufoCore.destroy(); l.ufoCore = null; }
          if (l.ufoRing) { fxC.removeChild(l.ufoRing); l.ufoRing.destroy(); l.ufoRing = null; }
          if (l.ufoGlow) { glowC.removeChild(l.ufoGlow); l.ufoGlow.destroy(); l.ufoGlow = null; }
          break;
        }
        if (l.phantom) {
          if (l.hitEnemies.indexOf(e) < 0) {
            l.hitEnemies.push(e);
            cannon.x = e.x + Math.cos(Math.atan2(cannon.y - e.y, cannon.x - e.x)) * 40;
            cannon.y = Math.max(eDT + (eDB - eDT) * 0.15, Math.min(eDT + (eDB - eDT) * 0.65, e.y - 40));
            cannonSprite.position.set(cannon.x, cannon.y);
            spawnExplosion(cannon.x, cannon.y, 0x8844ff, 12);
            e.hp -= (2 + l.phantomLvl) * rm;
          }
        }
        if (l.echo) {
          if (l.hitEnemies.indexOf(e) < 0) {
            l.hitEnemies.push(e);
            const near = enemies.filter(ne => ne !== e && Math.hypot(ne.x - e.x, ne.y - e.y) < 100 + l.echoLvl * 15);
            for (const ne of near) { ne.hp -= (0.5 + l.echoLvl * 0.2) * rm; spawnExplosion(ne.x, ne.y, 0x44ffaa, 4); }
          }
          wpnMul = 0.6 + l.echoLvl * 0.1;
        }
        if (l.tether) {
          if (l.hitEnemies.indexOf(e) < 0) {
            l.hitEnemies.push(e);
            l.tethered = l.tethered || [];
            l.tethered.push(e);
            let existing = tethers.find(t => t.laser === l);
            if (!existing) {
              const tg = new PIXI.Graphics();
              fxC.addChild(tg);
              tethers.push({ laser: l, targets: [e], life: 1.5 + l.tetherLvl * 0.3, maxLife: 1.5 + l.tetherLvl * 0.3, lvl: l.tetherLvl, gfx: tg, tickTimer: 0 });
            } else {
              existing.targets.push(e);
              existing.life = existing.maxLife;
            }
          }
          wpnMul = 0.5 + l.tetherLvl * 0.1;
        }
        if (l.shard && e.hp <= 0 && !e.shardTriggered) { e.shardTriggered = true;
          for (let s = 0; s < 2 + l.shardLvl; s++) {
            const sa = Math.random() * Math.PI * 2;
            const frag = mkLaser(sa, 0xffaa00, 0.6, false, e.x, e.y);
            if (frag) { frag.sprite.tint = 0xffaa00; frag.sprite.scale.set(0.75); frag.life = 0.3 + l.shardLvl * 0.03; frag.speed = LASER_SPEED * (1 + l.shardLvl * 0.1); frag.vx = Math.cos(sa) * frag.speed; frag.vy = Math.sin(sa) * frag.speed; }
          }
        }
        if (l.siphon) { const hpGain = Math.max(0.5, laserDmg * 0.15); health = Math.min(maxHealth, health + hpGain); updateUI(); }
        e.hp -= (laserDmg * saberMulti * wpnMul) * (e.armored && !l.pierce ? 0.3 : 1);
        if (l.hitEnemies && l.hitEnemies.indexOf(e) < 0) l.hitEnemies.push(e);
        if (!l.phantom) { playHitSnd(); const _ht = TIERS[e.tier]; if (_ht) { const hitCnt = specialWeapon ? 8 + Math.floor(Math.random() * 4) : 3; spawnExplosion(e.x, e.y, l.sprite.tint || _ht.cl[0], hitCnt); } }
        if (!l.pierce && !l.phantom && !l.mine) {
          l.sprite.visible = false; laserPool.push(l.sprite); laserC.removeChild(l.sprite);
          l.dead = true;
        }
        if (e.hp <= 0 && !e.dead) { e.dead = true;
          const t = TIERS[e.tier];
          if (!t) { killQueue.push({ e, x: e.x, y: e.y, tier: e.tier }); if (!l.pierce) break; continue; }
          const pts = t.pt;
          const n = performance.now();
          if (n - lastKillTime < 1500) combo++; else combo = 1;
          lastKillTime = n;
          score += pts * combo;
          try { if (typeof navigator.vibrate === 'function') navigator.vibrate(15 + Math.min(40, e.tier * 10)); } catch(e) {}
          if (l.saber && l.saberLvl >= 4) { score += pts * combo * 2; }
          playPopSnd(e.tier);
          spawnExplosion(e.x, e.y, tcl(t), 12 + e.tier * 4);
          if (l.saber && l.saberLvl >= 2) {
            spawnExplosion(e.x, e.y, 0xff4400, 16);
            for (let ei = enemies.length - 1; ei >= 0; ei--) {
              const oe = enemies[ei];
              const edx = oe.x - e.x, edy = oe.y - e.y;
              if (edx * edx + edy * edy < 50 * 50 && oe !== e) {
                oe.hp -= 2;
                if (oe.hp <= 0 && !oe.dead) { oe.dead = true; killQueue.push({ e: oe, x: oe.x, y: oe.y, tier: oe.tier }); }
              }
            }
          }
          spawnPowerup(e.x, e.y);
          if (Math.random() < ((DIFF[difficulty].dropChance || 0.4) * 0.08)) spawnSpecialPowerup(e.x, e.y);
          const txt = `+${pts * combo}`;
          const sz = Math.min(14 + e.tier * 5, 30);
          const tcol = t.cl[0] || 0xffffff;
          if (fxT.length < 30) {
            const ft = new PIXI.Text(txt, { fontFamily:'sans-serif', fontSize:sz, fontWeight:'900', fill:tcol, dropShadow:true, dropShadowColor:0xffffff, dropShadowBlur:4 });
            ft.anchor.set(0.5); ft.position.set(e.x + (Math.random() - 0.5) * 10, e.y - 20); ft.life = 1.0; ft.vy = -1.8;
            fxC.addChild(ft); fxT.push(ft);
          }
          killQueue.push({ e, x: e.x, y: e.y, tier: e.tier });
          // 15% chain: spawn 2 enemies at lower tier
          if (Math.random() < 0.15 && enemies.length < MAX_ENEMIES * 0.8) {
            for (let c = 0; c < 2; c++) {
              spawnEnemy(e.x + (Math.random() - 0.5) * 40, -10 - Math.random() * 30, Math.max(0, e.tier - 1));
            }
          }
        }
        if (!l.pierce) break;
      }
    }
  }

  // Beam weapon: continuous line sweep damage
  for (let bi = beamLasers.length - 1; bi >= 0; bi--) {
    const b = beamLasers[bi];
    b.life -= dt;
    if (b.life <= 0) { { beamLasers[bi] = beamLasers[beamLasers.length - 1]; beamLasers.pop(); } continue; }
    const sx = cannon.x, sy = cannon.y;
    const ex = sx + Math.cos(b.ang) * b.len;
    const ey = sy + Math.sin(b.ang) * b.len;
    for (let ei = enemies.length - 1; ei >= 0; ei--) {
      const e = enemies[ei];
      const ldx = ex - sx, ldy = ey - sy;
      const llen2 = ldx * ldx + ldy * ldy;
      if (llen2 > 1) {
        const edx = e.x - sx, edy = e.y - sy;
        const t = Math.max(0, Math.min(1, (edx * ldx + edy * ldy) / llen2));
        const px = sx + t * ldx, py = sy + t * ldy;
        const ddx = e.x - px, ddy = e.y - py;
        const hitR = e.size * 0.5 + 20;
        if (ddx * ddx + ddy * ddy < hitR * hitR) {
          const adj = e.shield > 0 ? WEAPONS.beam.shieldMul : WEAPONS.beam.wepMul;
          const dmg = Math.round((1 + Math.floor(Math.sqrt(wave))) * dCfg.dmgMul * (b.lvl + 1) * 0.5 * adj * (e.armored ? 0.3 : 1));
          e.hp -= dmg;
          spawnExplosion(e.x, e.y, 0x00ffff, 4);
          if (e.hp <= 0 && !e.dead) { e.dead = true;
            const t = TIERS[e.tier];
            if (!t) { killQueue.push({ e, x: e.x, y: e.y, tier: e.tier }); continue; }
            const pts = t.pt;
            score += pts * combo;
            playPopSnd(e.tier); spawnExplosion(e.x, e.y, t.cl[0], 8);
            spawnPowerup(e.x, e.y);
            killQueue.push({ e, x: e.x, y: e.y, tier: e.tier });
          }
        }
      }
    }
  }
  // Beam damage to boss
  if (boss) {
    const b = boss;
    for (let bi = beamLasers.length - 1; bi >= 0; bi--) {
      const bl = beamLasers[bi];
      const sx = cannon.x, sy = cannon.y;
      const ex = sx + Math.cos(bl.ang) * bl.len;
      const ey = sy + Math.sin(bl.ang) * bl.len;
      const ldx = ex - sx, ldy = ey - sy, llen2 = ldx * ldx + ldy * ldy;
      if (llen2 > 1) {
        const t = Math.max(0, Math.min(1, ((b.x - sx) * ldx + (b.y - sy) * ldy) / llen2));
        const px = sx + t * ldx, py = sy + t * ldy;
        if ((b.x - px) ** 2 + (b.y - py) ** 2 < (b.size ** 2)) {
          b.hp -= Math.round((1 + Math.floor(Math.sqrt(wave))) * dCfg.dmgMul * (bl.lvl + 1) * 0.5 * 0.7);
          spawnExplosion(b.x, b.y, 0x00ffff, 4);
          if (b.hp <= 0) { bossDefeated(); break; }
        }
      }
    }
  }

  // Beam damage to minibosses
  for (let mi = miniBosses.length - 1; mi >= 0; mi--) {
    const mb = miniBosses[mi];
    for (let bi = beamLasers.length - 1; bi >= 0; bi--) {
      const bl = beamLasers[bi];
      const sx = cannon.x, sy = cannon.y;
      const ex = sx + Math.cos(bl.ang) * bl.len, ey = sy + Math.sin(bl.ang) * bl.len;
      const ldx = ex - sx, ldy = ey - sy, llen2 = ldx * ldx + ldy * ldy;
      if (llen2 > 1) {
        const t = Math.max(0, Math.min(1, ((mb.x - sx) * ldx + (mb.y - sy) * ldy) / llen2));
        const px = sx + t * ldx, py = sy + t * ldy;
        if ((mb.x - px) ** 2 + (mb.y - py) ** 2 < (mb.size ** 2)) {
          mb.hp -= Math.round((1 + Math.floor(Math.sqrt(wave))) * dCfg.dmgMul * (bl.lvl + 1) * 0.5 * 0.5);
          spawnExplosion(mb.x, mb.y, 0x00ffff, 3);
          if (mb.hp <= 0) {
            mb.sprite.visible = false; enemyPool.push(mb.sprite); enemyC.removeChild(mb.sprite);
            if (mb.spriteCore) { mb.spriteCore.visible = false; enemyPool.push(mb.spriteCore); enemyC.removeChild(mb.spriteCore); }
            if (mb.spriteRing) { mb.spriteRing.visible = false; enemyPool.push(mb.spriteRing); enemyC.removeChild(mb.spriteRing); }
            if (mb.sparkle) { glowC.removeChild(mb.sparkle); mb.sparkle.destroy(); }
            if (mb.glow) { glowC.removeChild(mb.glow); mb.glow.destroy(); }
            if (mb.chromaR) { glowC.removeChild(mb.chromaR); mb.chromaR.destroy(); }
            if (mb.chromaB) { glowC.removeChild(mb.chromaB); mb.chromaB.destroy(); }
            spawnExplosion(mb.x, mb.y, 0xff8800, 20); score += 200;
            miniBosses[mi] = miniBosses[miniBosses.length - 1]; miniBosses.pop();
          }
        }
      }
    }
  }
  // Gem hit detection (lasers hitting gems)
  for (let gi = gems.length - 1; gi >= 0; gi--) {
    const g = gems[gi];
    const cx = Math.floor(g.x / 60), cy = Math.floor(g.y / 60);
    const nearbyLasers = [];
    for(let dx=-1;dx<=1;dx++) for(let dy=-1;dy<=1;dy++) {
      const arr = LASER_GRID.get((cx+dx)+','+(cy+dy));
      if(arr) nearbyLasers.push(...arr);
    }
    for (let j = 0; j < nearbyLasers.length; j++) {
      const l = nearbyLasers[j];
      if (l.dead) continue;

      const dx = g.x - l.x, dy = g.y - l.y;
      if (dx * dx + dy * dy < 400) {
        const pts = GEM_VALUE;
        const ft = new PIXI.Text(`+${pts}`, {
          fontFamily: 'sans-serif', fontSize: 14, fontWeight: '900',
          fill: 0xffdd44, dropShadow: true, dropShadowColor: 0xffffff, dropShadowBlur: 6
        });
        ft.anchor.set(0.5); ft.position.set(g.x, g.y - 10); ft.life = 0.8; ft.vy = -1.2;
        fxC.addChild(ft); fxT.push(ft);
        hitGem(gi);
          if (l.ion) {
              spawnExplosion(g.x, g.y, 0x00aaff, 20);
              for (const oe of enemies) {
                  if (Math.hypot(oe.x - g.x, oe.y - g.y) < 150) {
                      oe.hp -= 20;
                      oe.slowTimer = 3;
                  }
              }
          }
        if (!l.pierce) {
          l.sprite.visible = false; laserPool.push(l.sprite); laserC.removeChild(l.sprite);
          l.dead = true;
        }
        break;
      }
    }
  }

  if (superWaveTimer > 0) superWaveTimer -= dt;

  // Damage boss
  if (boss) {
    const b = boss;
    for (const l of lasers) {
      if (l.dead || l.beam) continue;
      const dx = b.x - l.x, dy = b.y - l.y;
      if (dx * dx + dy * dy < (b.size + 10) * (b.size + 10)) {
        const dmg = Math.round((1 + Math.floor(Math.sqrt(wave))) * dCfg.dmgMul * (l.cannonMul || 1));
        b.hp -= dmg;
        spawnExplosion(b.x, b.y, 0xff0044, 4);
        if (b.hp <= 0) { bossDefeated(); break; }
        if (!l.pierce && !l.mine) { l.sprite.visible = false; laserPool.push(l.sprite); laserC.removeChild(l.sprite); l.dead = true; }
        break;
      }
    }
  }
  // Damage minibosses
  for (let mi = miniBosses.length - 1; mi >= 0; mi--) {
    const mb = miniBosses[mi];
    for (const l of lasers) {
      if (l.dead || l.beam) continue;
      const dx = mb.x - l.x, dy = mb.y - l.y;
      if (dx * dx + dy * dy < (mb.size + 8) * (mb.size + 8)) {
        mb.hp -= Math.round((1 + Math.floor(Math.sqrt(wave))) * dCfg.dmgMul * 0.7);
        spawnExplosion(mb.x, mb.y, 0xff8800, 3);
        if (mb.hp <= 0) {
          mb.sprite.visible = false; enemyPool.push(mb.sprite); enemyC.removeChild(mb.sprite);
          if (mb.spriteCore) { mb.spriteCore.visible = false; enemyPool.push(mb.spriteCore); enemyC.removeChild(mb.spriteCore); }
          if (mb.spriteRing) { mb.spriteRing.visible = false; enemyPool.push(mb.spriteRing); enemyC.removeChild(mb.spriteRing); }
          if (mb.sparkle) { glowC.removeChild(mb.sparkle); mb.sparkle.destroy(); }
          if (mb.glow) { glowC.removeChild(mb.glow); mb.glow.destroy(); }
          if (mb.chromaR) { glowC.removeChild(mb.chromaR); mb.chromaR.destroy(); }
          if (mb.chromaB) { glowC.removeChild(mb.chromaB); mb.chromaB.destroy(); }
          spawnExplosion(mb.x, mb.y, 0xff8800, 20);
          score += 200;
          miniBosses[mi] = miniBosses[miniBosses.length - 1]; miniBosses.pop();
        }
        if (!l.pierce && !l.mine) { l.sprite.visible = false; laserPool.push(l.sprite); laserC.removeChild(l.sprite); l.dead = true; }
        break;
      }
    }
  }
  // Update boss
  updateBoss(dt, now);
  updateMiniBosses(dt, now);
  if (boss) updateBossSwarm(dt, now);

  // Update enemy bullets
  for (let i = enemyBullets.length - 1; i >= 0; i--) {
    const b = enemyBullets[i];
    b.x += b.vx * dt; b.y += b.vy * dt;
    if (b.isMine) {
      b.mineTimer += dt;
      b.sprite.alpha = 0.5 + Math.sin(b.mineTimer * 10) * 0.5;
      if (b.glow) b.glow.alpha = b.sprite.alpha * 0.8;
      const dist = Math.hypot(cannon.x - b.x, cannon.y - b.y);
      if (dist < 150) {
        b.vx += ((cannon.x - b.x) / dist) * 80 * dt;
        b.vy += ((cannon.y - b.y) / dist) * 80 * dt;
        b.vx *= 0.95; b.vy *= 0.95;
      }
    } else if (b.homing) {
      const ha = Math.atan2(cannon.y - b.y, cannon.x - b.x);
      const ca = Math.atan2(b.vy, b.vx);
      let hDiff = ha - ca;
      while (hDiff > Math.PI) hDiff -= Math.PI * 2;
      while (hDiff < -Math.PI) hDiff += Math.PI * 2;
      const turnRate = 1.8;
      const na = ca + Math.max(-turnRate * dt, Math.min(turnRate * dt, hDiff));
      b.vx = Math.cos(na) * b.speed;
      b.vy = Math.sin(na) * b.speed;
    }
    const z = gameC ? gameC.scale.x || 1 : 1;
    const cx = gameC ? gameC.x : 0;
    const cy = gameC ? gameC.y : 0;
    const bDropLeft = -cx / z;
    const bDropRight = (width - cx) / z;
    const bDropTop = -cy / z;
    const bDropBottom = (height - cy) / z;
    if (b.bounce && b.bounces > 0) {
      if (b.x < bDropLeft + 5 || b.x > bDropRight - 5) { b.vx = -b.vx; b.bounces--; b.x = Math.max(bDropLeft, Math.min(bDropRight, b.x)); b.tint = 0xff88ff; }
      if (b.y < bDropTop - 20 || b.y > bDropBottom + 10) { b.vy = -b.vy; b.bounces--; b.y = Math.max(bDropTop - 20, Math.min(bDropBottom + 10, b.y)); b.tint = 0xff88ff; }
      b.sprite.tint = b.tint || 0xff6644;
    }
    b.sprite.position.set(b.x, b.y);
    if (b.glow) { b.glow.position.set(b.x, b.y); b.glow.alpha = 0.3 + Math.sin(now * 0.01 + i) * 0.15; }
    if (b.x < bDropLeft - 10 || b.x > bDropRight + 10 || b.y > bDropBottom + 20 || b.y < bDropTop - 20) {
      if (b.y > bDropBottom + 20) {
        if (hull > 0) {
          hull -= 10;
          hullDamageAccum += 10;
          while (hullDamageAccum >= 10) {
            hullDamageAccum -= 10;
            people = Math.max(0, people - 15);
          }
          if (hull <= 0) { hull = 0; gameState = 'gameover'; gameOverTime = performance.now(); showGameOver(); }
          updateUI();
        }
      }
      if (b.glow) { b.glow.visible = false; eBulletGlowPool.push(b.glow); glowC.removeChild(b.glow); }
      b.sprite.visible = false; enemyBulletPool.push(b.sprite); enemyBulletC.removeChild(b.sprite);
      { enemyBullets[i] = enemyBullets[enemyBullets.length - 1]; enemyBullets.pop(); }
      continue;
    }
    const dx = b.x - cannon.x, dy = b.y - cannon.y;
    const hitRadius = b.isMine ? 30 : 22;
    if (dx * dx + dy * dy < hitRadius * hitRadius) {
      if (b.glow) { b.glow.visible = false; eBulletGlowPool.push(b.glow); glowC.removeChild(b.glow); }
      b.sprite.visible = false; enemyBulletPool.push(b.sprite); enemyBulletC.removeChild(b.sprite);
      { enemyBullets[i] = enemyBullets[enemyBullets.length - 1]; enemyBullets.pop(); }
      takeDamage();
      continue;
    }
    for (let pi = powerups.length - 1; pi >= 0; pi--) {
      const pu = powerups[pi];
      const pdx = pu.x - b.x, pdy = pu.y - b.y;
      if (pdx * pdx + pdy * pdy < 20 * 20) {
        if (b.glow) { b.glow.visible = false; eBulletGlowPool.push(b.glow); glowC.removeChild(b.glow); }
        if (b.sourceEnemy && enemies.indexOf(b.sourceEnemy) >= 0) {
          buffEnemy(b.sourceEnemy);
        }
        b.sprite.visible = false; enemyBulletPool.push(b.sprite); enemyBulletC.removeChild(b.sprite);
        { enemyBullets[i] = enemyBullets[enemyBullets.length - 1]; enemyBullets.pop(); }
        destroyPowerup(pu);
        break;
      }
    }
  }

  // Update powerups
  const puz = gameC ? gameC.scale.x || 1 : 1;
  const puCx = gameC ? gameC.x : 0;
  const puCy = gameC ? gameC.y : 0;
  const puB = (height - puCy) / puz;
  for (let i = powerups.length - 1; i >= 0; i--) {
    const pu = powerups[i];
    pu.x += Math.sin(now * 0.004 + pu.phase) * 0.8;
    pu.x += Math.cos(now * 0.002 + pu.phase) * 0.4;
    const pdx = cannon.x - pu.x;
    pu.x += Math.sign(pdx) * Math.min(Math.abs(pdx) * 0.005, 18) * dt;
    pu.y += pu.vy * dt;
    pu.vy += 40 * dt;
    pu.vy = Math.min(pu.vy, 120);
    pu.sprite.position.set(pu.x, pu.y);
    const pulse = Math.sin(now * 0.005 + pu.phase) * 0.5 + 0.5;
    const pul = 0.5 + pulse * 0.5;
    pu.sprite.alpha = 0.6 + pul * 0.4;
    pu.sprite.scale.set((7 + pulse * 3) / 4);
    pu.sprite.tint = pu.isShield ? 0x88ff88 : (Math.floor(Math.random() * 4) ? pu.sprite.tint : rcol());
    if (pu.puSparkle) {
      const ss = 0.2 + pulse * 0.8;
      pu.puSparkle.alpha = ss * 0.6;
      pu.puSparkle.scale.set((5 + pulse * 4) / 4);
      pu.puSparkle.position.set(pu.x, pu.y);
      pu.puSparkle.rotation = now * 0.005 + pu.phase;
      pu.puSparkle.tint = rcol();
    }
    if (pu.puChromaR || pu.puChromaB) {
      const ss = 0.2 + pulse * 0.8;
      if (pu.puChromaR) {
        pu.puChromaR.alpha = ss * 0.35;
        pu.puChromaR.scale.set((4 + pulse * 3) / 4);
        pu.puChromaR.position.set(pu.x - 3 - pulse * 3, pu.y - 1 - pulse * 0.5);
      }
      if (pu.puChromaB) {
        pu.puChromaB.alpha = ss * 0.35;
        pu.puChromaB.scale.set((4 + pulse * 3) / 4);
        pu.puChromaB.position.set(pu.x + 3 + pulse * 3, pu.y + 1 + pulse * 0.5);
      }
    }
    if (pu.neonDot) {
      const neonAngle = now * 0.003 + pu.phase;
      const neonR = 8 + pulse * 6;
      const neonS = 2 + pulse * 2;
      pu.neonDot.alpha = 0.4 + pulse * 0.5;
      pu.neonDot.scale.set(neonS);
      pu.neonDot.position.set(pu.x + Math.cos(neonAngle) * neonR, pu.y + Math.sin(neonAngle) * neonR);
      pu.neonDot.tint = Math.floor(Math.random() * 4) ? pu.neonDot.tint : pu.neonC[0];
      pu.neonDot2.alpha = 0.3 + pulse * 0.4;
      pu.neonDot2.scale.set(neonS * 0.6);
      pu.neonDot2.position.set(pu.x + Math.cos(neonAngle + Math.PI) * neonR, pu.y + Math.sin(neonAngle + Math.PI) * neonR);
      pu.neonDot2.tint = Math.floor(Math.random() * 4) ? pu.neonDot2.tint : pu.neonC[1];
    }
    if (pu.sparkles) {
      for (const sp of pu.sparkles) {
        const rad = sp.radius * (0.8 + pulse * 0.4);
        sp.sprite.position.set(pu.x + Math.cos(sp.angle + now * sp.speed * 0.001) * rad, pu.y + Math.sin(sp.angle + now * sp.speed * 0.001) * rad);
        sp.sprite.alpha = 0.2 + pulse * 0.6;
        sp.sprite.scale.set((0.5 + pul * 0.5));
        sp.sprite.tint = rcol();
      }
    }
    // Shield auto-magnetize toward player
    if (pu.isShield) {
      const mx = cannon.x - pu.x, my = cannon.y - pu.y;
      const md = Math.sqrt(mx * mx + my * my);
      if (md < 130) {
        const pull = 90 / Math.max(md, 8);
        pu.x += (mx / md) * pull;
        pu.y += (my / md) * pull;
        pu.sprite.tint = 0xffff88;
      }
    }
    
    const cx = Math.floor(pu.x / 60), cy = Math.floor(pu.y / 60);
    const nearbyLasers = [];
    for(let dx=-1;dx<=1;dx++) for(let dy=-1;dy<=1;dy++) {
      const arr = LASER_GRID.get((cx+dx)+','+(cy+dy));
      if(arr) nearbyLasers.push(...arr);
    }
    for (let j = 0; j < nearbyLasers.length; j++) {
      const l = nearbyLasers[j];
      if (l.dead) continue;

      const ldx = pu.x - l.x, ldy = pu.y - l.y;
      if (ldx * ldx + ldy * ldy < 20 * 20) {
        collectPowerup(pu);
        l.sprite.visible = false; laserPool.push(l.sprite); laserC.removeChild(l.sprite);
        l.dead = true;
        break;
      }
    }
    // Enemy can steal floating powerups
    if (powerups.indexOf(pu) >= 0) {
      for (let ei = enemies.length - 1; ei >= 0; ei--) {
        const e = enemies[ei];
        const edx = pu.x - e.x, edy = pu.y - e.y;
        if (edx * edx + edy * edy < (e.size + 50) * (e.size + 50)) {
          e.buffed = true;
          e.buffedTimer = 8;
          e.enemyWeapon = 'blaster';
          e.weaponFireTimer = 1 + Math.random() * 0.5;
          e.hp = Math.min(e.hp + 5, (e.baseHP||1) * 3);
          e.slowTimer = 0;
          spawnExplosion(pu.x, pu.y, 0xff8800, 20);
          spawnExplosion(pu.x, pu.y, 0xff4400, 12);
          puCleanupGlow(pu); pu.sprite.visible = false; puPool.push(pu.sprite); puC.removeChild(pu.sprite);
          { powerups[i] = powerups[powerups.length - 1]; powerups.pop(); } pu._stolen = true;
          break;
        }
      }
    }
    if (pu._stolen) continue;
    if (pu.y > puB + 20) {
      puCleanupGlow(pu); pu.sprite.visible = false; puPool.push(pu.sprite); puC.removeChild(pu.sprite);
      { powerups[i] = powerups[powerups.length - 1]; powerups.pop(); }
    }
  }

  for (let i = fxT.length - 1; i >= 0; i--) {
    const t = fxT[i]; 
    if (t) {
        t.y += t.vy; 
        t.life -= 0.028;
        if (t.alpha !== undefined) t.alpha = Math.max(0, t.life * 2);
        if (t.life <= 0) { 
            if (!t.destroyed) { fxC.removeChild(t); if(t.destroy) t.destroy(); }
            fxT[i] = fxT[fxT.length - 1]; fxT.pop(); 
        }
    } else {
        fxT[i] = fxT[fxT.length - 1]; fxT.pop();
    }
  }

  for (let i = beams.length - 1; i >= 0; i--) {
    beams[i].life -= 0.018;
    if (beams[i].life <= 0) {
      fxC.removeChild(beams[i].graphic);
      beams[i].graphic.destroy();
      { beams[i] = beams[beams.length - 1]; beams.pop(); }
    }
  }

  // Persistent weapon effects
  for (let mi = mines.length - 1; mi >= 0; mi--) {
    const m = mines[mi];
    m.armTimer -= dt;
    if (m.armTimer <= 0) m.armed = true;
    let detonate = false;
    for (const e of enemies) {
      const d = Math.hypot(e.x - m.x, e.y - m.y);
      if (d < m.radius) { detonate = true; break; }
    }
    if (detonate) {
      const killed = [];
      for (let ei = enemies.length - 1; ei >= 0; ei--) {
        const e = enemies[ei];
        const d = Math.hypot(e.x - m.x, e.y - m.y);
        if (d < m.radius + e.size * 0.5) {
          const dmg = 3 + m.lvl * 2;
          e.hp -= dmg;
          if (e.hp <= 0 && !e.dead) { e.dead = true;
            liquidationCount++; score += Math.floor((e.baseHP || 10) * 5 * (1 + wave * 0.1) * (difficulty === 'hardcore' ? 2.5 : difficulty === 'hard' ? 1.5 : 1)) * combo; spawnExplosion(e.x, e.y, 0xff6600, 10);
            spawnPowerup(e.x, e.y);
            killQueue.push({ e, x: e.x, y: e.y, tier: e.tier });
          }
        }
      }
      spawnExplosion(m.x, m.y, 0xff8800, 20);
      fxC.removeChild(m.gfx); m.gfx.destroy(); { mines[mi] = mines[mines.length - 1]; mines.pop(); }
      continue;
    }
    m.life -= dt;
    if (m.life <= 0) { fxC.removeChild(m.gfx); m.gfx.destroy(); { mines[mi] = mines[mines.length - 1]; mines.pop(); } }
  }
  for (let zi = zones.length - 1; zi >= 0; zi--) {
    const z = zones[zi];
    z.dmgTimer += dt;
    if (z.dmgTimer > 0.3) {
      z.dmgTimer = 0;
      for (let ei = enemies.length - 1; ei >= 0; ei--) {
        const e = enemies[ei];
        const d = Math.hypot(e.x - z.x, e.y - z.y);
        if (d < z.radius) {
          if (z.time) {
            e.slowTimer = Math.max(e.slowTimer || 0, 1 + z.lvl * 0.3);
          } else if (z.nebula) {
            e.hp -= 0.5 + z.lvl * 0.3;
            e.slowTimer = Math.max(e.slowTimer || 0, 0.5 + z.lvl * 0.2);
            if (e.hp <= 0 && !e.dead) { e.dead = true; liquidationCount++; score += Math.floor((e.baseHP || 10) * 5 * (1 + wave * 0.1) * (difficulty === 'hardcore' ? 2.5 : difficulty === 'hard' ? 1.5 : 1)) * combo; spawnExplosion(e.x, e.y, 0xff88aa, 6); killQueue.push({ e, x: e.x, y: e.y, tier: e.tier }); }
          } else {
            e.hp -= 1 + z.lvl * 0.5; if (e.hp <= 0 && !e.dead) { e.dead = true; liquidationCount++; score += Math.floor((e.baseHP || 10) * 5 * (1 + wave * 0.1) * (difficulty === 'hardcore' ? 2.5 : difficulty === 'hard' ? 1.5 : 1)) * combo; spawnExplosion(e.x, e.y, 0x4488ff, 8); killQueue.push({ e, x: e.x, y: e.y, tier: e.tier }); }
            // Gravitational pull toward center
            const pull = 80 / Math.max(d, 5);
            e.vx += (z.x - e.x) / d * pull; e.vy += (z.y - e.y) / d * pull;
          }
        }
      }
    }
    for (let bi = bossMinis.length - 1; bi >= 0; bi--) {
      const bm = bossMinis[bi]; const bd = Math.hypot(bm.x - z.x, bm.y - z.y);
      if (bd < z.radius) { if (bm.sparkle) { glowC.removeChild(bm.sparkle); bm.sparkle.destroy(); } if (bm.glow) { glowC.removeChild(bm.glow); bm.glow.destroy(); } if (bm.accent) { bm.accent.visible = false; enemyPool.push(bm.accent); enemyC.removeChild(bm.accent); } bm.sprite.visible = false; enemyPool.push(bm.sprite); enemyC.removeChild(bm.sprite); { bossMinis[bi] = bossMinis[bossMinis.length - 1]; bossMinis.pop(); } }
    }
    // Merge overlapping void zones
    if (!z.time && !z.nebula) {
      for (let zj = zi - 1; zj >= 0; zj--) {
        const oz = zones[zj];
        if (oz.time || oz.nebula) continue;
        const zd = Math.hypot(z.x - oz.x, z.y - oz.y);
        const mergeR = (z.radius + oz.radius) * 0.6;
        if (zd < mergeR) {
          // Absorb smaller into larger
          if (z.radius >= oz.radius) {
            z.radius = Math.min(z.radius + oz.radius * 0.3, 160);
            z.lvl = Math.max(z.lvl, oz.lvl);
            z.x = (z.x + oz.x) / 2; z.y = (z.y + oz.y) / 2;
            if (oz.gfx) { fxC.removeChild(oz.gfx); oz.gfx.destroy(); }
            { zones[zj] = zones[zones.length - 1]; zones.pop(); }
          }
        }
      }
    }
    z.life -= dt;
    const fade = Math.min(1, z.life / 2);
    if (z.gfx) {
      if (z.nebula) {
        const pulse = 1 + Math.sin(performance.now() * 0.001 + zi * 2) * 0.06;
        z.gfx.scale.set(pulse * (1 + (1 - fade) * 0.2));
        z.gfx.alpha = fade * (0.6 + 0.4 * Math.sin(performance.now() * 0.0015 + zi));
      } else if (!z.time) {
        const pulse = 1 + Math.sin(performance.now() * 0.003 + zi) * 0.04;
        z.gfx.scale.set(pulse * (1 + (1 - fade) * 0.3));
      } else {
        z.gfx.scale.set((1 + (1 - fade) * 0.3));
      }
      z.gfx.alpha = fade;
    }
    if (z.life <= 0) { fxC.removeChild(z.gfx); z.gfx.destroy(); { zones[zi] = zones[zones.length - 1]; zones.pop(); } }
  }
  for (let si = satellites.length - 1; si >= 0; si--) {
    const s = satellites[si];
    s.angle += s.speed * dt;
    s.x = cannon.x + Math.cos(s.angle) * 40;
    s.y = cannon.y - 30 + Math.sin(s.angle) * 20;
    s.gfx.position.set(s.x, s.y);
    s.fireTimer -= dt;
    if (s.fireTimer <= 0) {
      s.fireTimer = s.fireInterval;
      const nearest = enemies.reduce((b, e) => { const d = Math.hypot(e.x - s.x, e.y - s.y); return d < b.d && e.y > 0 ? { d, e } : b; }, { d: Infinity, e: null }).e;
      if (nearest) {
        const a = Math.atan2(nearest.y - s.y, nearest.x - s.x);
        const b = mkLaser(a, 0xffdd00, 1);
        if (b) { b.sprite.tint = 0xffdd00; b.homing = true; b.speed = LASER_SPEED * 0.8; b.life = 0.6; }
      }
    }
    s.life -= dt;
    if (s.life <= 0) { fxC.removeChild(s.gfx); s.gfx.destroy(); { satellites[si] = satellites[satellites.length - 1]; satellites.pop(); } }
  }
  for (let ti = tethers.length - 1; ti >= 0; ti--) {
    const t = tethers[ti];
    t.life -= dt;
    if (t.gfx) { t.gfx.clear(); if (t.targets.length >= 2) { t.gfx.lineStyle(2, 0xff4488, t.life / t.maxLife * 0.5); for (let k = 0; k < t.targets.length - 1; k++) { t.gfx.moveTo(t.targets[k].x, t.targets[k].y); t.gfx.lineTo(t.targets[k+1].x, t.targets[k+1].y); } } }
    if (t.life <= 0) { fxC.removeChild(t.gfx); t.gfx.destroy(); { tethers[ti] = tethers[tethers.length - 1]; tethers.pop(); } continue; }
    // tick damage along tether
    t.tickTimer -= dt;
    if (t.tickTimer <= 0) { t.tickTimer = 0.2; for (let ei = enemies.length - 1; ei >= 0; ei--) { const et = enemies[ei]; if (t.targets.indexOf(et) >= 0) { et.hp -= 0.5 + t.lvl * 0.3; if (et.hp <= 0 && !et.dead) { et.dead = true; score += Math.floor((et.baseHP || 10) * 5 * (1 + wave * 0.1) * (difficulty === 'hardcore' ? 2.5 : difficulty === 'hard' ? 1.5 : 1)) * combo; spawnExplosion(et.x, et.y, 0xff4488, 8); killQueue.push({ e: et, x: et.x, y: et.y, tier: et.tier }); } } } }
  }

  updateFX(dt);
} catch(err) { console.error("Ticker err", err.stack); } });

// Check for saved game on page load
showContinueOption();

// Capacitor lifecycle: save on pause, stop ticker
try { if (window.Capacitor && Capacitor.Plugins) { const capApp = Capacitor.Plugins.App; if (capApp) { capApp.addListener('pause', () => { if (gameState === 'playing' || gameState === 'map') saveGameState(); if (app && app.ticker) app.ticker.stop(); if (window.bgmEngine) window.bgmEngine.stop(); }); capApp.addListener('resume', () => { if (gameState === 'playing' || gameState === 'map') { if (app && app.ticker) app.ticker.start(); if (window.bgmEngine) window.bgmEngine.start(); } }); } } } catch(e) { console.error('Capacitor lifecycle', e); }

window.addEventListener('resize', () => {});




document.getElementById('musicVolumePause').addEventListener('input', (e) => {
    const vol = e.target.value / 100;
    localStorage.setItem('cosmicBlastMusicVolume', vol);
    if (window.setMusicVolume) window.setMusicVolume(vol);
});

// Load saved volume
const savedVol = localStorage.getItem('cosmicBlastMusicVolume');
if (savedVol !== null) {
    document.getElementById('musicVolumePause').value = savedVol * 100;
}

// Start intro music on first user interaction
window.addEventListener('pointerdown', () => {
  if (typeof initAdvancedAudio === "function") initAdvancedAudio();
}, { once: true });


// --- CRAWL LIFECYCLE ---
function initCrawl() {
  const crawl = document.getElementById('crawlOverlay');
  const skipBtn = document.getElementById('skipCrawlBtn');
  const titlePopup = document.getElementById('crawlTitlePopup');
  
  if (!crawl) return;
  

  
  // Show popup at 25 seconds
  let popupTimer = setTimeout(() => {
      if (titlePopup) {
          titlePopup.style.transition = "opacity 2s ease-in";
          titlePopup.style.opacity = "1";
      }
  }, 25000);
  
  let skipped = false;
  const endCrawl = () => {
      if (skipped) return;
      skipped = true;
      clearTimeout(popupTimer);
      crawl.style.transition = "opacity 1s ease";
      crawl.style.opacity = "0";
      setTimeout(() => {
          crawl.classList.remove('show');
          crawl.style.display = 'none';
          showContinueOption();
          diffOverlay.classList.add('show');
      }, 1000);
      
  };
  
  if (skipBtn) {
      skipBtn.addEventListener('pointerdown', (e) => {
          e.stopPropagation();
          endCrawl();
      });
  }
  
  // Auto-end after 62 seconds (60s animation + 2s buffer)
  setTimeout(endCrawl, 62000);
}


const startGameBtn = document.getElementById('startGameBtn');
if (startGameBtn) {
    const startAction = (e) => {
        if (e) {
            e.stopPropagation();
            e.preventDefault();
        }
        document.getElementById('titleScreenOverlay').classList.remove('show');
        document.getElementById('titleScreenOverlay').style.display = 'none';
        
        const crawl = document.getElementById('crawlOverlay');
        crawl.style.display = 'flex';
        crawl.classList.add('show');
        
        try { initAdvancedAudio(); } catch(err) { console.log(err); }
        initCrawl();
    };
    startGameBtn.addEventListener('pointerdown', startAction);
    startGameBtn.addEventListener('touchstart', startAction);
    startGameBtn.addEventListener('click', startAction);
}
