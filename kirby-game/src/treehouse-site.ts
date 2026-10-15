/** Shared world coordinates for the real balcony and its scripted walking area. */
export const TREEHOUSE_LOCATION={x:135,z:45} as const;
export const TREEHOUSE_DECK_HEIGHT=18;
export const TREEHOUSE_BALCONY={minX:TREEHOUSE_LOCATION.x-4.8,maxX:TREEHOUSE_LOCATION.x+4.8,minZ:TREEHOUSE_LOCATION.z+2.5,maxZ:TREEHOUSE_LOCATION.z+7} as const;
