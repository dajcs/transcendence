"""Compatibility aliases for legacy bet-named imports.

The canonical backend model names live in app.db.models.market.
"""
from app.db.models.market import (
    Comment,
    CommentUpvote,
    Dispute,
    DisputeVote,
    Market as Bet,
    MarketPosition as BetPosition,
    MarketPositionHistory as PositionHistory,
    MarketUpvote as BetUpvote,
    Resolution,
    ResolutionReview,
)
