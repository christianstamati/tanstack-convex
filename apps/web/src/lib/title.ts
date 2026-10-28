/** The app's name: the tab title of the home page, and the end of every other page's. */
export const APP_NAME = "tanstack-convex-starter";

/** A page's tab title, for its route's `head`. */
export function pageTitle(page: string) {
  return { title: `${page} · ${APP_NAME}` };
}
