import { useState } from 'react';
import type { Product } from '../types';
import { addDays, formatShortDate } from '../lib/dates';

interface Props {
  products: Product[];
  today: string;
  onStart: (id: string) => void;
  onFinish: (id: string) => void;
  onQueueSuggested: (id: string) => void;
  onAddCustom: (name: string, brand: string, status: 'using' | 'toBuy') => void;
  onOpenSettings: () => void;
}

function isNew(p: Product, today: string): boolean {
  if (p.status !== 'using' || !p.startedOn) return false;
  return p.startedOn <= today && addDays(p.startedOn, 14) > today;
}

export default function CabinetScreen(props: Props) {
  const { products, today } = props;
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [status, setStatus] = useState<'using' | 'toBuy'>('using');

  const using = products.filter((p) => p.status === 'using').sort((a, b) => a.name.localeCompare(b.name));
  const toBuy = products
    .filter((p) => p.status === 'toBuy')
    .sort((a, b) => (a.queueOrder ?? 99) - (b.queueOrder ?? 99));
  const suggested = products.filter((p) => p.status === 'suggested');
  const finished = products
    .filter((p) => p.status === 'finished')
    .sort((a, b) => (b.finishedOn ?? '').localeCompare(a.finishedOn ?? ''));

  // Finished products whose planned successor is still waiting in the queue.
  const banners = finished.filter((p) => {
    if (!p.successorId) return false;
    const successor = products.find((x) => x.id === p.successorId);
    return successor?.status === 'toBuy';
  });

  return (
    <section>
      <div className="dateline">Your products</div>
      <div className="title-row">
        <h1>Cabinet</h1>
        <button className="gear" aria-label="Settings" onClick={props.onOpenSettings}>⚙️</button>
      </div>

      {banners.map((p) => {
        const successor = products.find((x) => x.id === p.successorId);
        if (!successor) return null;
        return (
          <div className="banner" key={p.id}>
            <div className="b-t">🧴 {p.name} — finished</div>
            <div className="b-s">
              Planned next{successor.slot === 'toner' ? ' for the toner slot' : ''}: <b>{successor.name}</b>
              {successor.note ? <> — {successor.note.replace(/^Next — /, '').toLowerCase()}</> : null}
            </div>
            <button onClick={() => props.onStart(successor.id)}>Start it</button>
          </div>
        );
      })}

      <div className="group-title">Using</div>
      <div className="card">
        {using.length === 0 && <div className="empty-note">Nothing here yet.</div>}
        {using.map((p) => (
          <div className="p-row" key={p.id}>
            <div className="s-body">
              <div className="p-name">
                {p.name}
                {p.chip && <span className="chip useup">{p.chip}</span>}
                {isNew(p, today) && <span className="chip new">new</span>}
              </div>
              <div className="p-brand">{p.brand || ' '}</div>
              <div className="p-started">
                {isNew(p, today) && p.startedOn
                  ? `Started ${formatShortDate(p.startedOn)} — go gentle for 2 weeks`
                  : p.note ?? ''}
              </div>
            </div>
            <div className="p-actions">
              <button className="rowbtn" onClick={() => props.onFinish(p.id)}>Mark finished</button>
            </div>
          </div>
        ))}
      </div>

      <div className="group-title">To buy — in this order</div>
      <div className="card">
        {toBuy.length === 0 && <div className="empty-note">Queue is empty — nice.</div>}
        {toBuy.map((p, i) => (
          <div className="p-row" key={p.id}>
            <div className="p-num">{i + 1}</div>
            <div className="s-body">
              <div className="p-name">{p.name}</div>
              <div className="p-brand">{p.brand || ' '}</div>
              <div className="p-started">{p.note ?? ''}</div>
            </div>
            <div className="p-actions">
              <button className="addq" onClick={() => props.onStart(p.id)}>Start</button>
            </div>
          </div>
        ))}
      </div>

      <div className="group-title">Suggested for you</div>
      <div className="card">
        {suggested.length === 0 && <div className="empty-note">Nothing else suggested right now.</div>}
        {suggested.map((p) => (
          <div className="p-row" key={p.id}>
            <div className="s-body">
              <div className="p-name">{p.name}<span className="chip sugg">Suggested</span></div>
              {p.brand && <div className="p-brand">{p.brand}</div>}
              <div className="p-started">{p.note ?? ''}</div>
            </div>
            <button className="addq" onClick={() => props.onQueueSuggested(p.id)}>Add to queue</button>
          </div>
        ))}
      </div>

      <div className="group-title">Add a product</div>
      <div className="card">
        <div className="form-grid">
          <input
            className="text-input" placeholder="Product name" value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="text-input" placeholder="Brand (optional)" value={brand}
            onChange={(e) => setBrand(e.target.value)}
          />
          <select
            className="text-input" value={status}
            onChange={(e) => setStatus(e.target.value as 'using' | 'toBuy')}
          >
            <option value="using">I'm using it</option>
            <option value="toBuy">To buy</option>
          </select>
          <button
            className="bigbtn secondary"
            disabled={!name.trim()}
            onClick={() => {
              props.onAddCustom(name.trim(), brand.trim(), status);
              setName('');
              setBrand('');
            }}
          >
            Add product
          </button>
        </div>
      </div>

      {finished.length > 0 && (
        <>
          <div className="group-title">Finished</div>
          <div className="card">
            {finished.map((p) => (
              <div className="p-row" key={p.id}>
                <div className="s-body">
                  <div className="p-name">{p.name}</div>
                  <div className="p-brand">{p.brand || ' '}</div>
                  <div className="p-started">
                    {p.finishedOn ? `Finished ${formatShortDate(p.finishedOn)}` : 'Finished'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="foot">One new product at a time — let each settle 1–2 weeks.</div>
    </section>
  );
}
