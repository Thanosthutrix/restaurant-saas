export type MetaMessagingPlatform = "facebook_messenger" | "instagram_dm";

export type MetaMessageDirection = "inbound" | "outbound";

export type MetaConversation = {
  id: string;
  restaurantId: string;
  platform: MetaMessagingPlatform;
  externalUserId: string;
  customerName: string | null;
  customerProfilePicUrl: string | null;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
};

export type MetaMessage = {
  id: string;
  conversationId: string;
  direction: MetaMessageDirection;
  metaMessageId: string | null;
  text: string | null;
  attachments: unknown;
  createdAt: string;
};

export type MetaMessagingInbox = {
  conversations: MetaConversation[];
  webhookUrl: string;
  messagingScopesEnabled: boolean;
  webhookConfigured: boolean;
  webhookSubscribedAt: string | null;
};
