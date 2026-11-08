import { useRef, useState } from 'react';
import type { BlockId, Settings } from '../types';
import { BLOCK_NAMES, BLOCK_ORDER } from '../lib/logic';
import { DAY_LETTERS } from '../lib/dates';
import { exportAll, importAll, isBackupData, saveSettings } from '../db/db';

interface Props {
  settings: Settings;
  onSaved: (settings: Settings) => void;
  onImported: () => void;
  onBack: () => void;
}

export default function SettingsScreen({ settings, onSaved, onImported, onBack }: Props) {
  const [userName, setUserName] = useState(settings.userName);
  const [txaDays, setTxaDays] = useState<number[]>(settings.txaDays);
  const [starts, setStarts] = useState<Record<BlockId, string>>(settings.blockStarts);
  const [msg, setMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const toggleDay = (d: number) => {
    setTxaDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()));
  };

  const handleSave = async () => {
    const next: Settings = {
      userName: userName.trim() || settings.userName,
      txaDays,
      blockStarts: starts,
    };
    await saveSettings(next);
    onSaved(next);
    setMsg('Saved.');
  };

  const handleExport = async () => {
    const data = await exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `skin-routine-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMsg('Backup downloaded.');
  };

  const handleImportFile = async (file: File) => {
    try {
      const text = await file.text();
      const parsed: unknown = JSON.parse(text);
      if (!isBackupData(parsed)) {
        setMsg('That file is not a Skin Routine backup.');
        return;
      }
      const ok = window.confirm(
        'Restore this backup? It replaces ALL current data on this device (settings, cabinet, history).',
      );
      if (!ok) return;
      await importAll(parsed);
      setMsg('Backup restored.');
      onImported();
    } catch {
      setMsg('Could not read that file.');
    }
  };

  return (
    <section>
      <button className="backbtn" onClick={onBack}>‹ Back</button>
      <div className="title-row"><h1>Settings</h1></div>

      <div className="group-title">About you</div>
      <div className="card">
        <div className="set-row">
          <div className="s-body">
            <div className="set-label">Your name</div>
            <div className="set-sub">Used in the greeting on Today.</div>
          </div>
          <input
            className="text-input" style={{ width: 150 }} value={userName}
            onChange={(e) => setUserName(e.target.value)} aria-label="Your name"
          />
        </div>
      </div>

      <div className="group-title">TXA nights</div>
      <div className="card">
        <div className="set-row">
          <div className="s-body">
            <div className="set-label">Tranexamic nights</div>
            <div className="set-sub">Nights the TXA step appears in the Night block.</div>
          </div>
        </div>
        <div className="day-chips">
          {DAY_LETTERS.map((d, i) => (
            <button key={i} className={txaDays.includes(i) ? 'on' : ''} onClick={() => toggleDay(i)}>
              {d}
            </button>
          ))}
        </div>
      </div>

      <div className="group-title">Block start times</div>
      <div className="card">
        {BLOCK_ORDER.map((b) => (
          <div className="set-row" key={b}>
            <div className="s-body">
              <div className="set-label">{BLOCK_NAMES[b]}</div>
              <div className="set-sub">The current block is the latest one whose start has passed.</div>
            </div>
            <input
              className="time-input" type="time" value={starts[b]} aria-label={`${BLOCK_NAMES[b]} start`}
              onChange={(e) => setStarts((prev) => ({ ...prev, [b]: e.target.value || prev[b] }))}
            />
          </div>
        ))}
      </div>

      <div style={{ marginTop: 14 }}>
        <button className="bigbtn" onClick={handleSave}>Save settings</button>
      </div>

      <div className="group-title">Your data</div>
      <div className="card">
        <div className="set-row">
          <div className="s-body">
            <div className="set-label">Export backup</div>
            <div className="set-sub">Download everything (settings, cabinet, history) as one JSON file.</div>
          </div>
          <button className="addq" onClick={handleExport}>Export</button>
        </div>
        <div className="set-row">
          <div className="s-body">
            <div className="set-label">Import backup</div>
            <div className="set-sub">Restore from a backup file. Replaces all current data — you'll be asked to confirm.</div>
          </div>
          <button className="addq" onClick={() => fileRef.current?.click()}>Import</button>
          <input
            ref={fileRef} type="file" accept="application/json,.json" style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleImportFile(f);
              e.target.value = '';
            }}
          />
        </div>
      </div>

      {msg && <div className="foot" style={{ color: 'var(--blue)', fontWeight: 600 }}>{msg}</div>}
      <div className="foot">Skin Routine v0.1.0 · all data stays on this device</div>
    </section>
  );
}
