export interface FriendRequest {
  id: string;
  from_user_id: string;
  from_username: string;
  to_user_id: string;
  to_username: string;
  status: "pending" | "accepted" | "declined" | "blocked";
  created_at: string;
}

export interface Friend {
  user_id: string;
  username: string;
  avatar_url: string | null;
  is_online: boolean;
  since: string;
}

export interface FriendListResponse {
  friends: Friend[];
  pending_received: FriendRequest[];
  pending_sent: FriendRequest[];
}
