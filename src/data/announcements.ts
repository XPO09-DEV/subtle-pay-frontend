export interface ProductAnnouncement {
  id: string;
  title: string;
  message: string;
  publishedAt: string;
  category: "product" | "security";
  tag: string;
}

/**
 * In-app release notes shown in the Notification Centre.
 * Add a new entry when a user-facing feature or service update is released.
 * IDs must remain stable so each account can track read/unread state.
 */
export const productAnnouncements: ProductAnnouncement[] = [
  {
    id: "notification-centre-launch-2026-10-14",
    title: "Your Notification Centre is ready",
    message: "Payment updates and important Subtle Pay announcements now have one place. New feature releases can be published here as the wallet grows.",
    publishedAt: "2026-10-14T00:00:00.000Z",
    category: "product",
    tag: "What's new",
  },
];
