import type { Settings } from '../game/save';
import { audio } from '../game/audio';
import { Btn, Modal, Slider, Toggle } from './ui';

export default function SettingsPanel({ settings, onChange, onClose, onReset }: { settings: Settings; onChange: (s: Settings) => void; onClose: () => void; onReset?: () => void }) {
  const set = (p: Partial<Settings>) => onChange({ ...settings, ...p });
  return (
    <Modal title="⚙️ Settings" onClose={onClose}>
      <div className="space-y-4">
        <Toggle label="Mute all audio" value={settings.muted} onChange={(v) => set({ muted: v })} hint="Shortcut: M" />
        <Slider label="Master volume" value={settings.master} min={0} max={1} step={0.05} onChange={(v) => set({ master: v })} />
        <Slider label="Music volume" value={settings.music} min={0} max={1} step={0.05} onChange={(v) => set({ music: v })} />
        <div onPointerUp={() => audio.sfx('place')}>
          <Slider label="Effects volume" value={settings.sfx} min={0} max={1} step={0.05} onChange={(v) => set({ sfx: v })} />
        </div>
        <Toggle label="Screen shake" value={settings.shake} onChange={(v) => set({ shake: v })} hint="Disable if you are sensitive to motion" />
        <Toggle label="High particle quality" value={settings.quality === 'high'} onChange={(v) => set({ quality: v ? 'high' : 'low' })} hint="Turn off on slower devices" />
        <div className="flex flex-wrap gap-2 pt-2">
          <Btn variant="primary" onClick={onClose}>
            Done
          </Btn>
          {onReset && (
            <Btn
              variant="danger"
              onClick={() => {
                if (window.confirm('Erase all Legacy progress and records?')) onReset();
              }}
            >
              Erase saved progress
            </Btn>
          )}
        </div>
      </div>
    </Modal>
  );
}
