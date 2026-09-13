<?php
/**
 * CP04-W4 health probe. Reads Application Password from host secret if auth=basic.
 * Prints status + redacted envelope only. Never prints credentials.
 */
if (!defined('ABSPATH')) {
  exit(1);
}

$cfg_path = '/home/cetechtraining/cetech-cp04-w4-probe.json';
$mode = 'none';
$corr = '';
if (is_readable($cfg_path)) {
  $cfg = json_decode((string) file_get_contents($cfg_path), true);
  if (is_array($cfg)) {
    if (isset($cfg['mode']) && is_string($cfg['mode'])) {
      $mode = $cfg['mode'];
    }
    if (isset($cfg['corr']) && is_string($cfg['corr'])) {
      $corr = $cfg['corr'];
    }
  }
}
$secret = '/home/cetechtraining/cetech-cp04-w4-app-password.secret';
$url = rest_url('cetech-pos/v1/health');

$headers = array();
if ($corr !== '') {
  $headers['X-Correlation-ID'] = $corr;
}

if ($mode === 'basic') {
  if (!is_readable($secret)) {
    fwrite(STDERR, "SECRET_UNREADABLE\n");
    exit(1);
  }
  $pass = file_get_contents($secret);
  if (!is_string($pass) || $pass === '') {
    fwrite(STDERR, "SECRET_EMPTY\n");
    exit(1);
  }
  $headers['Authorization'] = 'Basic ' . base64_encode('cetech-pos-bridge-svc:' . $pass);
}

$args = array(
  'timeout'   => 20,
  'headers'   => $headers,
  'sslverify' => true,
);

$response = wp_remote_get($url, $args);
$code = (int) wp_remote_retrieve_response_code($response);
$body = (string) wp_remote_retrieve_body($response);
$json = json_decode($body, true);

echo "PROBE_MODE=" . $mode . "\n";
echo "HTTP_STATUS=" . $code . "\n";
echo "BODY_BYTES=" . strlen($body) . "\n";

if (!is_array($json)) {
  echo "JSON=no\n";
  echo "BODY_PREFIX=" . substr(preg_replace('/[A-Za-z0-9+\/]{20,}/', '[REDACTED]', $body), 0, 180) . "\n";
  exit(0);
}

echo "JSON_KEYS=" . implode(',', array_keys($json)) . "\n";
if (isset($json['ok'])) {
  echo "OK=" . ($json['ok'] ? 'true' : 'false') . "\n";
}
if (isset($json['correlationId'])) {
  echo "CORR=" . $json['correlationId'] . "\n";
}
if (isset($json['error']) && is_array($json['error'])) {
  echo "ERR_CODE=" . (isset($json['error']['code']) ? $json['error']['code'] : 'NA') . "\n";
  echo "ERR_KEYS=" . implode(',', array_keys($json['error'])) . "\n";
}
if (isset($json['data']) && is_array($json['data'])) {
  $data = $json['data'];
  echo "DATA_KEYS=" . implode(',', array_keys($data)) . "\n";
  foreach (array('status', 'contractVersion', 'wooDetected', 'woodmartDetected', 'b2bkingDetected', 'pricingParityVerified') as $key) {
    if (!array_key_exists($key, $data)) {
      continue;
    }
    $value = $data[$key];
    if (is_bool($value)) {
      $value = $value ? 'true' : 'false';
    }
    echo strtoupper($key) . "=" . $value . "\n";
  }
}

$joined = strtolower($body);
$leak = (strpos($joined, 'bridge_application_password') !== false)
  || (strpos($joined, 'application-password') !== false)
  || (strpos($body, 'NEXT_PUBLIC_BRIDGE') !== false);
echo "SECRET_IN_BODY=" . ($leak ? 'YES' : 'NO') . "\n";
