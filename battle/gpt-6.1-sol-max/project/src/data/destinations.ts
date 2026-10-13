export type Category = 'all' | 'nature' | 'coast' | 'culture';

export interface Experience {
  title: string;
  description: string;
}

export interface Destination {
  id: string;
  name: string;
  country: string;
  category: Exclude<Category, 'all'>;
  categoryLabel: string;
  image: string;
  imageAlt: string;
  tagline: string;
  description: string;
  bestTime: string;
  idealDays: string;
  evening: string;
  experiences: Experience[];
}

export const heroImage = 'https://images.pexels.com/photos/27034992/pexels-photo-27034992.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200';
export const collectionImage = 'https://images.pexels.com/photos/19102632/pexels-photo-19102632.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200';

export const categories: { id: Category; label: string }[] = [
  { id: 'all', label: 'All places' },
  { id: 'nature', label: 'Into the wild' },
  { id: 'coast', label: 'By the water' },
  { id: 'culture', label: 'A little culture' },
];

export const destinations: Destination[] = [
  {
    id: 'dolomites',
    name: 'The Dolomites',
    country: 'Italy',
    category: 'nature',
    categoryLabel: 'Nature & adventure',
    image: 'https://images.pexels.com/photos/30201174/pexels-photo-30201174.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200',
    imageAlt: 'Emerald Lake Braies surrounded by the dramatic peaks of the Italian Dolomites',
    tagline: 'A little closer to the clouds.',
    description: 'Pale peaks, impossibly blue lakes, and trails that make you forget to check your phone. Find your own rhythm in the quiet corners of the Italian Alps.',
    bestTime: 'June to September',
    idealDays: '5 to 7 days',
    evening: 'Find a welcoming mountain restaurant for a leisurely South Tyrolean dinner.',
    experiences: [
      { title: 'A slow lap of Lago di Braies', description: 'Follow the lakeside path, stop by the wooden boathouse, and take your time with the mountain reflections.' },
      { title: 'Walk beneath the Tre Cime', description: 'Explore the trails around the famous three peaks. Choose a route that matches your experience and check conditions first.' },
      { title: 'Meadows of Alpe di Siusi', description: 'Spend an unhurried afternoon among alpine meadows, mountain huts, and wide-open views.' },
      { title: 'A morning in Cortina', description: 'Browse the little shops, order a second coffee, and explore the town on foot.' },
      { title: 'Follow the Val di Funes trails', description: 'Seek out village paths and mountain views in one of the region\'s loveliest valleys.' },
      { title: 'A mountain-hut lunch', description: 'Pick an accessible rifugio, enjoy local cooking, and leave plenty of time for the walk back.' },
    ],
  },
  {
    id: 'kyoto',
    name: 'Kyoto',
    country: 'Japan',
    category: 'culture',
    categoryLabel: 'Culture & connection',
    image: 'https://images.pexels.com/photos/30094291/pexels-photo-30094291.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=1200&w=800',
    imageAlt: 'Traditional Japanese temple framed by colorful autumn foliage',
    tagline: 'Old stories. New perspectives.',
    description: 'Quiet temple gardens, tiny tea houses, and lantern-lit lanes. Kyoto rewards a slower kind of curiosity, one small discovery at a time.',
    bestTime: 'March to May, October to November',
    idealDays: '4 to 6 days',
    evening: 'Explore the restaurants near Pontocho and settle in for a seasonal Japanese meal.',
    experiences: [
      { title: 'The lanes of Higashiyama', description: 'Wander the old streets early, stop at a local cafe, and discover traditional shopfronts along the way.' },
      { title: 'A quiet temple garden', description: 'Visit a temple garden, pause by the moss and stones, and let the city slow down around you.' },
      { title: 'Arashiyama beyond the bamboo', description: 'Enjoy the riverside paths and quieter backstreets as well as the famous bamboo grove.' },
      { title: 'Taste your way through Nishiki', description: 'Explore the market respectfully, try local specialties, and ask vendors about their favorites.' },
      { title: 'Walk the Philosopher\'s Path', description: 'Follow the canal between neighborhood cafes and small shrines at your own pace.' },
      { title: 'Fushimi Inari in the morning', description: 'Walk beneath the red torii gates and choose how far up the hillside you would like to go.' },
    ],
  },
  {
    id: 'madeira',
    name: 'Madeira',
    country: 'Portugal',
    category: 'coast',
    categoryLabel: 'Coast & calm',
    image: 'https://images.pexels.com/photos/31922516/pexels-photo-31922516.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=1200&w=800',
    imageAlt: 'Lush green Madeira valley descending toward the Atlantic Ocean',
    tagline: 'Wild at heart. Easy on the soul.',
    description: 'An island of cloud-brushing peaks, green valleys, and Atlantic swims. Take the long way around and discover that the journey really is the good part.',
    bestTime: 'April to October',
    idealDays: '5 to 7 days',
    evening: 'Enjoy a relaxed seafood dinner and a stroll beside the harbor in Funchal.',
    experiences: [
      { title: 'The old streets of Funchal', description: 'Walk the old town, browse the market, and find a sunny table for a long lunch.' },
      { title: 'Follow a levada', description: 'Choose an open, suitable levada trail and wander beside the island\'s historic water channels.' },
      { title: 'A dip at Porto Moniz', description: 'Visit the volcanic swimming pools when sea conditions allow, then explore the north coast.' },
      { title: 'Up above the clouds', description: 'Visit an accessible mountain viewpoint. Check weather, road access, and trail status before setting out.' },
      { title: 'The fishing village of Camara de Lobos', description: 'Spend an afternoon with colorful boats, coastal paths, and a little local flavor.' },
      { title: 'A garden afternoon', description: 'Explore Funchal\'s gardens and enjoy the island\'s extraordinary variety of plants.' },
    ],
  },
  {
    id: 'amalfi',
    name: 'Amalfi Coast',
    country: 'Italy',
    category: 'coast',
    categoryLabel: 'Coast & calm',
    image: 'https://images.pexels.com/photos/20726138/pexels-photo-20726138.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=1200&w=800',
    imageAlt: 'Colorful hillside houses overlooking the sea in Positano, Italy',
    tagline: 'The beautiful art of doing less.',
    description: 'Lemon groves, pastel villages, and a sea that never seems to hurry. Leave room for long lunches, spontaneous detours, and one more swim.',
    bestTime: 'May to June, September to October',
    idealDays: '4 to 7 days',
    evening: 'Find a terrace for fresh pasta and watch the last light move across the water.',
    experiences: [
      { title: 'Lose yourself in Positano', description: 'Follow the stairways and small lanes down toward the beach, stopping wherever curiosity takes you.' },
      { title: 'A slow afternoon in Ravello', description: 'Explore the hilltop town and its gardens, then find a terrace with a sea view.' },
      { title: 'Amalfi, on foot', description: 'Wander the piazza, explore the cathedral area, and sample something lemon-flavored.' },
      { title: 'An unplanned beach day', description: 'Choose a local beach, bring a book, and make very few plans.' },
      { title: 'The coast from the water', description: 'Take a local ferry between villages when services and sea conditions allow.' },
      { title: 'Walk above the coastline', description: 'Choose a scenic coastal path that suits your experience, with water and sensible footwear.' },
    ],
  },
  {
    id: 'iceland',
    name: 'South Iceland',
    country: 'Iceland',
    category: 'nature',
    categoryLabel: 'Nature & adventure',
    image: 'https://images.pexels.com/photos/3607085/pexels-photo-3607085.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=1200&w=800',
    imageAlt: 'Powerful Icelandic waterfall spilling over a dramatic cliff',
    tagline: 'A world a little less ordinary.',
    description: 'Waterfalls, black-sand beaches, and wide horizons. Follow the southern coast and let a wonderfully wild landscape do the talking.',
    bestTime: 'June to September',
    idealDays: '5 to 7 days',
    evening: 'Warm up with a hearty local meal and take a quiet walk near your guesthouse.',
    experiences: [
      { title: 'Feel the mist at Skogafoss', description: 'Visit the waterfall and its viewing areas, keeping to marked paths and watching for slippery surfaces.' },
      { title: 'The coast around Vik', description: 'Explore the village and coastal viewpoints. Stay well back from the water at black-sand beaches.' },
      { title: 'A walk near Seljalandsfoss', description: 'Enjoy the waterfalls from the designated paths and bring a waterproof layer.' },
      { title: 'Find a geothermal soak', description: 'Choose an established bathing spot and relax after a day on the road.' },
      { title: 'The wide-open road', description: 'Make time for marked viewpoints and small roadside cafes along the southern coast.' },
      { title: 'A glacier landscape', description: 'Visit a designated glacier viewpoint or book a qualified guide for any on-ice activity.' },
    ],
  },
  {
    id: 'marrakech',
    name: 'Marrakech',
    country: 'Morocco',
    category: 'culture',
    categoryLabel: 'Culture & connection',
    image: 'https://images.pexels.com/photos/17649841/pexels-photo-17649841.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=1200&w=800',
    imageAlt: 'Warm terracotta rooftops and the Koutoubia Mosque in Marrakech',
    tagline: 'Follow the color. Find the story.',
    description: 'A city of courtyard gardens, intricate doorways, and the scent of spices. Step into the medina with an open mind and plenty of time.',
    bestTime: 'March to May, September to November',
    idealDays: '3 to 5 days',
    evening: 'Enjoy a Moroccan dinner on a rooftop terrace as the city settles into evening.',
    experiences: [
      { title: 'Discover the medina', description: 'Explore the lanes, look for traditional crafts, and consider a local guide for your first visit.' },
      { title: 'A courtyard pause', description: 'Find a quiet riad cafe, order mint tea, and take a break from the busy streets.' },
      { title: 'The gardens of Marrakech', description: 'Visit a city garden and enjoy a different, greener side of the city. Reserve popular sites ahead.' },
      { title: 'An afternoon at Bahia Palace', description: 'Explore the courtyards and craftsmanship, checking current opening times before you go.' },
      { title: 'Spices and small discoveries', description: 'Browse the souks, ask before taking photographs, and take time to talk with local makers.' },
      { title: 'The square at sunset', description: 'Experience Jemaa el-Fnaa as the evening begins and explore at a pace that feels comfortable.' },
    ],
  },
  {
    id: 'bali',
    name: 'Ubud',
    country: 'Bali, Indonesia',
    category: 'nature',
    categoryLabel: 'Nature & adventure',
    image: 'https://images.pexels.com/photos/29989223/pexels-photo-29989223.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=1200&w=800',
    imageAlt: 'Emerald rice terraces and palm trees beneath a distant Bali mountain',
    tagline: 'Green days. A gentler pace.',
    description: 'Rice terraces, creative neighborhoods, and little pockets of stillness. Around Ubud, the simplest days are often the ones you remember.',
    bestTime: 'May to September',
    idealDays: '4 to 7 days',
    evening: 'Find a local warung for Balinese cooking and enjoy an easy evening in town.',
    experiences: [
      { title: 'Walk the rice terraces', description: 'Visit established terrace paths, respect farmers\' land, and go early for a quieter experience.' },
      { title: 'A morning on Campuhan Ridge', description: 'Follow the ridge walk in the cooler hours and pause at a neighborhood cafe afterward.' },
      { title: 'Meet the local makers', description: 'Explore Ubud\'s galleries and craft shops, and discover work by Balinese artists.' },
      { title: 'Learn a little Balinese cooking', description: 'Find a locally run cooking class and discover the ingredients behind your favorite dishes.' },
      { title: 'A temple visit', description: 'Visit a temple open to visitors, following local dress requirements and cultural guidance.' },
      { title: 'Leave an afternoon open', description: 'Read, enjoy a garden cafe, or simply follow a quiet path without a fixed destination.' },
    ],
  },
  {
    id: 'copenhagen',
    name: 'Copenhagen',
    country: 'Denmark',
    category: 'culture',
    categoryLabel: 'Culture & connection',
    image: 'https://images.pexels.com/photos/15687416/pexels-photo-15687416.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=1200&w=800',
    imageAlt: 'Colorful townhouses and boats along the Nyhavn canal in Copenhagen',
    tagline: 'Good design. Even better days.',
    description: 'Canal-side color, neighborhood bakeries, and a city built for wandering. Find joy in the everyday, preferably with a very good pastry.',
    bestTime: 'May to September',
    idealDays: '3 to 5 days',
    evening: 'Try a neighborhood restaurant, then enjoy a stroll along the harbor.',
    experiences: [
      { title: 'Nyhavn before the crowds', description: 'Walk the colorful waterfront early and watch the city begin its day.' },
      { title: 'A bakery-led morning', description: 'Explore a neighborhood bakery and make coffee and a pastry the first stop on your route.' },
      { title: 'Discover Danish design', description: 'Visit a design museum or browse independent shops to discover the city\'s creative side.' },
      { title: 'The neighborhoods of Norrebro', description: 'Explore independent stores, small cafes, and the neighborhood\'s lively streets.' },
      { title: 'A canal perspective', description: 'Take a canal boat ride or wander along the waterfront to see the city from another angle.' },
      { title: 'An easy garden afternoon', description: 'Relax in one of the city\'s public gardens with something good to read.' },
    ],
  },
];

export function getDestination(id: string): Destination {
  return destinations.find((destination) => destination.id === id) ?? destinations[0];
}