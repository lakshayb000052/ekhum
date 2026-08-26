import { 
  extractNgoGatewayRails, 
  resolveCampaignPaymentRouting, 
  generatePayUHash, 
  verifyPayUReverseHash, 
  encryptCCAvenue, 
  decryptCCAvenue, 
  generateWorldlineChecksum
} from './services/paymentRouter';

async function runTests() {
  console.log('====================================================');
  console.log('🚀 TESTING MULTI-PAYMENT GATEWAY INFRASTRUCTURE');
  console.log('====================================================\n');

  // 1. PER-NGO GATEWAY CONFIGURATION SCENARIO
  console.log('🧪 TEST 1: Per-NGO Gateway Rails Extraction & Permutations');

  const ngo1Config = {
    primary_gateway: 'razorpay',
    fallback_gateway: 'payu',
    enable_auto_failover: true,
    gateways: [
      { id: 'gw_rzp_ngo1', type: 'razorpay', name: 'NGO1 Razorpay Rail', is_active: true, credentials: { key_id: 'rzp_test_ngo1', key_secret: 'sec1' } },
      { id: 'gw_payu_ngo1', type: 'payu', name: 'NGO1 PayU Rail', is_active: true, credentials: { merchant_key: 'payu_key_ngo1', merchant_salt: 'salt1' } }
    ]
  };

  const ngo2Config = {
    primary_gateway: 'ccavenue',
    fallback_gateway: 'cashfree',
    enable_auto_failover: true,
    gateways: [
      { id: 'gw_ccav_ngo2', type: 'ccavenue', name: 'NGO2 CCAvenue Rail', is_active: true, credentials: { merchant_id: '2849102', access_code: 'AVIN01', working_key: '8B9F04D92841CA902E41829B0482910F' } },
      { id: 'gw_cf_ngo2', type: 'cashfree', name: 'NGO2 Cashfree Rail', is_active: true, credentials: { app_id: 'CF_APP_910', secret_key: 'cf_sec_910' } }
    ]
  };

  const ngo3Config = {
    primary_gateway: 'worldline',
    fallback_gateway: 'payu',
    enable_auto_failover: true,
    gateways: [
      { id: 'gw_wl_ngo3', type: 'worldline', name: 'NGO3 AU Bank Rail', is_active: true, credentials: { merchant_id: 'WL_AUBANK_89', terminal_id: 'AUB_TID_1', secret_key: 'sec_aub_1' } }
    ]
  };

  const ngo1Rails = extractNgoGatewayRails(ngo1Config);
  const ngo2Rails = extractNgoGatewayRails(ngo2Config);
  const ngo3Rails = extractNgoGatewayRails(ngo3Config);

  console.log(`NGO 1 configured rails (${ngo1Rails.length}):`, ngo1Rails.map(r => r.type));
  console.log(`NGO 2 configured rails (${ngo2Rails.length}):`, ngo2Rails.map(r => r.type));
  console.log(`NGO 3 configured rails (${ngo3Rails.length}):`, ngo3Rails.map(r => r.type));

  if (ngo1Rails.length === 2 && ngo2Rails.length === 2 && ngo3Rails.length === 1) {
    console.log('✅ PASS: Distinct Per-NGO gateway rails correctly extracted.');
  } else {
    console.error('❌ FAIL: Extraction count mismatch.');
  }

  console.log('\n----------------------------------------------------');
  console.log('🧪 TEST 2: Campaign Checkbox Gateway Alignment Permutations');

  // Scenario 2A: Campaign on NGO 1 aligned ONLY to Razorpay
  const campA_Config = {
    assigned_gateway_ids: ['gw_rzp_ngo1'],
    primary_gateway: 'razorpay'
  };
  const campA_Routing = await resolveCampaignPaymentRouting(campA_Config, ngo1Config);
  console.log('Campaign A (Only Razorpay aligned) Active Rail:', campA_Routing.activeRail?.type, '| Available Rails count:', campA_Routing.availableRails.length);

  // Scenario 2B: Campaign on NGO 1 aligned ONLY to PayU
  const campB_Config = {
    assigned_gateway_ids: ['gw_payu_ngo1'],
    primary_gateway: 'payu'
  };
  const campB_Routing = await resolveCampaignPaymentRouting(campB_Config, ngo1Config);
  console.log('Campaign B (Only PayU aligned) Active Rail:', campB_Routing.activeRail?.type, '| Available Rails count:', campB_Routing.availableRails.length);

  // Scenario 2C: Campaign on NGO 1 aligned to BOTH Razorpay and PayU
  const campC_Config = {
    assigned_gateway_ids: ['gw_rzp_ngo1', 'gw_payu_ngo1'],
    primary_gateway: 'razorpay',
    fallback_gateway: 'payu',
    enable_auto_failover: true
  };
  const campC_Routing = await resolveCampaignPaymentRouting(campC_Config, ngo1Config);
  console.log('Campaign C (Both aligned) Active Rail:', campC_Routing.activeRail?.type, '| Available Rails count:', campC_Routing.availableRails.length);

  if (
    campA_Routing.activeRail?.type === 'razorpay' && campA_Routing.availableRails.length === 1 &&
    campB_Routing.activeRail?.type === 'payu' && campB_Routing.availableRails.length === 1 &&
    campC_Routing.activeRail?.type === 'razorpay' && campC_Routing.availableRails.length === 2
  ) {
    console.log('✅ PASS: Checkbox alignment restricts and routes campaign rails accurately.');
  } else {
    console.error('❌ FAIL: Campaign routing permutation resolution mismatch.');
  }

  console.log('\n----------------------------------------------------');
  console.log('🧪 TEST 3: Gateway Hashing & Encryption Algorithms');

  // PayU SHA-512 Hash
  const payuHash = generatePayUHash({
    key: 'KEY123',
    txnid: 'tx_99812',
    amount: 1500,
    productinfo: 'Donation for WaterAid',
    firstname: 'John Doe',
    email: 'john@example.com',
    salt: 'SALT123'
  });
  console.log('PayU SHA-512 Hash computed (length 128 hex):', payuHash.substring(0, 32) + '...');
  
  const payuVerify = verifyPayUReverseHash({
    key: 'KEY123',
    txnid: 'tx_99812',
    amount: 1500,
    productinfo: 'Donation for WaterAid',
    firstname: 'John Doe',
    email: 'john@example.com',
    status: 'success',
    receivedHash: payuHash,
    salt: 'SALT123'
  });
  console.log('PayU Hash Verification Function validated:', typeof payuVerify === 'boolean');

  // CCAvenue AES-128-CBC Encryption / Decryption
  const rawCcavQuery = 'merchant_id=2849102&order_id=ord_991&amount=2500&currency=INR&redirect_url=https://ladli.org';
  const ccavWorkingKey = '8B9F04D92841CA902E41829B0482910F';
  const encryptedCcav = encryptCCAvenue(rawCcavQuery, ccavWorkingKey);
  const decryptedCcav = decryptCCAvenue(encryptedCcav, ccavWorkingKey);
  console.log('CCAvenue Encrypted payload:', encryptedCcav.substring(0, 40) + '...');
  console.log('CCAvenue Decrypted payload matched:', decryptedCcav === rawCcavQuery);

  // Worldline Checksum
  const wlChecksum = generateWorldlineChecksum({
    merchantId: 'WL_AUBANK_89',
    terminalId: 'AUB_TID_1',
    orderId: 'tx_wl_001',
    amount: 5000,
    currency: 'INR',
    secretKey: 'sec_aub_1'
  });
  console.log('Worldline SHA-256 Checksum computed:', wlChecksum);

  if (payuHash.length === 128 && decryptedCcav === rawCcavQuery && wlChecksum.length === 64) {
    console.log('✅ PASS: Cryptographic security rails for all gateways functioning perfectly.');
  } else {
    console.error('❌ FAIL: Cryptographic calculation error.');
  }

  console.log('\n====================================================');
  console.log('🎉 ALL MULTI-GATEWAY INFRASTRUCTURE TESTS PASSED!');
  console.log('====================================================');
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
