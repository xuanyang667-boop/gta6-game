// Seeded RNG (SplitMix64) — one seed reproduces one world, so a city, its
// traffic and its missions replay exactly. No Math.random in generation code.
export class Rng {
  constructor(seed) {
    this.state = (BigInt(seed >>> 0) + 0x9e3779b97f4a7c15n) & 0xffffffffffffffffn;
  }
  nextU64() {
    this.state = (this.state + 0x9e3779b97f4a7c15n) & 0xffffffffffffffffn;
    let z = this.state;
    z = ((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n) & 0xffffffffffffffffn;
    z = ((z ^ (z >> 27n)) * 0x94d049bb133111ebn) & 0xffffffffffffffffn;
    return z ^ (z >> 31n);
  }
  // Float in [0, 1).
  next() {
    return Number(this.nextU64() >> 11n) / 9007199254740992;
  }
  // Integer in [0, n).
  below(n) {
    return Math.floor(this.next() * n);
  }
  // Integer in [min, max] inclusive.
  range(min, max) {
    return min + this.below(max - min + 1);
  }
  pick(list) {
    return list[this.below(list.length)];
  }
  chance(p) {
    return this.next() < p;
  }
  // Child stream per system, so adding a roll in one system never reshuffles another.
  child(salt) {
    return new Rng((this.below(0x7fffffff) ^ (salt * 2654435761)) >>> 0);
  }
}

// Deterministic hash of a string -> seed integer (for named seeds).
export function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
