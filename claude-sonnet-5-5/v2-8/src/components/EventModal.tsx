import type { EventView } from "../game/types";
import { audio } from "../game/audio";
import { Modal } from "./ui";

export default function EventModal({ ev, onPick }: { ev: EventView; onPick: (i: number) => void }) {
  return (
    <Modal z={45}>
      <div className="text-center">
        <div className="text-5xl mb-1">{ev.icon}</div>
        <h2 className="font-display text-3xl text-amber-300">{ev.title}</h2>
        <p className="mt-2 text-sky-50/90">{ev.text}</p>
      </div>
      <div className="mt-5 space-y-2">
        {ev.options.map((o, i) => (
          <button key={i} className="btn w-full text-left" onClick={() => { audio.sfx("click"); onPick(i); }}>
            <div className="font-bold">{o.label}</div>
            <div className="text-[12px] text-sky-200/70 font-normal">{o.hint}</div>
          </button>
        ))}
      </div>
    </Modal>
  );
}
