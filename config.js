// All machine data lives here. Lengths are in metres.
export const MAX_ADDONS = 5;      // total add-ons allowed (flexo stations are not counted)
export const DEFAULT_FLEXO = 6;
export const WIDTH = 1.6;         // press depth
export const HEIGHT = 2.5;
export const ENDS = { unwinder: 1.8, rewinder: 1.85 };

export const GROUPS = [
  { title: 'Flexo printing units', types: ['flexo'] },
  { title: 'Multi-face printing', types: ['glue', 'multilayer', 'lamination'] },
  { title: 'Embellishment effects', types: ['hotfoil', 'coldfoil', 'screen'] },
];

// kit = which placeholder shape parts.js draws. tint = colour of the module's top stripe.
export const CATALOG = {
  flexo:      { label: 'Flexo station',                 len: 0.74, min: 1, max: 10, kit: 'print', tint: 0x8fa0ae },
  glue:       { label: 'Glue-side printing',            len: 1.2,  kit: 'twin',  tint: 0xc98b2b },
  multilayer: { label: 'Multi-layer printing',          len: 1.0,  kit: 'twin',  tint: 0x4f8f6f },
  lamination: { label: 'Lamination, foil and 2-layer',  len: 1.1,  kit: 'rolls', tint: 0x7a6bb0 },
  hotfoil:    { label: 'Hot foil application',          len: 0.9,  kit: 'foil',  tint: 0xd1a73a },
  coldfoil:   { label: 'Cold foil laminator',           len: 1.0,  kit: 'rolls', tint: 0x4aa3c7 },
  screen:     { label: 'Screen printing',               len: 1.3,  kit: 'bed',   tint: 0xc4563f },
};
