"""Regression tests for market-vs-wager backend terminology."""


def test_market_model_names_are_explicit() -> None:
    from app.db.models.market import Market, MarketPosition, MarketPositionHistory

    assert Market.__tablename__ == "markets"
    assert MarketPosition.__tablename__ == "market_positions"
    assert MarketPosition.market_id.property.columns[0].foreign_keys
    assert MarketPositionHistory.__tablename__ == "market_position_history"
