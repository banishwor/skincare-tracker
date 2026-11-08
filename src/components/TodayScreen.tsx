import { useMemo } from 'react';
import type { BlockId, DayLog, EitherChoice, Product, Settings, StepDef, TxaOverride } from '../types';
import {
  BLOCK_ICONS,
  BLOCK_NAMES,
  BLOCK_ORDER,
  blockComplete,
  buildSteps,
  greeting,
  isStepResolved,
  resolvedCount,
  suggestionLine,
  txaApplies,
  txaScheduleText,
} from '../lib/logic';
import { DAY_LETTERS, formatDateline, formatTime, weekdayMon0 } from '../lib/dates';
import { stepDotColor } from '../lib/stepStyle';

/** Decorative category dot before a step name — never conveys state. */
function StepDot({ stepId }: { stepId: string }) {
  return <span className="sdot" style={{ background: stepDotColor(stepId) }} aria-hidden="true" />;
}

interface Props {
  settings: Settings;
  products: Product[];
  log: DayLog | undefined;
  logDate: string;
  current: BlockId;
  streak: number;
  onToggleStep: (block: BlockId, step: StepDef) => void;
  onSkipStep: (block: BlockId, step: StepDef) => void;
  onEither: (block: BlockId, choice: EitherChoice | null) => void;
  onTxaOverride: (override: TxaOverride) => void;
  onOpenSettings: () => void;
}

const BLOCK_SUBS: Record<BlockId, string> = {
  morning: 'Before work',
  backHome: 'After work',
  night: 'Before bed',
};

export default function TodayScreen(props: Props) {
  const { settings, products, log, logDate, current } = props;
  const ctx = useMemo(
    () => ({ products, settings, dateKey: logDate, log }),
    [products, settings, logDate, log],
  );

  const steps = buildSteps(current, ctx);
  const blockLog = log?.blocks[current];
  const resolved = resolvedCount(current, log, ctx);
  const total = steps.length;
  const ringCirc = 113.1;
  const ringOffset = ringCirc * (1 - (total ? resolved / total : 0));

  const isNight = current === 'night';
  const txaOn = txaApplies(log, logDate, settings);
  const todayWd = weekdayMon0(logDate);

  return (
    <section>
      <div className="dateline">{formatDateline(logDate)}</div>
      <div className="title-row">
        <div className="greet">{greeting(current, settings.userName)}</div>
        <div className="header-actions">
          <div className="streak">🔥 {props.streak}-day streak</div>
          <button className="gear" aria-label="Settings" onClick={props.onOpenSettings}>⚙️</button>
        </div>
      </div>
      <div className="suggest">{suggestionLine(current, log, logDate, settings)}</div>

      <div className="group-title" style={{ marginTop: 2 }}>Now</div>
      <div className="card">
        <div className="now-head">
          <div>
            <div className="now-name">{BLOCK_NAMES[current]}</div>
            <div className="now-sub">
              {BLOCK_SUBS[current]} · from {formatTime(settings.blockStarts[current])}
            </div>
          </div>
          <div className="ring-wrap">
            <svg width="44" height="44">
              <circle className="ring-bg" cx="22" cy="22" r="18" fill="none" strokeWidth="4.5" />
              <circle
                className="ring-fg" cx="22" cy="22" r="18" fill="none" strokeWidth="4.5"
                strokeLinecap="round" strokeDasharray={ringCirc} strokeDashoffset={ringOffset}
              />
            </svg>
            <div className="ring-txt">{resolved}/{total}</div>
          </div>
        </div>

        <div>
          {steps.map((step) => {
            if (step.kind === 'either') {
              const choice = blockLog?.eitherChoice ?? null;
              return (
                <div key={step.id}>
                  <div className={`step${choice ? ' done' : ''}`}>
                    <div className="tick">{choice ? '✓' : ''}</div>
                    <div className="s-body">
                      <div className="s-name"><StepDot stepId={step.id} />{step.name}</div>
                      {step.note && <div className="s-note">{step.note}</div>}
                    </div>
                  </div>
                  <div className="either">
                    <button
                      className={choice === 'moisturizer' ? 'on' : ''}
                      onClick={() => props.onEither(current, choice === 'moisturizer' ? null : 'moisturizer')}
                    >
                      Moisturizer<small>regular</small>
                    </button>
                    <button
                      className={choice === 'nightCream' ? 'on' : ''}
                      onClick={() => props.onEither(current, choice === 'nightCream' ? null : 'nightCream')}
                    >
                      Garnier Vitamin C Night Cream<small>use up</small>
                    </button>
                  </div>
                </div>
              );
            }
            const state = blockLog?.steps[step.id];
            const cls = state === 'done' ? ' done' : state === 'skipped' ? ' skipped' : state === 'missed' ? ' missed' : '';
            return (
              <div
                key={step.id}
                className={`step clickable${cls}`}
                onClick={() => props.onToggleStep(current, step)}
              >
                <button
                  className="tick"
                  aria-label={`Toggle ${step.name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    props.onToggleStep(current, step);
                  }}
                >
                  {state === 'done' ? '✓' : state === 'skipped' ? '–' : state === 'missed' ? '✕' : ''}
                </button>
                <div className="s-body">
                  <div className="s-name">
                    <StepDot stepId={step.id} />{step.name}
                    {step.chip && <span className="chip buy">{step.chip}</span>}
                  </div>
                  {step.note && <div className="s-note">{step.note}</div>}
                  {step.skippable && !state && (
                    <button
                      className="skipbtn"
                      onClick={(e) => {
                        e.stopPropagation();
                        props.onSkipStep(current, step);
                      }}
                    >
                      {step.id === 'niacinamide' ? 'Skip — don’t have it yet' : 'Skip'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {isNight && (
          <div>
            <div className="group-title" style={{ margin: '10px 14px 0 47px' }}>TXA nights this week</div>
            <div className="weekstrip">
              {DAY_LETTERS.map((d, i) => (
                <div key={i} className={`wd${settings.txaDays.includes(i) ? ' txa' : ''}${i === todayWd ? ' today' : ''}`}>
                  <div className="d">{d}</div>
                  <div className="dot" />
                </div>
              ))}
            </div>
            {!txaOn && log?.txaOverride !== 'skipped' && (
              <div className="txa-note">
                No TXA tonight — scheduled {txaScheduleText(settings)}.{' '}
                <button onClick={() => props.onTxaOverride('used')}>Use TXA tonight anyway</button>
              </div>
            )}
            {!txaOn && log?.txaOverride === 'skipped' && (
              <div className="txa-note">
                TXA skipped tonight. <button onClick={() => props.onTxaOverride(null)}>Undo</button>
              </div>
            )}
            {txaOn && log?.txaOverride === 'used' && (
              <div className="txa-note">
                You’re using TXA tonight (one-off).{' '}
                <button onClick={() => props.onTxaOverride(null)}>Undo</button>
              </div>
            )}
            {txaOn && !log?.txaOverride && (
              <div className="txa-note">
                TXA night. <button onClick={() => props.onTxaOverride('skipped')}>Skip TXA tonight</button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="group-title">Today's timeline</div>
      <div className="card">
        {BLOCK_ORDER.map((b) => {
          const bCtx = { products, settings, dateKey: logDate, log };
          const bLog = log?.blocks[b];
          const complete = blockComplete(b, log, bCtx);
          const rc = resolvedCount(b, log, bCtx);
          const tc = buildSteps(b, bCtx).length;
          const isNow = b === current;
          const passed = BLOCK_ORDER.indexOf(b) < BLOCK_ORDER.indexOf(current);
          let stateTxt = 'LATER';
          let stateCls = 'st-later';
          let detail: string = BLOCK_SUBS[b];
          if (bLog?.missed) {
            stateTxt = 'MISSED'; stateCls = 'st-missed'; detail = 'Skipped today';
          } else if (complete) {
            stateTxt = 'DONE'; stateCls = 'st-done'; detail = 'Done ✓';
          } else if (isNow) {
            stateTxt = 'NOW'; stateCls = 'st-now'; detail = `${rc} of ${tc} done`;
          } else if (passed) {
            stateTxt = 'NOT DONE'; stateCls = 'st-later'; detail = `${rc} of ${tc} ticked`;
          } else if (b === 'night' && !txaApplies(log, logDate, settings)) {
            detail = 'Tonight · plain night (no TXA)';
          }
          return (
            <div key={b} className={`tl-row${isNow ? ' now' : ''}`}>
              <div className="tl-ico">{BLOCK_ICONS[b]}</div>
              <div className="tl-name">{BLOCK_NAMES[b]}</div>
              <div className="tl-detail">{detail}</div>
              <div className={`tl-state ${stateCls}`}>{stateTxt}</div>
            </div>
          );
        })}
      </div>

      <div className="foot">Skin Routine · your data never leaves this device</div>
    </section>
  );
}
