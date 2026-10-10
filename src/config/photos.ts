/*
 * Editorial photography of Alfama and Lisbon from Pexels (free to use; credited in the
 * footer). Images load from the Pexels CDN at the size each layout needs. Self-host
 * them before launch so visitors' browsers never contact a third party.
 */

export type PhotoEntry = {
  /** Pexels photo ID. */
  id: number;
  alt: string;
  credit: string;
  /** CSS object-position, to keep the subject in frame when cropped. */
  position?: string;
};

export const photos = {
  tramStreet: {
    id: 16549939,
    alt: "A yellow tram in a narrow street of tall old townhouses",
    credit: "Masood Aslami",
    position: "50% 65%",
  },
  azulejos: {
    id: 4330050,
    alt: "A wall of blue and white azulejo tiles painted with framed scenes",
    credit: "ArtHouse Studio",
  },
  bellTowers: {
    id: 5069524,
    alt: "A white church with twin bell towers above terracotta rooftops",
    credit: "Max Avans",
    position: "30% 35%",
  },
  alfamaView: {
    id: 34155133,
    alt: "Terracotta rooftops tumbling down to the river under a clear sky",
    credit: "Stephan Leuzinger",
    position: "50% 70%",
  },
  tiledSteps: {
    id: 12221799,
    alt: "Stone steps climbing beside a row of tiled townhouses",
    credit: "Mel Legarda",
    position: "40% 60%",
  },
} as const satisfies Record<string, PhotoEntry>;

export type PhotoName = keyof typeof photos;

export const photoCredits = [...new Set(Object.values(photos).map((photo) => photo.credit))];
