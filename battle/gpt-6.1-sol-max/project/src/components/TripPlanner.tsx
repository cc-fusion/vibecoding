import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowUpRight, Check, ChevronDown, Download, MapPin, Bookmark } from 'lucide-react';
import { destinations, getDestination } from '../data/destinations';
import { buildItinerary, createTrip, dateAfter, downloadItinerary, formatDate, paceLabels, type Pace, type Trip, type TripConfig } from '../lib/trips';
import Modal from './Modal';

interface TripPlannerProps {
  destinationId?: string;
  initialTrip?: Trip;
  savedTrips: Trip[];
  onSave: (trip: Trip) => void;
  onClose: () => void;
}

const paceDescriptions: Record<Pace, string> = {
  slow: 'Room to breathe',
  balanced: 'The best of both',
  adventure: 'Follow the feeling',
};

export default function TripPlanner({ destinationId, initialTrip, savedTrips, onSave, onClose }: TripPlannerProps) {
  const [config, setConfig] = useState<TripConfig>(() => initialTrip ?? {
    destinationId: destinationId ?? 'dolomites',
    startDate: dateAfter(14),
    days: 5,
    travelers: 2,
    pace: 'balanced',
  });
  const [result, setResult] = useState<Trip | null>(initialTrip ?? null);
  const destination = getDestination(result?.destinationId ?? config.destinationId);
  const alreadySaved = result ? savedTrips.some((trip) => trip.id === result.id) : false;
  const itinerary = result ? buildItinerary(result) : [];
  const content = useRef<HTMLDivElement>(null);
  const showingResult = result !== null;

  useEffect(() => {
    content.current?.querySelector<HTMLElement>('#dialog-title')?.focus({ preventScroll: true });
    content.current?.closest('.dialog-panel')?.scrollTo({ top: 0, behavior: 'instant' });
  }, [showingResult]);

  const update = <K extends keyof TripConfig>(key: K, value: TripConfig[K]) => setConfig((current) => ({ ...current, [key]: value }));

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setResult(createTrip(config));
  };

  return (
    <Modal onClose={onClose} className={`planner-dialog ${result ? 'has-itinerary' : ''}`}>
      <aside className="planner-aside">
        <img key={destination.id} src={destination.image} alt={destination.imageAlt} />
        <div className="planner-aside-content">
          <p className="eyebrow">YOUR NEXT ELSEWHERE</p>
          <h3>{destination.name}</h3>
          <p className="planner-location"><MapPin size={15} />{destination.country}</p>
          <span>{destination.tagline}</span>
        </div>
      </aside>
      <div className="planner-content" ref={content}>
        {!result ? (
          <>
            <p className="eyebrow">01 / A LITTLE POSSIBILITY</p>
            <h2 id="dialog-title" tabIndex={-1}>Good trips start<br />with a little curiosity.</h2>
            <p className="planner-intro">Tell us what feels like you. We will help with the first few steps.</p>
            <form onSubmit={submit} className="planner-form">
              <label className="form-field">
                <span>Where are we going?</span>
                <div className="select-wrap">
                  <select value={config.destinationId} onChange={(event) => update('destinationId', event.target.value)} required>
                    {destinations.map((place) => <option value={place.id} key={place.id}>{place.name}, {place.country}</option>)}
                  </select>
                  <ChevronDown size={17} />
                </div>
              </label>
              <div className="form-row">
                <label className="form-field"><span>When does it begin?</span><input type="date" value={config.startDate} min={dateAfter(0)} onChange={(event) => update('startDate', event.target.value)} required /></label>
                <label className="form-field"><span>How long?</span><div className="select-wrap"><select value={config.days} onChange={(event) => update('days', Number(event.target.value))}>{[3, 4, 5, 6, 7].map((days) => <option key={days} value={days}>{days} days</option>)}</select><ChevronDown size={17} /></div></label>
              </div>
              <label className="form-field travelers-field"><span>Who's coming?</span><div className="select-wrap"><select value={config.travelers} onChange={(event) => update('travelers', Number(event.target.value))}>{Array.from({ length: 8 }, (_, index) => index + 1).map((count) => <option key={count} value={count}>{count === 1 ? 'Just me' : `${count} travelers`}</option>)}</select><ChevronDown size={17} /></div></label>
              <fieldset className="pace-fieldset">
                <legend>Find your rhythm</legend>
                <div className="pace-options">
                  {(['slow', 'balanced', 'adventure'] as Pace[]).map((pace) => (
                    <label className={`pace-option ${config.pace === pace ? 'selected' : ''}`} key={pace}>
                      <input type="radio" name="pace" value={pace} checked={config.pace === pace} onChange={() => update('pace', pace)} />
                      <span className="pace-radio">{config.pace === pace && <span />}</span>
                      <strong>{paceLabels[pace]}</strong><small>{paceDescriptions[pace]}</small>
                    </label>
                  ))}
                </div>
              </fieldset>
              <button className="button button-dark build-trip" type="submit">Find my kind of adventure<ArrowUpRight size={19} /></button>
              <p className="form-note">A thoughtful starting point. No bookings, no pressure.</p>
            </form>
          </>
        ) : (
          <>
            <button className="text-link edit-trip" onClick={() => setResult(null)}><ArrowLeft size={15} />Make it a little more you</button>
            <p className="eyebrow">02 / THE GOOD PART</p>
            <h2 id="dialog-title" tabIndex={-1}>Your next chapter,<br />loosely planned.</h2>
            <p className="itinerary-summary">{result.days} days in {destination.name}<span />{formatDate(result.startDate)}<span />{result.travelers} traveler{result.travelers === 1 ? '' : 's'}</p>
            <div className="itinerary-list">
              {itinerary.map((day) => (
                <details className="itinerary-day" key={`${result.id}-${day.day}`} open={day.day === 1 ? true : undefined}>
                  <summary><span className="day-number">{String(day.day).padStart(2, '0')}</span><span className="day-title"><small>{formatDate(day.date, { weekday: 'short', month: 'short', day: 'numeric' })}</small><strong>{day.title}</strong></span><ChevronDown size={19} /></summary>
                  <div className="day-moments">
                    {(['morning', 'afternoon', 'evening'] as const).map((period) => (
                      <div className="day-moment" key={period}><small>{period}</small><h4>{day[period].title}</h4><p>{day[period].description}</p></div>
                    ))}
                  </div>
                </details>
              ))}
            </div>
            <div className="itinerary-actions">
              <button className="button button-dark" onClick={() => onSave(result)} disabled={alreadySaved}>{alreadySaved ? <Check size={17} /> : <Bookmark size={17} />}{alreadySaved ? 'Itinerary saved' : 'Save my itinerary'}</button>
              <button className="button button-outline" onClick={() => downloadItinerary(result)}><Download size={17} />Download</button>
            </div>
            <p className="form-note itinerary-note">A starting point, not a booking. Check local opening times, transport, weather, and trail conditions before you go.</p>
          </>
        )}
      </div>
    </Modal>
  );
}