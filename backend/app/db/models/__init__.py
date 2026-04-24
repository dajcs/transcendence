"""Database models package — import all models here for Alembic to detect."""
from app.db.models.market import (  # noqa: F401
    Comment,
    CommentUpvote,
    Dispute,
    DisputeVote,
    Market,
    MarketPosition,
    MarketPositionHistory,
    MarketUpvote,
    Resolution,
    ResolutionReview,
)
from app.db.models.social import FriendRequest, Message, Notification  # noqa: F401
from app.db.models.transaction import BpFundEntry, BpTransaction, LpEvent, TpTransaction  # noqa: F401
from app.db.models.user import OauthAccount, User  # noqa: F401

# Legacy aliases. Prefer canonical Market* names in new backend code.
Bet = Market
BetPosition = MarketPosition
PositionHistory = MarketPositionHistory
BetUpvote = MarketUpvote
