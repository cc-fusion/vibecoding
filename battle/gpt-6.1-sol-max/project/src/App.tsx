import { forwardRef, useCallback, useEffect, useState } from 'react';
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, ArrowUpRight, Asterisk, Bookmark, Check, Menu, Search, Shuffle, X } from 'lucide-react';
import { categories, collectionImage, destinations, getDestination, heroImage, type Category, type Destination } from './data/destinations';
import { isTrip, readStoredArray, type Trip } from './lib/trips';
import { CollectionDialog, DestinationDialog, StoryDialog } from './components/ContentDialogs';
import SavedDrawer from './components/SavedDrawer';
import TripPlanner from './components/TripPlanner';

type Overlay =
  | { kind: 'destination'; id: string }
  | { kind: 'saved' }
  | { kind: 'planner'; destinationId?: string; trip?: Trip }
  | { kind: 'collection' }
  | { kind: 'story' }
  | null;

function Brand({ footer = false }: { footer?: boolean }) {
  return <span className={`brand ${footer ? 'footer-brand' : ''}`}><Asterisk aria-hidden="true" strokeWidth={1.65} /><span>elsewhere<span className="brand-period">.</span></span></span>;
}

interface PlaceProps {
  destination: Destination;
  index: number;
  saved: boolean;
  onExplore: () => void;
  onSave: () => void;
}

const Place = forwardRef<HTMLElement, PlaceProps>(function Place({ destination, index, saved, onExplore, onSave }, ref) {
  return (
    <motion.article
      ref={ref}
      className="destination-place"
      layout
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -30px 0px' }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.45, delay: index % 4 * 0.07 }}
    >
      <div className="place-image-wrap">
        <button type="button" className="place-image-button" onClick={onExplore} aria-label={`Explore ${destination.name}`}>
          <img src={destination.image} alt={destination.imageAlt} loading="lazy" />
        </button>
        <button type="button" className={`save-place ${saved ? 'is-saved' : ''}`} onClick={onSave} aria-label={`${saved ? 'Unsave' : 'Save'} ${destination.name}`} aria-pressed={saved}>
          <Bookmark size={18} strokeWidth={1.6} fill={saved ? 'currentColor' : 'none'} />
        </button>
      </div>
      <button className="place-caption" type="button" onClick={onExplore}>
        <span className="place-category">{destination.categoryLabel}</span>
        <span className="place-title-row"><span className="place-heading" role="heading" aria-level={3}>{destination.name}</span><ArrowUpRight size={23} strokeWidth={1.4} /></span>
        <span className="place-country">{destination.country}<span className="country-divider" />{destination.idealDays}</span>
      </button>
    </motion.article>
  );
});

export default function App() {
  const reduceMotion = useReducedMotion();
  const [category, setCategory] = useState<Category>('all');
  const [search, setSearch] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [toast, setToast] = useState('');
  const [savedIds, setSavedIds] = useState<string[]>(() => readStoredArray('elsewhere.places', (value): value is string => typeof value === 'string' && destinations.some((place) => place.id === value)));
  const [savedTrips, setSavedTrips] = useState<Trip[]>(() => readStoredArray('elsewhere.trips', isTrip));
  const closeOverlay = useCallback(() => setOverlay(null), []);

  useEffect(() => {
    try { localStorage.setItem('elsewhere.places', JSON.stringify(savedIds)); } catch { /* Keep the session usable when browser storage is unavailable. */ }
  }, [savedIds]);

  useEffect(() => {
    try { localStorage.setItem('elsewhere.trips', JSON.stringify(savedTrips)); } catch { /* Saved trips remain available for this session. */ }
  }, [savedTrips]);

  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(''), 3200);
    return () => clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    if (!menuOpen) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        document.getElementById('mobile-menu-button')?.focus();
      }
    };
    document.addEventListener('keydown', onEscape);
    return () => document.removeEventListener('keydown', onEscape);
  }, [menuOpen]);

  const scrollTo = (id: string) => {
    setMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  };

  const browse = () => {
    setOverlay(null);
    setCategory('all');
    setSearch('');
    scrollTo('explore');
  };

  const toggleSave = (id: string) => {
    const isSaved = savedIds.includes(id);
    setSavedIds((current) => current.includes(id) ? current.filter((savedId) => savedId !== id) : [...current, id]);
    setToast(isSaved ? `${getDestination(id).name} removed from your list` : `${getDestination(id).name} saved for someday`);
  };

  const saveTrip = (trip: Trip) => {
    setSavedTrips((current) => current.some((saved) => saved.id === trip.id) ? current : [trip, ...current]);
    setToast('Your next chapter is saved');
  };

  const query = search.trim().toLowerCase();
  const filtered = destinations.filter((place) => (category === 'all' || place.category === category)
    && (!query || `${place.name} ${place.country} ${place.categoryLabel} ${place.tagline}`.toLowerCase().includes(query)));
  const showingEverything = showAll && category === 'all' && !query;
  const visible = !showAll && category === 'all' && !query ? filtered.slice(0, 4) : filtered;
  const savedCount = savedIds.length + savedTrips.length;

  const exploreAll = () => {
    if (showingEverything) setShowAll(false);
    else { setCategory('all'); setSearch(''); setShowAll(true); }
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className="app">
        <a className="skip-link" href="#explore">Skip to destinations</a>
        <header className="site-header">
          <div className="header-inner">
            <a className="brand-link" href="#home" aria-label="Elsewhere home" onClick={(event) => { event.preventDefault(); scrollTo('home'); }}><Brand /></a>
            <nav className="desktop-nav" aria-label="Main navigation">
              <a href="#explore" className="nav-link nav-link-active" onClick={(event) => { event.preventDefault(); scrollTo('explore'); }}>Explore</a>
              <a href="#collections" className="nav-link" onClick={(event) => { event.preventDefault(); scrollTo('collections'); }}>Collections</a>
              <button className="nav-link" onClick={() => setOverlay({ kind: 'story' })}>Our story</button>
            </nav>
            <div className="header-actions">
              <button className="saved-nav" aria-label={`Saved places${savedCount ? `, ${savedCount} saved items` : ''}`} onClick={() => { setMenuOpen(false); setOverlay({ kind: 'saved' }); }}><Bookmark size={17} strokeWidth={1.5} /><span>Saved places</span>{savedCount > 0 && <span className="saved-count">{savedCount}</span>}</button>
              <button className="button button-dark header-plan" onClick={() => setOverlay({ kind: 'planner' })}>Plan a trip<ArrowUpRight size={16} /></button>
              <button id="mobile-menu-button" className="icon-button mobile-menu-toggle" aria-expanded={menuOpen} aria-controls="mobile-navigation" aria-label={menuOpen ? 'Close navigation' : 'Open navigation'} onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X size={24} /> : <Menu size={24} />}</button>
            </div>
          </div>
          <AnimatePresence>
            {menuOpen && (
              <motion.nav id="mobile-navigation" className="mobile-nav" aria-label="Mobile navigation" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                <a href="#explore" onClick={(event) => { event.preventDefault(); scrollTo('explore'); }}>Explore<ArrowUpRight size={18} /></a>
                <a href="#collections" onClick={(event) => { event.preventDefault(); scrollTo('collections'); }}>Collections<ArrowUpRight size={18} /></a>
                <button onClick={() => { setMenuOpen(false); setOverlay({ kind: 'story' }); }}>Our story<ArrowUpRight size={18} /></button>
                <button onClick={() => { setMenuOpen(false); setOverlay({ kind: 'planner' }); }}>Plan a trip<ArrowUpRight size={18} /></button>
              </motion.nav>
            )}
          </AnimatePresence>
        </header>

        <main>
          <section className="hero" id="home" aria-labelledby="hero-title">
            <motion.img className="hero-image" src={heroImage} alt="A quiet emerald lake beneath the soaring peaks of the Italian Dolomites" fetchPriority="high" initial={{ scale: 1.07 }} animate={{ scale: 1 }} transition={{ duration: 2.2, ease: [0.2, 0.7, 0.3, 1] }} />
            <div className="hero-shade" />
            <div className="hero-content page-width">
              <motion.p className="eyebrow hero-eyebrow" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.6 }}>FOR THE WONDERFULLY CURIOUS</motion.p>
              <motion.h1 id="hero-title" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.27, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}>Find your<br /><em>elsewhere.</em></motion.h1>
              <motion.p className="hero-description" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.43, duration: 0.7 }}>Extraordinary places. A slower pace.<br />A journey that feels a little more like you.</motion.p>
              <motion.div className="hero-actions" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.58, duration: 0.6 }}>
                <button className="button button-cream" onClick={() => scrollTo('explore')}>Explore the places<ArrowUpRight size={19} strokeWidth={1.6} /></button>
                <button className="hero-surprise" onClick={() => setOverlay({ kind: 'destination', id: destinations[Math.floor(Math.random() * destinations.length)].id })}><Shuffle size={16} strokeWidth={1.5} />Surprise me</button>
              </motion.div>
            </div>
          </section>

          <section className="explore-section page-width" id="explore" aria-labelledby="explore-title">
            <div className="section-heading">
              <div><p className="eyebrow">FOLLOW YOUR CURIOSITY</p><h2 id="explore-title">Where to next?</h2><p className="section-description">A few good places to get a little lost.</p></div>
              <button className="text-link view-all" onClick={exploreAll} aria-expanded={showingEverything} aria-controls="destination-results"><span className="all-desktop-label">{showingEverything ? 'A little less, please' : 'View all destinations'}</span><span className="all-mobile-label">{showingEverything ? 'Show less' : 'View all'}</span><ArrowUpRight size={18} strokeWidth={1.5} /></button>
            </div>
            <div className="explore-tools">
              <div className="category-tabs" role="group" aria-label="Filter destinations">
                {categories.map((item) => <button key={item.id} type="button" aria-pressed={category === item.id} className={category === item.id ? 'active' : ''} onClick={() => setCategory(item.id)}>{item.label}</button>)}
              </div>
              <div className="destination-search"><Search size={17} strokeWidth={1.5} /><label className="sr-only" htmlFor="place-search">Search destinations</label><input id="place-search" value={search} placeholder="Find a place..." onChange={(event) => setSearch(event.target.value)} />{search && <button className="clear-search" onClick={() => setSearch('')} aria-label="Clear search"><X size={15} /></button>}</div>
            </div>
            <div className="destination-grid" id="destination-results" aria-live="polite" aria-label={`${visible.length} destinations`}>
              <AnimatePresence mode="popLayout">
                {visible.map((destination, index) => <Place key={destination.id} destination={destination} index={index} saved={savedIds.includes(destination.id)} onExplore={() => setOverlay({ kind: 'destination', id: destination.id })} onSave={() => toggleSave(destination.id)} />)}
              </AnimatePresence>
            </div>
            {visible.length === 0 && <div className="search-empty"><Search size={28} strokeWidth={1.2} /><h3>A little further off the map.</h3><p>No places match {query ? `"${search.trim()}"` : 'this filter'} just yet. Try another name or a different kind of adventure.</p><button className="text-link" onClick={() => { setSearch(''); setCategory('all'); }}>Back to all places<ArrowRight size={17} /></button></div>}
          </section>

          <section className="collection-section" id="collections" aria-labelledby="collection-title">
            <motion.div className="collection-content" initial={{ opacity: 0, y: 25 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7 }}>
              <p className="eyebrow">THE SLOW TRAVEL COLLECTION</p>
              <h2 id="collection-title">Sometimes, the best<br />plan is <em>less.</em></h2>
              <p>Long lunches. Salt in your hair.<br />Nowhere else you need to be.</p>
              <button className="text-link collection-link" onClick={() => setOverlay({ kind: 'collection' })}>Discover the art of slowing down<ArrowUpRight size={20} strokeWidth={1.5} /></button>
            </motion.div>
            <button className="collection-photo" onClick={() => setOverlay({ kind: 'collection' })} aria-label="Discover the slow travel collection"><img src={collectionImage} alt="A swimming ladder on a quiet rocky shore overlooking the calm blue Amalfi sea" loading="lazy" /></button>
          </section>

          <section className="closing-section page-width" aria-labelledby="closing-title">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7 }}><Asterisk className="closing-star" size={38} strokeWidth={1.1} /><p className="eyebrow">FROM SOMEDAY TO SOMEWHERE</p><h2 id="closing-title">A little daydream.<br />A real <em>adventure.</em></h2><p>Make a little room for the places you have not met yet.</p><button className="button button-dark" onClick={() => setOverlay({ kind: 'planner' })}>Let's plan your elsewhere<ArrowUpRight size={19} strokeWidth={1.5} /></button></motion.div>
          </section>
        </main>

        <footer className="site-footer page-width">
          <div className="footer-main"><a href="#home" className="brand-link" onClick={(event) => { event.preventDefault(); scrollTo('home'); }} aria-label="Back to Elsewhere home"><Brand footer /></a><p>Go a little further.<br />Feel a little more.</p><nav aria-label="Footer navigation"><a href="#explore" onClick={(event) => { event.preventDefault(); scrollTo('explore'); }}>Explore</a><button onClick={() => setOverlay({ kind: 'saved' })}>Your saved places</button><button onClick={() => setOverlay({ kind: 'story' })}>Our story</button></nav></div>
          <div className="footer-bottom"><span>&copy; {new Date().getFullYear()} Elsewhere</span><span>Made for the wonderfully curious.</span><span>Less ordinary. More elsewhere.</span></div>
        </footer>

        <AnimatePresence mode="wait">
          {overlay?.kind === 'destination' && <DestinationDialog key={`destination-${overlay.id}`} destination={getDestination(overlay.id)} saved={savedIds.includes(overlay.id)} onSave={() => toggleSave(overlay.id)} onPlan={() => setOverlay({ kind: 'planner', destinationId: overlay.id })} onClose={closeOverlay} />}
          {overlay?.kind === 'saved' && <SavedDrawer key="saved" savedIds={savedIds} trips={savedTrips} onExplore={(id) => setOverlay({ kind: 'destination', id })} onRemovePlace={toggleSave} onOpenTrip={(trip) => setOverlay({ kind: 'planner', trip })} onRemoveTrip={(id) => { setSavedTrips((current) => current.filter((trip) => trip.id !== id)); setToast('Itinerary removed from your list'); }} onBrowse={browse} onPlan={() => setOverlay({ kind: 'planner' })} onClose={closeOverlay} />}
          {overlay?.kind === 'planner' && <TripPlanner key={`planner-${overlay.trip?.id ?? overlay.destinationId ?? 'new'}`} destinationId={overlay.destinationId} initialTrip={overlay.trip} savedTrips={savedTrips} onSave={saveTrip} onClose={closeOverlay} />}
          {overlay?.kind === 'collection' && <CollectionDialog key="collection" savedIds={savedIds} onSave={toggleSave} onExplore={(id) => setOverlay({ kind: 'destination', id })} onClose={closeOverlay} />}
          {overlay?.kind === 'story' && <StoryDialog key="story" onClose={closeOverlay} onExplore={browse} />}
        </AnimatePresence>

        <AnimatePresence>
          {toast && <motion.div className="toast" role="status" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}><Check size={17} strokeWidth={1.6} /><span>{toast}</span></motion.div>}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}
