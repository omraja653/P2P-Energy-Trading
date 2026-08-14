// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./Interfaces/IEnergyTrade.sol";

/// @title EnergyTrade
/// @notice Records peer-to-peer energy trades and holds escrow until settlement.
contract EnergyTrade is IEnergyTrade, Ownable {
    uint256 private _nextTradeId = 1;
    mapping(uint256 => Trade) private _trades;

    address public settlementContract;

    constructor(address initialOwner) Ownable(initialOwner) {}

    modifier onlySettlement() {
        require(msg.sender == settlementContract, "EnergyTrade: not settlement contract");
        _;
    }

    function setSettlementContract(address settlement) external onlyOwner {
        settlementContract = settlement;
    }

    function recordTrade(
        address buyer,
        address seller,
        uint256 energyAmountWh,
        uint256 totalPriceWei
    ) external onlyOwner returns (uint256 tradeId) {
        require(buyer != address(0) && seller != address(0), "EnergyTrade: zero address");
        require(energyAmountWh > 0, "EnergyTrade: amount must be positive");

        tradeId = _nextTradeId++;
        _trades[tradeId] = Trade({
            id: tradeId,
            buyer: buyer,
            seller: seller,
            energyAmountWh: energyAmountWh,
            totalPriceWei: totalPriceWei,
            settled: false
        });

        emit TradeRecorded(tradeId, buyer, seller, energyAmountWh, totalPriceWei);
    }

    function markSettled(uint256 tradeId, uint256 amountPaidWei) external onlySettlement {
        Trade storage trade = _trades[tradeId];
        require(trade.id != 0, "EnergyTrade: trade not found");
        require(!trade.settled, "EnergyTrade: already settled");

        trade.settled = true;
        emit TradeSettled(tradeId, amountPaidWei);
    }

    function getTrade(uint256 tradeId) external view returns (Trade memory) {
        require(_trades[tradeId].id != 0, "EnergyTrade: trade not found");
        return _trades[tradeId];
    }
}
