// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./EnergyTrade.sol";

/// @title Settlement
/// @notice Distributes payment for a recorded trade between seller and platform fee wallet.
contract Settlement is Ownable {
    EnergyTrade public energyTrade;
    address public platformWallet;
    uint256 public platformFeeBps; // basis points, e.g. 200 = 2%

    event SettlementExecuted(uint256 indexed tradeId, address indexed seller, uint256 sellerAmount, uint256 feeAmount);

    constructor(
        address initialOwner,
        address energyTradeAddress,
        address platformWalletAddress,
        uint256 initialFeeBps
    ) Ownable(initialOwner) {
        require(initialFeeBps <= 10_000, "Settlement: fee exceeds 100%");
        energyTrade = EnergyTrade(energyTradeAddress);
        platformWallet = platformWalletAddress;
        platformFeeBps = initialFeeBps;
    }

    function setPlatformFeeBps(uint256 newFeeBps) external onlyOwner {
        require(newFeeBps <= 10_000, "Settlement: fee exceeds 100%");
        platformFeeBps = newFeeBps;
    }

    function settleTrade(uint256 tradeId) external payable onlyOwner {
        IEnergyTrade.Trade memory trade = energyTrade.getTrade(tradeId);
        require(msg.value == trade.totalPriceWei, "Settlement: incorrect payment amount");

        uint256 feeAmount = (msg.value * platformFeeBps) / 10_000;
        uint256 sellerAmount = msg.value - feeAmount;

        energyTrade.markSettled(tradeId, msg.value);

        (bool sellerPaid, ) = payable(trade.seller).call{value: sellerAmount}("");
        require(sellerPaid, "Settlement: seller payment failed");

        if (feeAmount > 0) {
            (bool feePaid, ) = payable(platformWallet).call{value: feeAmount}("");
            require(feePaid, "Settlement: platform fee payment failed");
        }

        emit SettlementExecuted(tradeId, trade.seller, sellerAmount, feeAmount);
    }
}
