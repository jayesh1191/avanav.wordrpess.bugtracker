/** Radix portals must render inside #bug-tracker-root so the scoped styles apply. */
export const portalContainer = () => document.getElementById('bug-tracker-root') ?? undefined;
