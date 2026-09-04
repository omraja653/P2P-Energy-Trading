// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ITradeRegistry {
    struct Trade {
        uint256 id;
        address prosumer;
        address consumer;
        uint256 units;
        uint256 price;
        string gridmateTradeId;
        uint256 timestamp;
    }

    function recordTrade(
        address _prosumer,
        address _consumer,
        uint256 _units,
        uint256 _price,
        string memory _gridmateTradeId
    ) external returns (uint256);

    function getTrade(uint256 _index) external view returns (Trade memory);

    function getTradeCount() external view returns (uint256);

    function tradeExists(string memory _gridmateTradeId) external view returns (bool);
}
