export type SocialStoryMediaType = "IMAGE" | "VIDEO";

export type SocialStory = {
  id: string;
  mediaType: SocialStoryMediaType;
  mediaUrl: string;
  thumbnailUrl: string;
  permalink: string | null;
  timestamp: string;
};

export type RestaurantSocialLinks = {
  instagram_url: string | null;
  facebook_url: string | null;
  instagram_username: string | null;
};
