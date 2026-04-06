export interface Market {
  id: string;
  title: string;
  description: string;
  resolution_criteria: string;
  deadline: string;
  status: "open" | "pending" | "pending_resolution" | "proposer_resolved" | "disputed" | "closed";
  proposer_id: string;
  proposer_username: string;
  created_at: string;
  market_type: "binary" | "multiple_choice" | "numeric";
  choices: string[] | null;
  numeric_min: number | null;
  numeric_max: number | null;
  yes_pct: number;
  no_pct: number;
  yes_count: number;
  no_count: number;
  position_count: number;
  comment_count: number;
  choice_counts: Record<string, number>;
  upvote_count: number;
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
  author_username: string;
  parent_id: string | null;
  content: string;
  created_at: string;
  upvote_count: number;
}

export interface ApiError {
  detail: string;
}

export interface ResolutionRecord {
  tier: number;
  outcome: string;
  justification: string | null;
  resolved_at: string;
  overturned: boolean;
}

export interface DisputeRecord {
  id: string;
  status: "open" | "closed";
  closes_at: string;
  vote_weights: Record<string, number>;
  user_vote: string | null;
  user_weight: number | null;
}

export interface ReviewRecord {
  accept_count: number;
  dispute_count: number;
  total_participants: number;
  threshold: number;
  user_vote: "accept" | "dispute" | null;
  closes_at: string;
}

export interface ResolutionState {
  resolution: ResolutionRecord | null;
  dispute: DisputeRecord | null;
  review: ReviewRecord | null;
}
