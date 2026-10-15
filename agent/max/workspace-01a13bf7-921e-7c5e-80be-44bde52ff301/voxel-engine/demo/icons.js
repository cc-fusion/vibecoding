const paths = {
  cube: "M12 3 21 8v9l-9 5-9-5V8zM3 8l9 5 9-5M12 13v9",
  folder: "M3 7V5h6l2 2h10v13H3z",
  book: "M12 5v16M12 6C9 3 5 3 2 4v15c4-1 7 0 10 2 3-2 6-3 10-2V4c-3-1-7-1-10 2",
  export: "M12 16V3m-4 4 4-4 4 4M4 14v7h16v-7",
  import: "M12 3v13m-4-4 4 4 4-4M4 14v7h16v-7",
  search: "M21 21l-6-6M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0",
  "chevron-down": "m7 10 5 5 5-5",
  layers: "m3 7 9-5 9 5-9 5zM3 12l9 5 9-5M3 17l9 5 9-5",
  waves: "M2 6q3-4 6 0t6 0 6 0M2 12q3-4 6 0t6 0 6 0M2 18q3-4 6 0t6 0 6 0",
  sun: "M12 2v2m0 16v2M2 12h2m16 0h2M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2M17 12a5 5 0 1 1-10 0 5 5 0 0 1 10 0",
  globe:
    "M22 12A10 10 0 1 1 2 12a10 10 0 0 1 20 0M2 12h20M12 2c6 6 6 14 0 20-6-6-6-14 0-20",
  grid: "M3 3h18v18H3zM3 9h18M3 15h18M9 3v18M15 3v18",
  eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
  code: "m8 6-6 6 6 6m8-12 6 6-6 6m-3-15-2 18",
  "arrow-right": "M4 12h16m-6-6 6 6-6 6",
  camera: "M3 7h5l2-3h4l2 3h5v14H3zM16 13a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  expand: "M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5",
  orbit:
    "M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0M5 6c5-5 18-2 16 6S5 23 3 16 3 9 5 6",
  hand: "M8 13V5a2 2 0 0 1 4 0v7-9a2 2 0 0 1 4 0v9-6a2 2 0 0 1 4 0v9c0 5-3 7-7 7-3 0-4-1-6-4l-4-5a2 2 0 0 1 3-3l2 3",
  focus: "M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M8 8h8v8H8z",
  wire: "M12 3 21 8v9l-9 5-9-5V8zM3 8l9 5 9-5M12 13v9M12 3v10M3 17l9-4 9 4",
  rotate: "M20 10a8 8 0 1 0-1 8M20 3v7h-7",
  mouse: "M8 3h8a3 3 0 0 1 3 3v11a7 7 0 0 1-14 0V6a3 3 0 0 1 3-3M12 3v6",
  trash: "M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7",
  sliders: "M3 6h18M3 12h18M3 18h18M8 3v6m8 0v6m-6 0v6",
  shuffle:
    "M3 5h3c6 0 6 14 12 14h3M3 19h3c6 0 6-14 12-14h3m-3-3 3 3-3 3m0 8 3 3-3 3",
  refresh:
    "M20 10a8 8 0 0 0-14-5L3 8m0-6v6h6M4 14a8 8 0 0 0 14 5l3-3m0 6v-6h-6",
  bolt: "m13 2-9 12h7l-1 8 10-13h-7z",
  pause: "M8 5v14M16 5v14",
  play: "m7 3 14 9-14 9z",
  close: "m6 6 12 12M6 18 18 6",
};
export const icon = (name) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name] || paths.cube}"/></svg>`;
export function hydrateIcons(root = document) {
  root
    .querySelectorAll("[data-icon]")
    .forEach((el) => (el.innerHTML = icon(el.dataset.icon)));
}
