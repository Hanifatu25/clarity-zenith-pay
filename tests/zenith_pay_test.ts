import {
  Clarinet,
  Tx,
  Chain,
  Account,
  types
} from 'https://deno.land/x/clarinet@v1.0.0/index.ts';
import { assertEquals } from 'https://deno.land/std@0.90.0/testing/asserts.ts';

Clarinet.test({
  name: "Ensure channel creation works",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const wallet1 = accounts.get('wallet_1')!;
    
    let block = chain.mineBlock([
      Tx.contractCall('zenith-pay', 'create-channel', [
        types.principal(wallet1.address),
        types.uint(2000000)
      ], deployer.address)
    ]);
    
    block.receipts[0].result.expectOk();
    const channelId = block.receipts[0].result.expectOk().expectUint();
    
    // Verify channel exists
    let channelInfo = chain.callReadOnlyFn(
      'zenith-pay',
      'get-channel-info',
      [types.uint(channelId)],
      deployer.address
    );
    
    assertEquals(channelInfo.result.expectSome()['sender'], deployer.address);
    assertEquals(channelInfo.result.expectSome()['receiver'], wallet1.address);
    assertEquals(channelInfo.result.expectSome()['state'], "ACTIVE");
  }
});

Clarinet.test({
  name: "Test BTC address registration",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const wallet1 = accounts.get('wallet_1')!;
    const btcAddress = "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa";
    
    let block = chain.mineBlock([
      Tx.contractCall('zenith-pay', 'register-btc-address', [
        types.ascii(btcAddress)
      ], wallet1.address)
    ]);
    
    block.receipts[0].result.expectOk();
    
    // Verify registration
    let storedAddress = chain.callReadOnlyFn(
      'zenith-pay',
      'get-btc-address',
      [types.principal(wallet1.address)],
      wallet1.address
    );
    
    assertEquals(storedAddress.result.expectSome(), btcAddress);
  }
});

Clarinet.test({
  name: "Test payment execution and confirmation flow",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const wallet1 = accounts.get('wallet_1')!;
    
    // Create channel
    let block1 = chain.mineBlock([
      Tx.contractCall('zenith-pay', 'create-channel', [
        types.principal(wallet1.address),
        types.uint(2000000)
      ], deployer.address)
    ]);
    
    const channelId = block1.receipts[0].result.expectOk().expectUint();
    
    // Execute payment
    let block2 = chain.mineBlock([
      Tx.contractCall('zenith-pay', 'execute-payment', [
        types.uint(channelId),
        types.uint(1000000)
      ], deployer.address)
    ]);
    
    block2.receipts[0].result.expectOk();
    
    // Confirm payment
    let block3 = chain.mineBlock([
      Tx.contractCall('zenith-pay', 'confirm-payment', [
        types.uint(channelId)
      ], wallet1.address)
    ]);
    
    block3.receipts[0].result.expectOk();
    
    // Verify final state
    let channelInfo = chain.callReadOnlyFn(
      'zenith-pay',
      'get-channel-info',
      [types.uint(channelId)],
      deployer.address
    );
    
    assertEquals(channelInfo.result.expectSome()['state'], "ACTIVE");
    assertEquals(channelInfo.result.expectSome()['balance'], types.uint(1000000));
  }
});

Clarinet.test({
  name: "Test payment refund after timeout",
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const wallet1 = accounts.get('wallet_1')!;
    
    // Create channel
    let block1 = chain.mineBlock([
      Tx.contractCall('zenith-pay', 'create-channel', [
        types.principal(wallet1.address),
        types.uint(2000000)
      ], deployer.address)
    ]);
    
    const channelId = block1.receipts[0].result.expectOk().expectUint();
    
    // Execute payment
    let block2 = chain.mineBlock([
      Tx.contractCall('zenith-pay', 'execute-payment', [
        types.uint(channelId),
        types.uint(1000000)
      ], deployer.address)
    ]);
    
    block2.receipts[0].result.expectOk();
    
    // Mine 144 blocks to pass timeout
    chain.mineEmptyBlockUntil(chain.blockHeight + 144);
    
    // Attempt refund
    let block3 = chain.mineBlock([
      Tx.contractCall('zenith-pay', 'refund-payment', [
        types.uint(channelId)
      ], deployer.address)
    ]);
    
    block3.receipts[0].result.expectOk();
    
    // Verify final state
    let channelInfo = chain.callReadOnlyFn(
      'zenith-pay',
      'get-channel-info',
      [types.uint(channelId)],
      deployer.address
    );
    
    assertEquals(channelInfo.result.expectSome()['state'], "ACTIVE");
    assertEquals(channelInfo.result.expectSome()['timeout'], types.uint(0));
  }
});
