// Wall-display product names.
//
// The sheet's own `Product Name` runs to 76 characters ("IMECO GOOD HABIT 3 PLY 160 PULLS
// EACH TOILET PAPER ROLL (160X 6 - PACK OF 6)"), which forced the name column wide enough to
// crowd the grid and still truncate. These are the reviewed short forms — 47 characters at
// the longest, so the column fits without an ellipsis.
//
// Keyed by SKU ID, never by row position: the sheet is re-sorted by hand, and a positional
// map would silently relabel every row the day someone drags one.

/** Falls back to the sheet's own Product Name for any SKU not listed here. */
export const PRODUCT_DISPLAY_NAMES: Record<string, string> = {
  IMEGBNPM30_1: 'Imeco Garbage Bag-Non-Premium-Medium',
  IMEGBNPL15_1: 'Imeco Garbage Bag-Non-Premium-Large',
  IMEGBNPS30_1: 'Imeco Garbage Bag-Non-Premium-Small',
  IMEBPB1: 'Imeco Bamboo Paddle Hair Brush',
  IMERBT1: 'Imeco Reusable Bamboo Kitchen Towel',
  IMEFTCNP600: 'Imeco Facial Tissues Non-Premium (100Pulls x 6)',
  IMEHWP30: 'IMECO Wet Wipes',
  IMEBCT1: 'Imeco Bamboo Cylindrical Car Tissues',
  IMEBTTNP6: 'Imeco Toilet Roll (160 Pulls x 6)',
  IMEPTCNP100: 'Imeco Bamboo Facial Pocket Tissue (10Pulls x 10)',
  IMEBKT360: 'Imeco Kitchen Tissues 60 PULLS X 6',
  IMEGHTTP6: 'Good Habbit Toilet Roll (160 pulls x 6)',
  IMEGHFT600: 'Good Habbit Facial Tissue 100 pulls x 6',
  IMEBW72: 'Imeco Baby Wipes 72 pulls',
  IMEGHBGBS30: 'Good Habbit Garbage Bags Small',
  IMEGHBGBM30: 'Good Habbit Garbage Bags Medium',
  IMEFTCNP2_600: 'Imeco Facial Tissues Non Premium (200Pulls x 3)',
  'IMEGHFTB100-GP1': 'Good Habbit Facial Tissue Box 100 pulls GREEN',
  'IMEGHFTB100-BP1': 'Good Habbit Facial Tissue Box 100 pulls BLUE',
  'IMEGHFTB100-OP1': 'Good Habbit Facial Tissue Box 100 pulls ORANGE',
  'IMEGHFTB100-PP1': 'Good Habbit Facial Tissue Box 100 pulls PINK',
  IMEGHWN22: 'Good Habbit NAPKIN 100 PULLS - 22 X 22',
  IMEGHWN27: 'Good Habbit NAPKIN 100 PULLS - 27 X 30',
};

/** Display name for a SKU, falling back to the sheet's own name, then the bare ID. */
export function displayName(id: string, sheetName: string): string {
  return PRODUCT_DISPLAY_NAMES[id] ?? sheetName ?? id;
}
