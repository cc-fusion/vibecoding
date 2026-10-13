import { useState } from 'react';
import { ArrowUpRight, Bookmark, Compass, Map, Trash2 } from 'lucide-react';
import { getDestination } from '../data/destinations';
import { formatDate, type Trip } from '../lib/trips';
import Modal from './Modal';

interface SavedDrawerProps {
  savedIds: string[];
  trips: Trip[];
  onExplore: (id: string) => void;
  onRemovePlace: (id: string) => void;
  onOpenTrip: (trip: Trip) => void;
  onRemoveTrip: (id: string) => void;
  onBrowse: () => void;
  onPlan: () => void;
  onClose: () => void;
}

export default function SavedDrawer({ savedIds, trips, onExplore, onRemovePlace, onOpenTrip, onRemoveTrip, onBrowse, onPlan, onClose }: SavedDrawerProps) {
  const [tab, setTab] = useState<'places' | 'trips'>(savedIds.length === 0 && trips.length > 0 ? 'trips' : 'places');
  return (
    <Modal onClose={onClose} className="saved-drawer" drawer>
      <div className="saved-drawer-header">
        <p className="eyebrow">A LITTLE SOMEDAY LIST</p>
        <h2 id="dialog-title">Your elsewhere.</h2>
        <p>Good places, kept close.</p>
      </div>
      <div className="saved-tabs" role="tablist" aria-label="Saved items" onKeyDown={(event) => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const next = event.key === 'Home' ? 'places' : event.key === 'End' ? 'trips' : tab === 'places' ? 'trips' : 'places';
        setTab(next);
        event.currentTarget.querySelector<HTMLElement>(`#saved-${next}-tab`)?.focus();
      }}>
        <button role="tab" id="saved-places-tab" tabIndex={tab === 'places' ? 0 : -1} aria-selected={tab === 'places'} aria-controls="saved-places-panel" className={tab === 'places' ? 'active' : ''} onClick={() => setTab('places')}>Places<span>{savedIds.length}</span></button>
        <button role="tab" id="saved-trips-tab" tabIndex={tab === 'trips' ? 0 : -1} aria-selected={tab === 'trips'} aria-controls="saved-trips-panel" className={tab === 'trips' ? 'active' : ''} onClick={() => setTab('trips')}>Itineraries<span>{trips.length}</span></button>
      </div>
      <div className="saved-drawer-body" role="tabpanel" id={tab === 'places' ? 'saved-places-panel' : 'saved-trips-panel'} aria-labelledby={tab === 'places' ? 'saved-places-tab' : 'saved-trips-tab'}>
        {tab === 'places' && savedIds.length === 0 && (
          <div className="saved-empty">
            <Bookmark size={38} strokeWidth={1.1} />
            <h3>A little room for possibility.</h3>
            <p>Tap the bookmark on any place that catches your eye. Your next adventure might start here.</p>
            <button className="button button-dark" onClick={onBrowse}>Explore the places<ArrowUpRight size={18} /></button>
          </div>
        )}
        {tab === 'places' && savedIds.map((id) => {
          const destination = getDestination(id);
          return (
            <article className="saved-place-row" key={id}>
              <button className="saved-place-photo" onClick={() => onExplore(id)} aria-label={`Explore ${destination.name}`}><img src={destination.image} alt={destination.imageAlt} /></button>
              <button className="saved-place-info" onClick={() => onExplore(id)}><small>{destination.country}</small><h3>{destination.name}</h3><span>Take a closer look<ArrowUpRight size={14} /></span></button>
              <button className="icon-button remove-saved" onClick={() => onRemovePlace(id)} aria-label={`Remove ${destination.name} from saved places`}><Trash2 size={17} strokeWidth={1.5} /></button>
            </article>
          );
        })}
        {tab === 'trips' && trips.length === 0 && (
          <div className="saved-empty">
            <Map size={40} strokeWidth={1.1} />
            <h3>From someday to a plan.</h3>
            <p>Build an itinerary that leaves room for the unexpected. Save it here when it feels like you.</p>
            <button className="button button-dark" onClick={onPlan}>Plan a little escape<ArrowUpRight size={18} /></button>
          </div>
        )}
        {tab === 'trips' && trips.map((trip) => {
          const destination = getDestination(trip.destinationId);
          return (
            <article className="saved-trip-row" key={trip.id}>
              <Compass size={26} strokeWidth={1.2} />
              <button className="saved-trip-info" onClick={() => onOpenTrip(trip)}><small>{formatDate(trip.startDate, { month: 'short', day: 'numeric', year: 'numeric' })}</small><h3>{trip.days} days in {destination.name}</h3><span>{trip.travelers} traveler{trip.travelers === 1 ? '' : 's'}<ArrowUpRight size={15} /></span></button>
              <button className="icon-button remove-saved" onClick={() => onRemoveTrip(trip.id)} aria-label={`Delete itinerary for ${destination.name}`}><Trash2 size={17} strokeWidth={1.5} /></button>
            </article>
          );
        })}
      </div>
      <div className="saved-drawer-footer"><span className="tiny-dot" />Saved in this browser. Ready when you are.</div>
    </Modal>
  );
}