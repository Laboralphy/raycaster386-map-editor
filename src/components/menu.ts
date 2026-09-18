/** One entry of a menu strip. Shared by `SimpleMenu` and `MainMenu`. */
export interface MenuEntry {
    /** An `@mdi/js` path string. */
    icon: string;
    route: string;
    caption: string;
    title: string;
    /** Marks the entry active for a family of routes, not just its own. */
    highlight?: RegExp;
}
