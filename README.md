# ZenithPay

A decentralized cross-border payment platform powered by Bitcoin on the Stacks blockchain.

## Overview

ZenithPay enables fast and secure international payments using Bitcoin as the settlement layer. The smart contract handles:

- Payment channel creation between parties
- Bitcoin address registration
- Payment execution and settlement
- Fee management
- Dispute resolution timeouts

## Features

- Create payment channels between two parties
- Register and validate Bitcoin addresses
- Execute cross-border payments
- Manage transaction fees
- Handle payment disputes and timeouts
- Query payment status and history
- Automatic payment refunds after timeout period

## Getting Started

1. Deploy the contract to the Stacks blockchain
2. Initialize a payment channel
3. Register Bitcoin addresses
4. Execute payments through the channel

## Payment Protection

The contract now includes a timeout mechanism that protects senders from unresponsive receivers:

- When a payment is executed, a 144-block timeout period begins (~24 hours)
- If the receiver doesn't confirm the payment within this period, the sender can reclaim their funds
- This prevents funds from being locked indefinitely in case of receiver inaction
