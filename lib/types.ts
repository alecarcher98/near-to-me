export type Place = {
  id: string;
  name: string;
  category: string;
  details: string;
  address: string;
  lat: number;
  lng: number;
  approximateLocation?: boolean;
  tags?: string[];
  recommended?: boolean;
  sponsored?: boolean;
  sponsoredUntil?: string;
  launchSpotlight?: boolean;
  spotlightEndsAt?: string;
  spotlightNote?: string;
};

export type LocalEvent = {
  id: string;
  title: string;
  venue: string;
  address: string;
  day: string;
  date?: string;
  time: string;
  category: string;
  description: string;
  detail: string;
  host: string;
  posted?: string;
};

export type UpdateKind = "update" | "recommendation" | "offer";

export type Update = {
  id: string;
  kind: UpdateKind;
  title: string;
  body: string;
  link?: string;
  placeId?: string;
  pinned?: boolean;
  postedAt: string;
  expiresAt?: string;
};

export type Review = {
  id: string;
  placeId: string;
  placeName: string;
  author: string;
  rating: number;
  text: string;
  createdAt: string;
};

export type EnquiryKind = "sponsorship" | "listing" | "reviews" | "other";

export type Enquiry = {
  id: string;
  kind: EnquiryKind;
  status: "new" | "in-progress" | "done";
  businessName: string;
  contactName: string;
  email: string;
  phone?: string;
  businessType?: string;
  address?: string;
  openingDate?: string;
  website?: string;
  message: string;
  createdAt: string;
};

export type AreaContent = {
  places: Place[];
  events: LocalEvent[];
  updates: Update[];
  reviews: Review[];
  enquiries: Enquiry[];
};

export type PublicContent = Omit<AreaContent, "enquiries">;

export type LatLng = { lat: number; lng: number };
