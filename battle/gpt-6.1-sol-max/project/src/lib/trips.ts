import { destinations, getDestination, type Experience } from '../data/destinations';

export type Pace = 'slow' | 'balanced' | 'adventure';

export interface TripConfig {
  destinationId: string;
  startDate: string;
  days: number;
  travelers: number;
  pace: Pace;
}

export interface Trip extends TripConfig {
  id: string;
  createdAt: string;
}

export interface TripDay {
  day: number;
  date: string;
  title: string;
  morning: Experience;
  afternoon: Experience;
  evening: Experience;
}

export const paceLabels: Record<Pace, string> = {
  slow: 'Slow & easy',
  balanced: 'A little of everything',
  adventure: 'Adventure first',
};

export function dateAfter(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return localDate(date);
}

function localDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function formatDate(value: string, options?: Intl.DateTimeFormatOptions): string {
  return new Date(`${value}T12:00:00`).toLocaleDateString('en-US', options ?? { month: 'short', day: 'numeric' });
}

export function createTrip(config: TripConfig): Trip {
  return {
    ...config,
    id: typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `trip-${Date.now()}`,
    createdAt: new Date().toISOString(),
  };
}

export function buildItinerary(trip: TripConfig): TripDay[] {
  const destination = getDestination(trip.destinationId);
  const activities: Experience[] = [
    ...destination.experiences,
    { title: 'Follow a local recommendation', description: 'Ask your host for a favorite place away from the usual route and leave time to enjoy the journey there.' },
    { title: 'A taste of local life', description: 'Visit a neighborhood food shop or market and try something you have not tasted before.' },
    { title: 'A different point of view', description: 'Choose an accessible viewpoint or a scenic neighborhood walk, with time to stop along the way.' },
    { title: 'Meet the makers', description: 'Browse locally owned shops, talk to the people behind them, and discover something made nearby.' },
    { title: 'Your own little discovery', description: `Leave a few hours to explore ${destination.name} without a checklist. Stay on public paths and follow your curiosity.` },
    { title: 'One place, a little longer', description: 'Return to a place you loved and see what happens when you give it a little more time.' },
  ];
  let activityIndex = 0;
  const nextActivity = () => activities[activityIndex++ % activities.length];

  return Array.from({ length: trip.days }, (_, index) => {
    const date = new Date(`${trip.startDate}T12:00:00`);
    date.setDate(date.getDate() + index);
    const isLastDay = index === trip.days - 1;
    const easyMorning = trip.pace === 'slow' || (trip.pace === 'balanced' && index % 2 === 0 && !isLastDay);
    const morning = index === 0
      ? { title: 'Arrive. Breathe. Settle in.', description: `Drop your bags, find a favorite coffee spot, and get to know your little corner of ${destination.name}.` }
      : easyMorning
        ? { title: 'Start the day slowly', description: 'Enjoy a leisurely breakfast and leave a little space for something unexpected. There is no need to rush.' }
        : nextActivity();
    const afternoon = isLastDay
      ? { title: 'One last wander', description: 'Revisit a favorite corner, pick up something small to remember the journey, and leave plenty of time for onward travel.' }
      : nextActivity();

    return {
      day: index + 1,
      date: localDate(date),
      title: index === 0 ? 'A new place, a fresh perspective' : isLastDay ? 'One more moment, before you go' : afternoon.title,
      morning,
      afternoon,
      evening: isLastDay ? {
        title: 'Take a little elsewhere home',
        description: 'Make the journey home, or enjoy a final local dinner if you are leaving tomorrow. Keep the memories, and a little of this slower rhythm.',
      } : {
        title: index % 2 === 0 ? 'A taste of somewhere new' : 'Let the evening unfold',
        description: index % 2 === 0 ? destination.evening : 'Take an easy evening walk, revisit a favorite spot, or follow a recommendation from someone local.',
      },
    };
  });
}

export function downloadItinerary(trip: Trip): void {
  const destination = getDestination(trip.destinationId);
  const lines = [
    'ELSEWHERE | Your next adventure',
    `${trip.days} days in ${destination.name}, ${destination.country}`,
    `${formatDate(trip.startDate, { month: 'long', day: 'numeric', year: 'numeric' })} | ${trip.travelers} traveler${trip.travelers === 1 ? '' : 's'} | ${paceLabels[trip.pace]}`,
    '',
    ...buildItinerary(trip).flatMap((day) => [
      `DAY ${day.day} | ${formatDate(day.date)} | ${day.title}`,
      `Morning: ${day.morning.title}. ${day.morning.description}`,
      `Afternoon: ${day.afternoon.title}. ${day.afternoon.description}`,
      `Evening: ${day.evening.title}. ${day.evening.description}`,
      '',
    ]),
    'A starting point, not a booking. Check opening times, transport, weather, and local guidance before you go.',
  ];
  const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `elsewhere-${destination.id}-itinerary.txt`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function readStoredArray<T>(key: string, validate: (value: unknown) => value is T): T[] {
  try {
    const data: unknown = JSON.parse(localStorage.getItem(key) ?? '[]');
    return Array.isArray(data) ? data.filter(validate) : [];
  } catch {
    return [];
  }
}

export function isTrip(value: unknown): value is Trip {
  if (!value || typeof value !== 'object') return false;
  const trip = value as Partial<Trip>;
  return typeof trip.id === 'string'
    && typeof trip.createdAt === 'string'
    && typeof trip.destinationId === 'string'
    && destinations.some((destination) => destination.id === trip.destinationId)
    && typeof trip.startDate === 'string'
    && /^\d{4}-\d{2}-\d{2}$/.test(trip.startDate)
    && !Number.isNaN(new Date(`${trip.startDate}T12:00:00`).getTime())
    && Number.isInteger(trip.days) && (trip.days ?? 0) >= 3 && (trip.days ?? 0) <= 7
    && Number.isInteger(trip.travelers) && (trip.travelers ?? 0) >= 1 && (trip.travelers ?? 0) <= 8
    && ['slow', 'balanced', 'adventure'].includes(trip.pace ?? '');
}