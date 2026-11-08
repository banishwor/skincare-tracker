import { BLOCK_NAMES, type CatchUpCandidate } from '../lib/logic';

interface Props {
  candidate: CatchUpCandidate;
  onYes: () => void;
  onMissed: () => void;
  onLater: () => void;
}

export default function CatchupModal({ candidate, onYes, onMissed, onLater }: Props) {
  const names = candidate.pendingNames;
  const joined =
    names.length === 1
      ? names[0]
      : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  const verb = names.length === 1 ? 'wasn’t ticked.' : 'weren’t ticked.';
  return (
    <div className="modal-veil show">
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="catchup-title">
        <h3 id="catchup-title">{BLOCK_NAMES[candidate.block]} routine — did you finish it?</h3>
        <p>{joined} {verb}</p>
        <div className="m-btns">
          <button className="primary" onClick={onYes}>Yes, done</button>
          <button className="missed" onClick={onMissed}>Missed it</button>
          <button onClick={onLater}>Ask later</button>
        </div>
      </div>
    </div>
  );
}
