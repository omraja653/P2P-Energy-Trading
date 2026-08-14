// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IEnergyTrade {
    struct Trade {
        uint256 id;
        address buyer;
        address seller;
        uint256 energyAmountWh;
        uint256 totalPriceWei;
        bool settled;
    }

    event TradeRecorded(
        uint256 indexed tradeId,
        address indexed buyer,
        address indexed seller,
        uint256 energyAmountWh,
        uint256 totalPriceWei
    );

    event TradeSettled(uint256 indexed tradeId, uint256 amountPaidWei);

    function recordTrade(
        address buyer,
        address seller,
        uint256 energyAmountWh,
        uint256 totalPriceWei
    ) external returns (uint256 tradeId);

    function getTrade(uint256 tradeId) external view returns (Trade memory);
}
