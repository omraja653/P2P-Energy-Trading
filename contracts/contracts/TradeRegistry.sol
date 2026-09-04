// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

/// @title TradeRegistry
/// @notice Records peer-to-peer energy trades on an immutable ledger. Unlike
/// EnergyTrade+Settlement (the contracts currently deployed and wired into
/// this project's backend), this contract does NOT move funds on-chain — it
/// only records that a trade happened, for a design where GridMate/off-chain
/// settlement handles the money and the chain is just a tamper-proof receipt.
/// Not deployed or integrated anywhere yet — see contracts/README (or ask)
/// before wiring this in, since it would replace, not extend, the current
/// settlement flow.
contract TradeRegistry is Ownable {
    struct Trade {
        uint256 id;
        address prosumer;
        address consumer;
        uint256 units; // Energy units (kWh), scaled per caller's convention
        uint256 price; // Price per unit (wei)
        string gridmateTradeId; // Link back to the GridMate/off-chain trade record
        uint256 timestamp;
    }

    Trade[] public trades;
    mapping(string => bool) public tradeIdExists;
    mapping(address => uint256[]) public prosumerTrades;
    mapping(address => uint256[]) public consumerTrades;

    event TradeRecorded(
        uint256 indexed tradeId,
        address indexed prosumer,
        address indexed consumer,
        uint256 units,
        uint256 price,
        string gridmateTradeId
    );

    constructor(address initialOwner) Ownable(initialOwner) {}

    /// @notice Record a new P2P energy trade.
    /// @param _prosumer Seller address
    /// @param _consumer Buyer address
    /// @param _units Energy units traded (kWh)
    /// @param _price Price per unit (wei)
    /// @param _gridmateTradeId Reference ID from GridMate's own trade record
    function recordTrade(
        address _prosumer,
        address _consumer,
        uint256 _units,
        uint256 _price,
        string memory _gridmateTradeId
    ) external onlyOwner returns (uint256) {
        require(_prosumer != address(0) && _consumer != address(0), "TradeRegistry: invalid addresses");
        require(_units > 0, "TradeRegistry: units must be positive");
        require(_price > 0, "TradeRegistry: price must be positive");
        require(!tradeIdExists[_gridmateTradeId], "TradeRegistry: trade ID already exists");

        uint256 tradeId = trades.length;

        trades.push(
            Trade({
                id: tradeId,
                prosumer: _prosumer,
                consumer: _consumer,
                units: _units,
                price: _price,
                gridmateTradeId: _gridmateTradeId,
                timestamp: block.timestamp
            })
        );
        tradeIdExists[_gridmateTradeId] = true;
        prosumerTrades[_prosumer].push(tradeId);
        consumerTrades[_consumer].push(tradeId);

        emit TradeRecorded(tradeId, _prosumer, _consumer, _units, _price, _gridmateTradeId);

        return tradeId;
    }

    function getTradeCount() external view returns (uint256) {
        return trades.length;
    }

    function getTrade(uint256 _index) external view returns (Trade memory) {
        require(_index < trades.length, "TradeRegistry: trade not found");
        return trades[_index];
    }

    function getProsumerTrades(address _prosumer) external view returns (uint256[] memory) {
        return prosumerTrades[_prosumer];
    }

    function getConsumerTrades(address _consumer) external view returns (uint256[] memory) {
        return consumerTrades[_consumer];
    }

    function tradeExists(string memory _gridmateTradeId) external view returns (bool) {
        return tradeIdExists[_gridmateTradeId];
    }
}
