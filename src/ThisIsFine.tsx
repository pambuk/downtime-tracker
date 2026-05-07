import normal from "./assets/status-dog-smile/status-dog-smile-0-normal.png";
import oneFlame from "./assets/status-dog-smile/status-dog-smile-1-one-flame.png";
import moreFlames from "./assets/status-dog-smile/status-dog-smile-2-more-flames.png";
import roomOnFire from "./assets/status-dog-smile/status-dog-smile-3-room-on-fire.png";

interface Props {
  fires: number;
}

// Index = number of fires; the last entry covers "and beyond".
const STAGES: ReadonlyArray<{ src: string; label: string }> = [
  { src: normal, label: "Cartoon dog at a table. Nothing on fire." },
  { src: oneFlame, label: "Cartoon dog at a table. One small fire in the room." },
  { src: moreFlames, label: "Cartoon dog at a table. The room is on fire." },
  { src: roomOnFire, label: "Cartoon dog at a table. The room is fully engulfed in flames." },
];

export function ThisIsFine({ fires }: Props) {
  const stage = STAGES[Math.min(Math.max(fires, 0), STAGES.length - 1)];
  return (
    <div className="this-is-fine">
      <img src={stage.src} alt={stage.label} />
      <div className="speech" aria-hidden>
        this is fine.
      </div>
    </div>
  );
}
