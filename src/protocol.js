export const C2S_INPUT = 1;
export const C2S_ENTER_PORTAL = 2;
export const C2S_SET_NAME = 3;
export const C2S_PARTY_INVITE = 4;
export const C2S_PARTY_INVITE_RESPONSE = 5;
export const C2S_PARTY_LEAVE = 6;

export const S2C_WELCOME = 10;
export const S2C_SNAPSHOT = 11;
export const S2C_WAVE_DEF = 12;
export const S2C_LEADERBOARD = 13;

export const S2C_PARTY_INVITE = 20;
export const S2C_PARTY_UPDATE = 21;

export const ROOM_LOBBY = 0;
export const ROOM_WAVE = 1;

export function encodeInput(seq, wasdBits, mouseActive, mouseDx, mouseDy) {
  const buf = new ArrayBuffer(1 + 4 + 1 + 1 + 4 + 4);
  const dv = new DataView(buf);
  dv.setUint8(0, C2S_INPUT);
  dv.setUint32(1, seq, true);
  dv.setUint8(5, wasdBits);
  dv.setUint8(6, mouseActive ? 1 : 0);
  dv.setFloat32(7, mouseDx, true);
  dv.setFloat32(11, mouseDy, true);
  return buf;
}

export function encodePartyInvite(targetId) {
  const buf = new ArrayBuffer(1 + 4);
  const dv = new DataView(buf);
  dv.setUint8(0, C2S_PARTY_INVITE);
  dv.setUint32(1, targetId >>> 0, true);
  return buf;
}

export function encodePartyInviteResponse(fromId, accept) {
  const buf = new ArrayBuffer(1 + 4 + 1);
  const dv = new DataView(buf);
  dv.setUint8(0, C2S_PARTY_INVITE_RESPONSE);
  dv.setUint32(1, fromId >>> 0, true);
  dv.setUint8(5, accept ? 1 : 0);
  return buf;
}

export function encodePartyLeave() {
  const buf = new ArrayBuffer(1);
  const dv = new DataView(buf);
  dv.setUint8(0, C2S_PARTY_LEAVE);
  return buf;
}

export function encodeEnterPortal(portalId) {
  const buf = new ArrayBuffer(2);
  const dv = new DataView(buf);
  dv.setUint8(0, C2S_ENTER_PORTAL);
  dv.setUint8(1, portalId);
  return buf;
}

export function encodeSetName(name) {
  const s = (typeof name === 'string' ? name : '').slice(0, 18);
  const bytes = new TextEncoder().encode(s);
  const n = Math.min(255, bytes.length);
  const buf = new ArrayBuffer(2 + n);
  const dv = new DataView(buf);
  dv.setUint8(0, C2S_SET_NAME);
  dv.setUint8(1, n);
  const u8 = new Uint8Array(buf);
  for (let i = 0; i < n; i++) u8[2 + i] = bytes[i];
  return buf;
}

export function decodeServerMessage(arrayBuffer) {
  const dv = new DataView(arrayBuffer);
  const type = dv.getUint8(0);

  if (type === S2C_WELCOME) {
    const yourId = dv.getUint32(1, true);
    return { type: 'welcome', yourId };
  }

  if (type === S2C_WAVE_DEF) {
    if (arrayBuffer.byteLength < 1 + 2 + 4 + 4 + 4) {
      return { type: 'waveDef', error: 'short' };
    }
    const waveNumber = dv.getUint16(1, true);
    const halfSize = dv.getFloat32(3, true);
    const entityRadius = dv.getFloat32(7, true);
    const spawnMargin = dv.getFloat32(11, true);
    return { type: 'waveDef', waveNumber, halfSize, entityRadius, spawnMargin };
  }

  if (type === S2C_SNAPSHOT) {
    const tick = dv.getUint32(1, true);
    const room = dv.getUint8(5);
    const count = dv.getUint16(6, true);
    let off = 8;
    const players = [];
    for (let i = 0; i < count; i++) {
      const id = dv.getUint32(off, true); off += 4;
      const x = dv.getFloat32(off, true); off += 4;
      const y = dv.getFloat32(off, true); off += 4;
      const alive = dv.getUint8(off) !== 0; off += 1;
      const hp = dv.getUint8(off); off += 1;

      const nameLen = dv.getUint8(off); off += 1;
      const nameBytes = new Uint8Array(arrayBuffer, off, nameLen);
      off += nameLen;
      const name = new TextDecoder().decode(nameBytes);

      players.push({ id, x, y, alive, hp, name });
    }

    if (room === ROOM_WAVE) {
      const turretAngle = dv.getFloat32(off, true); off += 4;
      const turretAlpha = dv.getFloat32(off, true); off += 4;
      const wavePhase = dv.getUint8(off); off += 1;
      const waveSubphase = dv.getUint8(off); off += 1;
      const countdownRemaining = dv.getFloat32(off, true); off += 4;
      const waveTimeRemaining = dv.getFloat32(off, true); off += 4;
      const waveTimeTotal = dv.getFloat32(off, true); off += 4;
      const waveNumber = dv.getUint16(off, true); off += 2;
      const entCount = dv.getUint16(off, true); off += 2;
      const entities = [];
      for (let i = 0; i < entCount; i++) {
        const id = dv.getUint32(off, true); off += 4;
        const kind = dv.getUint8(off); off += 1;
        const flags = dv.getUint8(off); off += 1;
        const x = dv.getFloat32(off, true); off += 4;
        const y = dv.getFloat32(off, true); off += 4;
        const r = dv.getFloat32(off, true); off += 4;
        entities.push({ id, kind, flags, x, y, r });
      }
      return { type: 'snapshot', tick, room, players, turretAngle, turretAlpha, wavePhase, waveSubphase, countdownRemaining, waveTimeRemaining, waveTimeTotal, waveNumber, entities };
    }

    return { type: 'snapshot', tick, room, players };
  }

  if (type === S2C_PARTY_INVITE) {
    if (arrayBuffer.byteLength < 1 + 4 + 1) {
      return { type: 'partyInvite', error: 'short' };
    }
    const fromId = dv.getUint32(1, true);
    const nameLen = dv.getUint8(5);
    if (arrayBuffer.byteLength < 1 + 4 + 1 + nameLen) {
      return { type: 'partyInvite', error: 'shortName' };
    }
    const nameBytes = new Uint8Array(arrayBuffer, 6, nameLen);
    const fromName = new TextDecoder().decode(nameBytes);
    return { type: 'partyInvite', fromId, fromName };
  }

  if (type === S2C_PARTY_UPDATE) {
    if (arrayBuffer.byteLength < 1 + 4 + 4 + 2) {
      return { type: 'partyUpdate', error: 'short' };
    }
    const partyId = dv.getUint32(1, true);
    const leaderId = dv.getUint32(5, true);
    const count = dv.getUint16(9, true);
    let off = 11;
    const members = [];
    for (let i = 0; i < count; i++) {
      if (off + 4 > arrayBuffer.byteLength) break;
      members.push(dv.getUint32(off, true));
      off += 4;
    }
    return { type: 'partyUpdate', partyId, leaderId, members };
  }

  if (type === S2C_LEADERBOARD) {
    if (arrayBuffer.byteLength < 1 + 2) {
      return { type: 'leaderboard', error: 'short' };
    }
    const count = dv.getUint16(1, true);
    let off = 3;
    const entries = [];
    for (let i = 0; i < count; i++) {
      if (off + (4 + 1 + 2 + 4 + 1) > arrayBuffer.byteLength) break;
      const id = dv.getUint32(off, true); off += 4;
      const room = dv.getUint8(off); off += 1;
      const waveNumber = dv.getUint16(off, true); off += 2;
      const partyId = dv.getUint32(off, true); off += 4;
      const nameLen = dv.getUint8(off); off += 1;
      if (off + nameLen > arrayBuffer.byteLength) break;
      const nameBytes = new Uint8Array(arrayBuffer, off, nameLen);
      off += nameLen;
      const name = new TextDecoder().decode(nameBytes);
      entries.push({ id, room, waveNumber, partyId, name });
    }
    return { type: 'leaderboard', entries };
  }

  return { type: 'unknown', rawType: type };
}
