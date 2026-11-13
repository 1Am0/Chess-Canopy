/**
 * Labels that only exist in the open desktop rail: invisible (not removed) while it is collapsed, so the buttons keep their
 * size and the icons never move. They fade in a moment after the width starts to grow.
 */
export const RAIL_LABEL = "hidden sm:inline lg:inline lg:opacity-0 lg:transition-opacity lg:duration-150 lg:rail-open:opacity-100 lg:rail-open:delay-75";
/** Shared button box for every rail button: full width, left-aligned so the icon column is fixed, 36px tall. */
export const RAIL_BTN = "lg:h-9 lg:w-full lg:justify-start lg:gap-2.5 lg:rounded-[2px] lg:px-[11px]";


/** Same, for labels that are shown only in the open desktop rail (tablet header buttons stay icon-only). */
export const RAIL_LABEL_LG = "hidden lg:inline lg:opacity-0 lg:transition-opacity lg:duration-150 lg:rail-open:opacity-100 lg:rail-open:delay-75";
