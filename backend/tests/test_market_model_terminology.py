"""Regression tests for market-vs-wager backend terminology."""
import uuid


def test_market_model_names_are_explicit() -> None:
    from app.db.models.market import Market, MarketPosition, MarketPositionHistory

    assert Market.__tablename__ == "markets"
    assert MarketPosition.__tablename__ == "market_positions"
    assert MarketPosition.market_id.property.columns[0].foreign_keys
    assert MarketPositionHistory.__tablename__ == "market_position_history"


def test_legacy_bet_id_compatibility_uses_sqlalchemy_synonym_only() -> None:
    import app.db.models.market as market_models
    from app.db.models.market import MarketPosition

    market_id = uuid.uuid4()
    position = MarketPosition(bet_id=market_id, user_id=uuid.uuid4(), side="yes", bp_staked=1)

    assert not hasattr(market_models, "_BetIdAlias")
    assert position.market_id == market_id
    assert position.bet_id == market_id
