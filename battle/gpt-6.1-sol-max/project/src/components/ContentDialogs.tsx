import { ArrowUpRight, Bookmark, CalendarDays, Check, Compass, MapPin } from 'lucide-react';
import { destinations, type Destination } from '../data/destinations';
import Modal from './Modal';

interface DestinationDialogProps {
  destination: Destination;
  saved: boolean;
  onSave: () => void;
  onPlan: () => void;
  onClose: () => void;
}

export function DestinationDialog({ destination, saved, onSave, onPlan, onClose }: DestinationDialogProps) {
  return (
    <Modal onClose={onClose} className="destination-dialog">
      <div className="destination-detail-image">
        <img src={destination.image} alt={destination.imageAlt} />
        <div className="detail-image-caption">
          <MapPin size={16} />
          <span>{destination.country}</span>
        </div>
      </div>
      <div className="destination-detail-content">
        <p className="eyebrow">{destination.categoryLabel}</p>
        <h2 id="dialog-title">{destination.name}</h2>
        <p className="detail-tagline">{destination.tagline}</p>
        <p className="detail-description">{destination.description}</p>
        <div className="destination-facts">
          <div><CalendarDays size={20} strokeWidth={1.5} /><span><small>BEST TIME TO GO</small>{destination.bestTime}</span></div>
          <div><Compass size={20} strokeWidth={1.5} /><span><small>MAKE A LITTLE TIME</small>{destination.idealDays}</span></div>
        </div>
        <h3 className="detail-list-heading">The moments worth going for</h3>
        <ul className="experience-list">
          {destination.experiences.slice(0, 3).map((experience) => (
            <li key={experience.title}><ArrowUpRight size={16} /><span>{experience.title}</span></li>
          ))}
        </ul>
        <div className="detail-actions">
          <button className="button button-dark" onClick={onPlan}>Make this my next trip<ArrowUpRight size={18} /></button>
          <button className={`button button-outline save-detail ${saved ? 'is-saved' : ''}`} onClick={onSave} aria-pressed={saved}>
            {saved ? <Check size={18} /> : <Bookmark size={18} />}{saved ? 'Saved' : 'Save place'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

interface CollectionDialogProps {
  savedIds: string[];
  onSave: (id: string) => void;
  onExplore: (id: string) => void;
  onClose: () => void;
}

export function CollectionDialog({ savedIds, onSave, onExplore, onClose }: CollectionDialogProps) {
  const collection = ['amalfi', 'madeira', 'bali'].map((id) => destinations.find((destination) => destination.id === id)!);
  return (
    <Modal onClose={onClose} className="collection-dialog">
      <p className="eyebrow">THE SLOW TRAVEL COLLECTION</p>
      <h2 id="dialog-title">Life in the slow lane.</h2>
      <p className="dialog-intro">Less rushing around. More being right here. Three places to practice the art of doing a little less.</p>
      <div className="collection-destinations">
        {collection.map((destination) => (
          <article key={destination.id} className="collection-place">
            <div className="collection-place-image">
              <button onClick={() => onExplore(destination.id)} aria-label={`Explore ${destination.name}`}>
                <img src={destination.image} alt={destination.imageAlt} />
              </button>
              <button className={`save-place ${savedIds.includes(destination.id) ? 'is-saved' : ''}`} onClick={() => onSave(destination.id)} aria-label={`${savedIds.includes(destination.id) ? 'Unsave' : 'Save'} ${destination.name}`} aria-pressed={savedIds.includes(destination.id)}>
                <Bookmark size={18} fill={savedIds.includes(destination.id) ? 'currentColor' : 'none'} strokeWidth={1.6} />
              </button>
            </div>
            <button className="collection-place-title" onClick={() => onExplore(destination.id)}><h3>{destination.name}</h3><ArrowUpRight size={20} /></button>
            <p>{destination.country}</p>
          </article>
        ))}
      </div>
      <p className="collection-note">Leave a little room in the itinerary for no itinerary at all.</p>
    </Modal>
  );
}

export function StoryDialog({ onClose, onExplore }: { onClose: () => void; onExplore: () => void }) {
  return (
    <Modal onClose={onClose} className="story-dialog">
      <Compass size={38} strokeWidth={1.1} className="story-compass" />
      <p className="eyebrow">A NOTE FROM ELSEWHERE</p>
      <h2 id="dialog-title">The world is not<br />a checklist.</h2>
      <p>It is a thousand little moments. A wrong turn that becomes your favorite street. A meal that lasts all afternoon. A view that makes you go quiet.</p>
      <p>Elsewhere is a starting point for those kinds of journeys. Thoughtfully chosen places, a little local context, and enough room to make the trip your own.</p>
      <p className="story-signoff">For the wonderfully curious.</p>
      <button className="button button-dark" onClick={onExplore}>Find your elsewhere<ArrowUpRight size={18} /></button>
      <small className="browser-note">Saved places and itineraries stay in this browser. We do not make bookings.</small>
    </Modal>
  );
}