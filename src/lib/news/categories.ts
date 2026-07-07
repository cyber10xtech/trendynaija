/**
 * Client-safe shared news constants.
 */
export const NEWS_CATEGORIES = [
  "Politics",
  "Business",
  "Technology",
  "Sports",
  "Entertainment",
  "Education",
  "Health",
  "Crime",
  "Religion",
  "Government",
  "Economy",
  "Lifestyle",
  "Environment",
  "Weather",
  "Infrastructure",
  "Other",
] as const;

export type NewsCategory = (typeof NEWS_CATEGORIES)[number];
