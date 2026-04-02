// SaveSystem — localStorage persistence for high scores and balance settings.
//
// Keys:
//   shooter_survivor_scores   — JSON array of ScoreEntry (max 10)
//   shooter_survivor_balance  — JSON snapshot of { characters, weapons, enemies } values
//
// Usage:
//   SaveSystem.saveScore({ charId, charName, wave, kills, score })
//   SaveSystem.getScores()           → ScoreEntry[] sorted by score desc
//   SaveSystem.getBestForChar(id)    → ScoreEntry | null
//   SaveSystem.saveBalance(snapshot) → void
//   SaveSystem.loadBalance()         → snapshot | null
//   SaveSystem.clearAll()            → void

const KEY_SCORES  = 'shooter_survivor_scores';
const KEY_BALANCE = 'shooter_survivor_balance';
const MAX_ENTRIES = 10;

export const SaveSystem = {

  // ── Scores ───────────────────────────────────────────────────────────────────

  saveScore({ charId, charName, wave, kills, score }) {
    const entries = this.getScores();
    entries.push({
      charId, charName, wave, kills, score,
      date: new Date().toISOString(),
    });
    // Keep top MAX_ENTRIES by score
    entries.sort((a, b) => b.score - a.score);
    entries.splice(MAX_ENTRIES);
    try {
      localStorage.setItem(KEY_SCORES, JSON.stringify(entries));
    } catch (_) { /* storage full or unavailable */ }
  },

  getScores() {
    try {
      return JSON.parse(localStorage.getItem(KEY_SCORES) ?? '[]');
    } catch (_) { return []; }
  },

  getBestForChar(charId) {
    return this.getScores().find(e => e.charId === charId) ?? null;
  },

  // ── Balance ───────────────────────────────────────────────────────────────────

  /**
   * snapshot shape mirrors BalanceMenu._snapshot():
   *   { characters: [{ id, stats }], weapons: { id: defCopy }, enemies: { id: defCopy } }
   */
  saveBalance(snapshot) {
    try {
      localStorage.setItem(KEY_BALANCE, JSON.stringify(snapshot));
    } catch (_) {}
  },

  loadBalance() {
    try {
      const raw = localStorage.getItem(KEY_BALANCE);
      return raw ? JSON.parse(raw) : null;
    } catch (_) { return null; }
  },

  // ── Clear ────────────────────────────────────────────────────────────────────

  clearAll() {
    localStorage.removeItem(KEY_SCORES);
    localStorage.removeItem(KEY_BALANCE);
  },
};
