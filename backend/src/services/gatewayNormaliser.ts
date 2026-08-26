export const GATEWAY_STATUS_MAP: Record<string, Record<string, string>> = {
  razorpay: {
    created: 'Initiated',
    authorized: 'Pending',
    captured: 'Paid',
    failed: 'Failed',
    refunded: 'Refunded',
    disputed: 'Disputed'
  },
  payu: {
    pending: 'Initiated',
    'in progress': 'Pending',
    success: 'Paid',
    failure: 'Failed',
    refunded: 'Refunded',
    chargeback: 'Disputed'
  },
  ccavenue: {
    'Initiated': 'Initiated',
    'Awaiting': 'Pending',
    'Success': 'Paid',
    'Failure': 'Failed',
    'Aborted': 'Failed',
    'Refunded': 'Refunded',
    'Chargeback': 'Disputed',
    'Cancelled': 'Cancelled'
  },
  worldline: {
    initiated: 'Initiated',
    pending: 'Pending',
    captured: 'Paid',
    declined: 'Failed',
    refunded: 'Refunded',
    chargeback: 'Disputed'
  }
};

export const FAILURE_CODE_MAP: Record<string, Record<string, string>> = {
  // Mock implementations for specific gateways - should be expanded based on gateway docs
  razorpay: {
    'BAD_REQUEST_ERROR': 'invalid_instrument',
    'GATEWAY_ERROR': 'technical_error_gateway',
    // add other mappings...
  },
  payu: {
    // payu specific mappings...
  }
};

/**
 * Normalises raw status string from gateway to internal status string.
 */
export function normaliseGatewayStatus(gateway: string, rawStatus: string): string {
  const normalizedGateway = gateway.toLowerCase();
  const map = GATEWAY_STATUS_MAP[normalizedGateway];
  
  if (!map) {
    console.warn(`Unknown gateway: ${gateway}`);
    return rawStatus;
  }
  
  // We may need to do case insensitive checks depending on the gateway
  for (const [key, value] of Object.entries(map)) {
    if (key.toLowerCase() === String(rawStatus).toLowerCase()) {
      return value;
    }
  }

  return rawStatus;
}

/**
 * Normalises a gateway specific failure reason to a standard internal failure code.
 */
export function normaliseFailureCode(gateway: string, rawReason: string): string {
  const normalizedGateway = gateway.toLowerCase();
  const map = FAILURE_CODE_MAP[normalizedGateway];
  
  if (!map) {
    return 'unknown_error';
  }
  
  return map[rawReason] || 'unknown_error';
}
