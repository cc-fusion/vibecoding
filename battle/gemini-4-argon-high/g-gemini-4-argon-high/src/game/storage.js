const STORAGE_PREFIX = 'voxel_realms_save_v1_';
const ACTIVE_SLOT_KEY = 'voxel_realms_active_slot';

export class WorldStorage {
  constructor() {
    this.activeSlot = this._readLocal(ACTIVE_SLOT_KEY) || 'slot_1';
  }

  _readLocal(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  _writeLocal(key, val) {
    try {
      localStorage.setItem(key, val);
      return true;
    } catch {
      return false;
    }
  }

  setActiveSlot(slotId) {
    this.activeSlot = slotId;
    this._writeLocal(ACTIVE_SLOT_KEY, slotId);
  }

  getSlotSummary(slotId) {
    const raw = this._readLocal(STORAGE_PREFIX + slotId);
    if (!raw) return null;
    try {
      const data = JSON.parse(raw);
      return {
        slotId,
        name: data.name || `World ${slotId.replace('slot_', '#')}`,
        seed: data.seed || 'VOXEL_REALMS_2026',
        dayCount: data.dayCount || 1,
        mode: data.mode || 'survival',
        updatedAt: data.updatedAt || Date.now(),
        modifiedChunkCount: data.modifications ? Object.keys(data.modifications).length : 0,
      };
    } catch {
      return null;
    }
  }

  listSlots() {
    return ['slot_1', 'slot_2', 'slot_3'].map((id) => ({
      slotId: id,
      summary: this.getSlotSummary(id),
    }));
  }

  saveWorld(slotId, payload) {
    const record = {
      ...payload,
      slotId,
      updatedAt: Date.now(),
    };
    return this._writeLocal(STORAGE_PREFIX + slotId, JSON.stringify(record));
  }

  loadWorld(slotId) {
    const raw = this._readLocal(STORAGE_PREFIX + slotId);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  deleteSlot(slotId) {
    try {
      localStorage.removeItem(STORAGE_PREFIX + slotId);
      return true;
    } catch {
      return false;
    }
  }
}
