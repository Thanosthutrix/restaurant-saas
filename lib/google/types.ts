export type GoogleVerificationStatus = "none" | "pending" | "verified" | "failed";

export type GoogleConnectionStatus = "disconnected" | "connected" | "needs_action";

export type GooglePlaceCandidate = {
  placeId: string;
  name: string;
  address: string;
  mapsUri: string | null;
  rating: number | null;
  reviewCount: number | null;
  businessStatus: string | null;
  /** Fiche déjà revendiquée sur Google (heuristique Places / GBP). */
  matchKind: "existing" | "unclaimed_hint" | "unknown";
  requestAdminRightsUrl: string | null;
};

export type RestaurantGoogleProfile = {
  placeId: string | null;
  mapsUri: string | null;
  rating: number | null;
  reviewCount: number | null;
  syncedAt: string | null;
  reviewLink: string | null;
  reservationLink: string;
};

export type RestaurantGoogleConnection = {
  restaurantId: string;
  googleAccountEmail: string | null;
  googleAccountId: string | null;
  googleLocationName: string | null;
  verificationStatus: GoogleVerificationStatus;
  connectionStatus: GoogleConnectionStatus;
  lastError: string | null;
  connectedAt: string | null;
};

export type RestaurantGoogleState = {
  profile: RestaurantGoogleProfile;
  connection: RestaurantGoogleConnection | null;
  oauthConfigured: boolean;
  placesConfigured: boolean;
};
