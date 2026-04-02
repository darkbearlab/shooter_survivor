// Generates placeholder pixel-art textures via Canvas API
// Replace individual generators with real sprite sheets later

import * as THREE from 'three';

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

function canvasToTexture(canvas) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  return tex;
}

// --- Wall / Floor / Ceiling ---

export function makeWallTexture(color1 = '#555566', color2 = '#44445a') {
  const [c, ctx] = makeCanvas(32, 32);
  ctx.fillStyle = color1;
  ctx.fillRect(0, 0, 32, 32);
  // brick pattern
  ctx.fillStyle = color2;
  for (let y = 0; y < 32; y += 8) {
    const offset = (Math.floor(y / 8) % 2) * 8;
    for (let x = -8; x < 32; x += 16) {
      ctx.fillRect(x + offset, y, 15, 7);
    }
  }
  // mortar lines
  ctx.fillStyle = '#33334a';
  for (let y = 0; y < 32; y += 8) ctx.fillRect(0, y + 7, 32, 1);
  return canvasToTexture(c);
}

export function makeFloorTexture() {
  const [c, ctx] = makeCanvas(32, 32);
  ctx.fillStyle = '#3a3a3a';
  ctx.fillRect(0, 0, 32, 32);
  // tile grid
  ctx.fillStyle = '#2e2e2e';
  for (let i = 0; i < 32; i += 8) {
    ctx.fillRect(i, 0, 1, 32);
    ctx.fillRect(0, i, 32, 1);
  }
  return canvasToTexture(c);
}

export function makeCeilingTexture() {
  const [c, ctx] = makeCanvas(32, 32);
  ctx.fillStyle = '#252530';
  ctx.fillRect(0, 0, 32, 32);
  ctx.fillStyle = '#1e1e28';
  for (let i = 0; i < 32; i += 8) {
    ctx.fillRect(i, 0, 1, 32);
    ctx.fillRect(0, i, 32, 1);
  }
  return canvasToTexture(c);
}

export function makeColumnTexture() {
  const [c, ctx] = makeCanvas(16, 32);
  ctx.fillStyle = '#4a4a5a';
  ctx.fillRect(0, 0, 16, 32);
  ctx.fillStyle = '#3a3a4a';
  for (let y = 0; y < 32; y += 4) {
    ctx.fillRect(0, y + 3, 16, 1);
  }
  ctx.fillStyle = '#5a5a6a';
  ctx.fillRect(0, 0, 3, 32);
  ctx.fillRect(13, 0, 3, 32);
  return canvasToTexture(c);
}

// --- Enemy Sprites ---
// Each returns a texture for use with THREE.Sprite
// dir: 0=front, 1=walk1, 2=walk2 (for future animation)

export function makeEnemyTexture(type = 'soldier') {
  const large = type === 'tank';
  const [c, ctx] = makeCanvas(large ? 64 : 32, large ? 80 : 48);
  ctx.clearRect(0, 0, 32, 48);

  if (type === 'soldier') {
    // body
    ctx.fillStyle = '#8b4513';
    ctx.fillRect(10, 16, 12, 18);
    // head
    ctx.fillStyle = '#c8a46e';
    ctx.fillRect(11, 6, 10, 10);
    // eyes
    ctx.fillStyle = '#ff2200';
    ctx.fillRect(13, 9, 2, 2);
    ctx.fillRect(17, 9, 2, 2);
    // legs
    ctx.fillStyle = '#4a3a2a';
    ctx.fillRect(10, 34, 5, 10);
    ctx.fillRect(17, 34, 5, 10);
    // arms
    ctx.fillStyle = '#7a3a10';
    ctx.fillRect(5, 17, 5, 12);
    ctx.fillRect(22, 17, 5, 12);
    // gun
    ctx.fillStyle = '#222';
    ctx.fillRect(22, 24, 8, 3);
  } else if (type === 'rusher') {
    // faster, leaner enemy
    ctx.fillStyle = '#cc2222';
    ctx.fillRect(11, 16, 10, 16);
    ctx.fillStyle = '#dd5555';
    ctx.fillRect(12, 6, 8, 10);
    ctx.fillStyle = '#ffff00';
    ctx.fillRect(13, 9, 2, 2);
    ctx.fillRect(17, 9, 2, 2);
    ctx.fillStyle = '#991111';
    ctx.fillRect(11, 32, 4, 12);
    ctx.fillRect(17, 32, 4, 12);
    ctx.fillStyle = '#cc4444';
    ctx.fillRect(5, 16, 6, 10);
    ctx.fillRect(21, 16, 6, 10);
  } else if (type === 'ranged') {
    ctx.fillStyle = '#336699';
    ctx.fillRect(10, 16, 12, 18);
    ctx.fillStyle = '#aaddff';
    ctx.fillRect(11, 6, 10, 10);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(13, 9, 2, 2);
    ctx.fillRect(17, 9, 2, 2);
    ctx.fillStyle = '#224466';
    ctx.fillRect(10, 34, 5, 10);
    ctx.fillRect(17, 34, 5, 10);
    ctx.fillStyle = '#2255aa';
    ctx.fillRect(5, 17, 5, 12);
    ctx.fillRect(22, 17, 5, 12);
    ctx.fillStyle = '#88ccff';
    ctx.fillRect(22, 22, 9, 2);
    ctx.fillRect(22, 25, 9, 2);

  } else if (type === 'molotov') {
    // Olive-green coat, holding fire bottle
    ctx.fillStyle = '#556633';
    ctx.fillRect(10, 16, 12, 18);
    ctx.fillStyle = '#99aa55';
    ctx.fillRect(11, 6, 10, 10);
    ctx.fillStyle = '#ff4400'; ctx.fillRect(13, 9, 2, 2); ctx.fillRect(17, 9, 2, 2);
    ctx.fillStyle = '#445522'; ctx.fillRect(10, 34, 5, 10); ctx.fillRect(17, 34, 5, 10);
    ctx.fillStyle = '#445522'; ctx.fillRect(5, 17, 5, 12); ctx.fillRect(22, 17, 5, 12);
    // fire bottle in hand
    ctx.fillStyle = '#885500'; ctx.fillRect(23, 20, 4, 7);
    ctx.fillStyle = '#ff8800'; ctx.fillRect(24, 18, 2, 3);
    ctx.fillStyle = '#ffee00'; ctx.fillRect(24, 17, 2, 2);

  } else if (type === 'trishot') {
    // Purple body, three gun barrels
    ctx.fillStyle = '#6633aa';
    ctx.fillRect(10, 16, 12, 18);
    ctx.fillStyle = '#cc88ff';
    ctx.fillRect(11, 6, 10, 10);
    ctx.fillStyle = '#ffff88'; ctx.fillRect(13, 9, 2, 2); ctx.fillRect(17, 9, 2, 2);
    ctx.fillStyle = '#441188'; ctx.fillRect(10, 34, 5, 10); ctx.fillRect(17, 34, 5, 10);
    ctx.fillStyle = '#5522aa'; ctx.fillRect(5, 17, 5, 12); ctx.fillRect(22, 17, 5, 12);
    // three barrels
    ctx.fillStyle = '#333'; ctx.fillRect(22, 18, 8, 2);
    ctx.fillStyle = '#444'; ctx.fillRect(22, 22, 8, 2);
    ctx.fillStyle = '#333'; ctx.fillRect(22, 26, 8, 2);

  } else if (type === 'sniper') {
    // Dark grey, long rifle, scope glint
    ctx.fillStyle = '#334455';
    ctx.fillRect(10, 16, 12, 18);
    ctx.fillStyle = '#556677';
    ctx.fillRect(11, 6, 10, 10);
    ctx.fillStyle = '#88ccff'; ctx.fillRect(13, 9, 2, 2); ctx.fillRect(17, 9, 2, 2);
    ctx.fillStyle = '#223344'; ctx.fillRect(10, 34, 5, 10); ctx.fillRect(17, 34, 5, 10);
    ctx.fillStyle = '#334455'; ctx.fillRect(5, 17, 5, 12); ctx.fillRect(22, 17, 5, 12);
    // long rifle
    ctx.fillStyle = '#222'; ctx.fillRect(22, 22, 10, 2);
    // scope
    ctx.fillStyle = '#00eeff'; ctx.fillRect(26, 20, 3, 3);

  } else if (type === 'tank') {
    // Large 64×80 canvas — handled in makeEnemyTexture with size check
    // Gray bulk, rocket launcher on shoulder
    ctx.fillStyle = '#7a7a88';
    ctx.fillRect(16, 24, 32, 28);
    ctx.fillStyle = '#aaaacc';
    ctx.fillRect(20, 8, 24, 20);
    ctx.fillStyle = '#ff3300'; ctx.fillRect(24, 14, 4, 4); ctx.fillRect(36, 14, 4, 4);
    ctx.fillStyle = '#555566'; ctx.fillRect(16, 52, 12, 20); ctx.fillRect(36, 52, 12, 20);
    ctx.fillStyle = '#555566'; ctx.fillRect(4, 25, 12, 20); ctx.fillRect(48, 25, 12, 20);
    // rocket launcher tube on shoulder
    ctx.fillStyle = '#444'; ctx.fillRect(46, 14, 14, 8);
    ctx.fillStyle = '#666'; ctx.fillRect(44, 16, 4, 4);

  } else if (type === 'guerrilla') {
    // Orange, jetpack flames at feet
    ctx.fillStyle = '#cc4400';
    ctx.fillRect(10, 16, 12, 18);
    ctx.fillStyle = '#ff8844';
    ctx.fillRect(11, 6, 10, 10);
    ctx.fillStyle = '#ffee00'; ctx.fillRect(13, 9, 2, 2); ctx.fillRect(17, 9, 2, 2);
    ctx.fillStyle = '#882200'; ctx.fillRect(10, 34, 5, 10); ctx.fillRect(17, 34, 5, 10);
    ctx.fillStyle = '#aa3300'; ctx.fillRect(5, 17, 5, 12); ctx.fillRect(22, 17, 5, 12);
    // rocket launcher
    ctx.fillStyle = '#333'; ctx.fillRect(22, 21, 9, 4);
    // jetpack flame
    ctx.fillStyle = '#ff8800'; ctx.fillRect(12, 42, 3, 5); ctx.fillRect(17, 42, 3, 5);
    ctx.fillStyle = '#ffee00'; ctx.fillRect(13, 44, 2, 3); ctx.fillRect(18, 44, 2, 3);

  } else if (type === 'drone_gun') {
    // Blue-grey disc body, gun barrel, single eye
    ctx.fillStyle = '#445566';
    ctx.ellipse(16, 28, 12, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#6688aa';
    ctx.beginPath(); ctx.ellipse(16, 26, 8, 6, 0, 0, Math.PI * 2); ctx.fill();
    // eye
    ctx.fillStyle = '#00ccff'; ctx.fillRect(13, 23, 6, 4);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(14, 24, 2, 2);
    // gun
    ctx.fillStyle = '#333'; ctx.fillRect(26, 27, 6, 2);
    // rotors (stylised)
    ctx.fillStyle = '#334455aa'; ctx.fillRect(4, 20, 5, 2); ctx.fillRect(23, 20, 5, 2);

  } else if (type === 'drone_bomb') {
    // Red disc with spikes
    ctx.fillStyle = '#bb1100';
    ctx.beginPath(); ctx.ellipse(16, 28, 12, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ff4422';
    ctx.beginPath(); ctx.ellipse(16, 26, 7, 5, 0, 0, Math.PI * 2); ctx.fill();
    // fuse / eye
    ctx.fillStyle = '#ffee00'; ctx.fillRect(14, 23, 4, 4);
    ctx.fillStyle = '#ff0000'; ctx.fillRect(15, 24, 2, 2);
    // spikes
    ctx.fillStyle = '#882200';
    ctx.fillRect(4, 26, 4, 3); ctx.fillRect(24, 26, 4, 3);
    ctx.fillRect(13, 17, 3, 4); ctx.fillRect(13, 35, 3, 4);
  }

  return canvasToTexture(c);
}

export function makeBossTexture() {
  const [c, ctx] = makeCanvas(64, 80);
  ctx.clearRect(0, 0, 64, 80);
  // big body
  ctx.fillStyle = '#4a0066';
  ctx.fillRect(14, 24, 36, 32);
  // head
  ctx.fillStyle = '#7a1199';
  ctx.fillRect(18, 6, 28, 22);
  // horns
  ctx.fillStyle = '#ff3300';
  ctx.fillRect(18, 0, 4, 10);
  ctx.fillRect(42, 0, 4, 10);
  // eyes
  ctx.fillStyle = '#ffcc00';
  ctx.fillRect(22, 12, 6, 6);
  ctx.fillRect(36, 12, 6, 6);
  // pupils
  ctx.fillStyle = '#000';
  ctx.fillRect(24, 13, 2, 4);
  ctx.fillRect(38, 13, 2, 4);
  // legs
  ctx.fillStyle = '#330044';
  ctx.fillRect(14, 56, 14, 22);
  ctx.fillRect(36, 56, 14, 22);
  // arms
  ctx.fillStyle = '#550077';
  ctx.fillRect(2, 24, 12, 20);
  ctx.fillRect(50, 24, 12, 20);
  return canvasToTexture(c);
}

// Character portrait for select screen
export function makeCharPortraitCanvas(charId) {
  const [c, ctx] = makeCanvas(64, 64);
  if (charId === 'ranger') {
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, 64, 64);
    // armor body
    ctx.fillStyle = '#556677';
    ctx.fillRect(18, 26, 28, 28);
    // head
    ctx.fillStyle = '#c8a46e';
    ctx.fillRect(22, 12, 20, 18);
    // helmet visor
    ctx.fillStyle = '#334455';
    ctx.fillRect(22, 12, 20, 8);
    ctx.fillStyle = '#88aaff';
    ctx.fillRect(24, 14, 16, 4);
    // legs
    ctx.fillStyle = '#445566';
    ctx.fillRect(18, 54, 12, 10);
    ctx.fillRect(34, 54, 12, 10);
    // shoulder pads
    ctx.fillStyle = '#778899';
    ctx.fillRect(10, 26, 8, 10);
    ctx.fillRect(46, 26, 8, 10);
  } else if (charId === 'soldier') {
    ctx.fillStyle = '#0a0a08';
    ctx.fillRect(0, 0, 64, 64);
    // heavy body armor
    ctx.fillStyle = '#4a5a2a';
    ctx.fillRect(12, 24, 40, 32);
    // chest plate
    ctx.fillStyle = '#6a7a3a';
    ctx.fillRect(18, 26, 28, 18);
    // head
    ctx.fillStyle = '#b89060';
    ctx.fillRect(18, 10, 28, 18);
    // full helmet
    ctx.fillStyle = '#3a4a1a';
    ctx.fillRect(16, 8, 32, 16);
    // helmet visor (narrower, military style)
    ctx.fillStyle = '#557722';
    ctx.fillRect(18, 10, 28, 10);
    ctx.fillStyle = '#88aa44';
    ctx.fillRect(22, 13, 20, 4);
    // thick legs
    ctx.fillStyle = '#3a4a1a';
    ctx.fillRect(12, 56, 16, 8);
    ctx.fillRect(36, 56, 16, 8);
    // large shoulder pads
    ctx.fillStyle = '#5a6a2a';
    ctx.fillRect(4, 24, 10, 16);
    ctx.fillRect(50, 24, 10, 16);
    // belt / utility
    ctx.fillStyle = '#2a3a10';
    ctx.fillRect(12, 44, 40, 4);
  }
  return c;
}

// Projectile texture
export function makeProjectileTexture(color = '#ff8800') {
  const [c, ctx] = makeCanvas(8, 8);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(4, 4, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(3, 3, 1, 0, Math.PI * 2);
  ctx.fill();
  return canvasToTexture(c);
}

export function makeParticleTexture(color = '#ff6600') {
  const [c, ctx] = makeCanvas(4, 4);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 4, 4);
  return canvasToTexture(c);
}
