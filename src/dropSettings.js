// Tunable drop parameters — mutated directly by BalanceMenu, read by main.js.

export const DROP_SETTINGS = {
  enemyDropChance:  0.45,   // base probability any enemy drops something (non-boss)
  ammoDropWeight:   0.55,   // share of drops that are ammo (rest split between hp/armor)
  ammoMultiplier:   1.0,    // multiplier on all ammo amounts
  resourceAmmoMult: 1.0,    // multiplier on resource-node ammo amounts
};
