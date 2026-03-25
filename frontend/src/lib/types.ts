export interface Market {
  id: string;
  title: string;
  description: string;
  resolution_criteria: string;
  deadline: string;
  status: "open" | "pending" | "closed";
  proposer_id: string;
  created_at: string;
  yes_pct: number;
  no_pct: number;
  position_count: number;
}

export interface MarketListResponse {
  items: Market[];
  total: number;
  page: number;
  pages: number;
}

export interface BetPosition {
  id: string;
  bet_id: string;
  user_id: string;
  side: "yes" | "no";
  bp_staked: number;
  placed_at: string;
  withdrawn_at: string | null;
  refund_bp: number | null;
}

export interface BetPositionWithMarket {
  id: string;
  bet_id: string;
  side: "yes" | "no";
  bp_staked: number;
  placed_at: string;
  withdrawn_at: string | null;
  refund_bp: number | null;
  market_title: string;
  market_status: string;
  yes_pct: number;
  no_pct: number;
}

export interface BetPositionsListResponse {
  active: BetPositionWithMarket[];
  resolved: BetPositionWithMarket[];
}

export interface Comment {
  id: string;
  bet_id: string;
  user_id: string;
  parent_id: string | null;
  content: string;
  created_at: string;
  upvote_count: number;
}

export interface ApiError {
  detail: string;
}
