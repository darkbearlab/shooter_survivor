// Character definitions — add new characters here, nothing else needs to change.
// Each character needs: id, name, description, baseStats, passive

export const CHARACTERS = [
  {
    id: 'ranger',
    name: 'RANGER',
    description: 'Battle-hardened operative. Balanced stats with deadly combat instincts.',
    baseStats: {
      maxHp: 150,
      maxArmor: 50,
      moveSpeed: 1.0,       // multiplier
      damageMultiplier: 1.0,
      reloadMultiplier: 1.0,
    },
    passive: {
      id: 'combat_instinct',
      name: 'Combat Instinct',
      description: 'After 3 consecutive kills, next shot deals 2× damage.',
      // Logic lives in player.js — read passive.id to conditionally apply
    },
    activeSkill: {
      id: 'grenade',
      name: 'GRENADE',
      cooldown: 8,           // seconds
      description: 'Throw a grenade. Bounces off walls, detonates after 3s.',
    },
    startingWeapons: ['shotgun', 'rocket'],
  },
  {
    id: 'soldier',
    name: 'SOLDIER',
    description: 'Heavy-weapons specialist. More HP and armor, sustained suppressing fire.',
    baseStats: {
      maxHp: 180,
      maxArmor: 75,
      moveSpeed: 0.9,
      damageMultiplier: 1.1,
      reloadMultiplier: 0.9,
    },
    passive: {
      id: 'heavy_armor',
      name: 'Heavy Armor',
      description: 'Armor absorbs 80% of incoming damage instead of 67%.',
    },
    activeSkill: {
      id: 'grenade',
      name: 'GRENADE',
      cooldown: 8,
      description: 'Throw a grenade. Bounces off walls, detonates after 3s.',
    },
    startingWeapons: ['machinegun', 'nailgun'],
  },
];

export function getCharacter(id) {
  return CHARACTERS.find(c => c.id === id);
}
