import { useMemo, useRef, useState, type CSSProperties, type DragEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Camera,
  Check,
  CheckCircle2,
  ImagePlus,
  Inbox,
  Loader2,
  Pencil,
  RefreshCw,
  Route,
  Send,
} from 'lucide-react';
import AssetIcon from '../../components/tickets/AssetIcon';
import { PriorityBadge } from '../../components/ui/Badges';
import { assetTypes } from '../../data/referenceData';
import { SLA_HOURS } from '../../domain/lifecycle';
import { childrenOf, getLocation, locationPath, permittedBuildings } from '../../domain/locations';
import { resolveRoute } from '../../domain/routing';
import { userName } from '../../domain/format';
import type { Ticket } from '../../domain/types';
import { roleHome, useCurrentUser } from '../../state/session';
import { useTicketStore } from '../../state/ticketStore';
import './CreateTicketPage.css';

const STEPS = ['Photo', 'Asset', 'Location', 'Details', 'Review'] as const;
const MAX_BYTES = 5 * 1024 * 1024;
const MIME = ['image/jpeg', 'image/png', 'image/webp'];
const MIN_DESC = 10;
const MAX_DESC = 500;

export default function CreateTicketPage() {
  const user = useCurrentUser();
  const home = roleHome[user.role];
  const { createTicket } = useTicketStore();

  const [step, setStep] = useState(0);
  const [photo, setPhoto] = useState<{ url: string; name: string } | null>(null);
  const [photoError, setPhotoError] = useState('');
  const [dragging, setDragging] = useState(false);
  const [assetTypeId, setAssetTypeId] = useState('');
  const [buildingId, setBuildingId] = useState('');
  const [floorId, setFloorId] = useState('');
  const [labId, setLabId] = useState('');
  const [description, setDescription] = useState('');
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<Ticket | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const buildings = useMemo(() => permittedBuildings(user), [user]);
  const floors = buildingId ? childrenOf(buildingId) : [];
  const labs = floorId ? childrenOf(floorId) : [];
  const asset = assetTypes.find((a) => a.id === assetTypeId);
  const route = labId && assetTypeId ? resolveRoute(labId, assetTypeId) : null;

  function takeFile(file: File | undefined) {
    if (!file) return;
    if (!MIME.includes(file.type)) return setPhotoError('Use a JPG, PNG or WebP image.');
    if (file.size > MAX_BYTES) return setPhotoError('Image must be 5 MB or smaller.');
    setPhotoError('');
    const reader = new FileReader();
    reader.onload = () => setPhoto({ url: String(reader.result), name: file.name });
    reader.onerror = () => setPhotoError('Could not read this image.');
    reader.readAsDataURL(file);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    takeFile(e.dataTransfer.files[0]);
  }

  const descLen = description.trim().length;
  const valid = [
    !!photo,
    !!assetTypeId,
    !!labId,
    descLen >= MIN_DESC && descLen <= MAX_DESC,
    true,
  ];

  function next() {
    if (step === 3) setTouched(true);
    if (!valid[step]) {
      if (step === 0) setPhotoError('Add a photo of the problem to continue.');
      return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  async function submit() {
    if (submitting || valid.slice(0, 4).some((v) => !v)) return;
    setSubmitting(true);
    try {
      const ticket = await createTicket(user, {
        locationId: labId,
        assetTypeId,
        description: description.trim(),
        imageUrl: photo?.url,
      });
      setCreated(ticket);
    } catch (error) {
      setPhotoError(error instanceof Error ? error.message : 'Could not create ticket.');
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setStep(0);
    setPhoto(null);
    setAssetTypeId('');
    setBuildingId('');
    setFloorId('');
    setLabId('');
    setDescription('');
    setTouched(false);
    setCreated(null);
  }

  if (created) {
    return (
      <div className="wizard">
        <section className="panel glass success rise-in">
          <span className="success__check">
            <CheckCircle2 size={44} strokeWidth={1.8} />
          </span>
          <h2>Complaint registered</h2>
          <p className="success__code">{created.id}</p>
          <div className={`route-card ${created.assignedTo ? '' : 'route-card--none'}`}>
            {created.assignedTo ? <Route size={20} /> : <Inbox size={20} />}
            <span>
              {created.assignedTo ? (
                <>
                  Routed to <strong>{userName(created.assignedTo)}</strong>. You can track updates here.
                </>
              ) : (
                <>
                  No team is mapped to this lab and asset yet, so it is in the <strong>unassigned queue</strong>. The
                  Super Admin can assign it from the unassigned queue.
                </>
              )}
            </span>
          </div>
          <div className="success__actions">
            <Link to={`${home}/tickets/${created.id}`} className="btn btn-primary">
              View ticket <ArrowRight size={16} />
            </Link>
            <button type="button" className="btn btn-ghost" onClick={reset}>
              <RefreshCw size={16} /> Raise another
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="wizard">
      <div className="page-head">
        <div>
          <Link to={home} className="back-link">
            <ArrowLeft size={16} /> Dashboard
          </Link>
          <h2>Raise a complaint</h2>
          <p>Five quick steps to report a campus issue.</p>
        </div>
      </div>

      {/* Step indicator */}
      <ol className="steps" style={{ '--progress': step / (STEPS.length - 1) } as CSSProperties}>
        {STEPS.map((label, i) => (
          <li key={label} className={`steps__item ${i < step ? 'is-done' : i === step ? 'is-current' : ''}`}>
            <button
              type="button"
              className="steps__dot"
              onClick={() => i < step && setStep(i)}
              disabled={i >= step}
              aria-label={`Step ${i + 1}: ${label}`}
              aria-current={i === step ? 'step' : undefined}
            >
              {i < step ? <Check size={14} strokeWidth={3} /> : i + 1}
            </button>
            <span className="steps__label">{label}</span>
          </li>
        ))}
      </ol>

      <section className="panel glass wizard__panel" key={step}>
        {step === 0 && (
          <div className="wizard__step">
            <h3>Add a photo of the problem</h3>
            <p className="wizard__lead">A clear photo helps the team bring the right parts the first time.</p>

            {photo ? (
              <div className="photo-preview">
                <img src={photo.url} alt="Selected problem photo" />
                <div className="photo-preview__bar">
                  <span>{photo.name}</span>
                  <button type="button" className="btn btn-ghost" onClick={() => fileRef.current?.click()}>
                    <RefreshCw size={16} /> Replace
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className={`dropzone ${dragging ? 'is-dragging' : ''}`}
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
              >
                <span className="dropzone__icon">
                  <ImagePlus size={30} />
                </span>
                <strong>Take or upload a photo</strong>
                <small>Drag an image here or tap to choose · JPG, PNG or WebP up to 5 MB</small>
                <span className="dropzone__cta">
                  <Camera size={16} /> Choose photo
                </span>
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept={MIME.join(',')}
              className="sr-only"
              onChange={(e) => {
                takeFile(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
            {photoError && <p className="form-error">{photoError}</p>}
          </div>
        )}

        {step === 1 && (
          <div className="wizard__step">
            <h3>What kind of asset is affected?</h3>
            <p className="wizard__lead">This decides which team handles the ticket.</p>
            <div className="choice-grid" role="radiogroup" aria-label="Asset type">
              {assetTypes.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  role="radio"
                  aria-checked={assetTypeId === a.id}
                  className={`choice ${assetTypeId === a.id ? 'is-selected' : ''}`}
                  onClick={() => setAssetTypeId(a.id)}
                >
                  <span className="choice__icon">
                    <AssetIcon id={a.id} size={24} />
                  </span>
                  <strong>{a.name}</strong>
                  <span className="choice__tick" aria-hidden="true">
                    <Check size={12} strokeWidth={3} />
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="wizard__step">
            <h3>Where is it?</h3>
            <p className="wizard__lead">Only locations you are permitted to report for are listed.</p>

            <p className="form-label">Building</p>
            <div className="choice-grid choice-grid--wide" role="radiogroup" aria-label="Building">
              {buildings.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  role="radio"
                  aria-checked={buildingId === b.id}
                  className={`choice choice--row ${buildingId === b.id ? 'is-selected' : ''}`}
                  onClick={() => {
                    setBuildingId(b.id);
                    setFloorId('');
                    setLabId('');
                  }}
                >
                  <span className="choice__icon">
                    <Building2 size={20} />
                  </span>
                  <strong>{b.name}</strong>
                  <span className="choice__tick" aria-hidden="true">
                    <Check size={12} strokeWidth={3} />
                  </span>
                </button>
              ))}
            </div>

            {buildingId && (
              <div className="reveal">
                <p className="form-label">Floor</p>
                <div className="chips" role="radiogroup" aria-label="Floor">
                  {floors.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      role="radio"
                      aria-checked={floorId === f.id}
                      className={`chip ${floorId === f.id ? 'is-selected' : ''}`}
                      onClick={() => {
                        setFloorId(f.id);
                        setLabId('');
                      }}
                    >
                      {f.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {floorId && (
              <div className="reveal">
                <p className="form-label">Lab / room</p>
                <div className="chips" role="radiogroup" aria-label="Lab or room">
                  {labs.map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      role="radio"
                      aria-checked={labId === l.id}
                      className={`chip ${labId === l.id ? 'is-selected' : ''}`}
                      onClick={() => setLabId(l.id)}
                    >
                      {l.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="wizard__step">
            <h3>Describe the issue</h3>
            <p className="wizard__lead">Mention the system or seat number and what happens.</p>
            <label htmlFor="desc" className="form-label">
              Description
            </label>
            <textarea
              id="desc"
              className="textarea"
              rows={5}
              maxLength={MAX_DESC}
              placeholder="e.g. System 14 in row B does not boot; stuck on the BIOS screen since morning."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={() => setTouched(true)}
              aria-invalid={touched && !valid[3]}
            />
            <div className="desc-foot">
              {touched && descLen < MIN_DESC ? (
                <p className="form-error">Please write at least {MIN_DESC} characters.</p>
              ) : (
                <p className="form-hint">Avoid personal details such as phone numbers or passwords.</p>
              )}
              <span className="desc-count">
                {descLen}/{MAX_DESC}
              </span>
            </div>
          </div>
        )}

        {step === 4 && asset && (
          <div className="wizard__step">
            <h3>Review and submit</h3>
            <p className="wizard__lead">Check the details. You can edit any step.</p>

            <div className="review">
              {photo && <img src={photo.url} alt="Problem photo" className="review__photo" />}
              <dl className="review__list">
                <div>
                  <dt>Asset</dt>
                  <dd>
                    <AssetIcon id={asset.id} size={16} /> {asset.name}
                  </dd>
                  <button type="button" className="review__edit" onClick={() => setStep(1)} aria-label="Edit asset">
                    <Pencil size={14} />
                  </button>
                </div>
                <div>
                  <dt>Location</dt>
                  <dd>{locationPath(labId)}</dd>
                  <button type="button" className="review__edit" onClick={() => setStep(2)} aria-label="Edit location">
                    <Pencil size={14} />
                  </button>
                </div>
                <div>
                  <dt>Description</dt>
                  <dd>{description.trim()}</dd>
                  <button type="button" className="review__edit" onClick={() => setStep(3)} aria-label="Edit description">
                    <Pencil size={14} />
                  </button>
                </div>
                <div>
                  <dt>Priority</dt>
                  <dd>
                    <PriorityBadge priority={asset.defaultPriority} />
                    <span className="review__muted">target {SLA_HOURS[asset.defaultPriority]} h · set automatically</span>
                  </dd>
                </div>
              </dl>
            </div>

            <div className={`route-card ${route ? '' : 'route-card--none'}`}>
              {route ? <Route size={20} /> : <Inbox size={20} />}
              <span>
                {route ? (
                  <>
                    Will be routed to <strong>{userName(route.assigneeId)}</strong> (rule for{' '}
                    {getLocation(route.rule.locationId)?.name} · {asset.name}).
                  </>
                ) : (
                  <>
                    No team is mapped to this lab and asset yet. It will go to the <strong>unassigned queue</strong> for
                    the Super Admin.
                  </>
                )}
              </span>
            </div>
          </div>
        )}
      </section>

      <div className="wizard__nav">
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0 || submitting}
        >
          <ArrowLeft size={16} /> Back
        </button>
        {step < STEPS.length - 1 ? (
          <button type="button" className="btn btn-primary" onClick={next} disabled={step !== 0 && step !== 3 && !valid[step]}>
            Continue <ArrowRight size={16} />
          </button>
        ) : (
          <button type="button" className="btn btn-accent wizard__submit" onClick={submit} disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 size={16} className="spin" /> Submitting…
              </>
            ) : (
              <>
                <Send size={16} /> Submit complaint
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
