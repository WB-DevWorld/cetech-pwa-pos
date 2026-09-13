<?php
/**
 * Host-local rollback snapshot for CP04-W1. Writes JSON outside the webroot.
 * Do not print the file. Do not commit it.
 */
if (!defined('ABSPATH')) {
  exit(1);
}

if (function_exists('wp_get_environment_type') && wp_get_environment_type() !== 'staging') {
  fwrite(STDERR, "REFUSING_ROLLBACK_SNAPSHOT: environment is not staging\n");
  exit(1);
}

$home = untrailingslashit((string) get_option('home'));
if ($home !== 'https://training.cetechbpa.com') {
  fwrite(STDERR, "REFUSING_ROLLBACK_SNAPSHOT: unexpected home\n");
  exit(1);
}

$path = '/home/cetechtraining/cetech-cp04-w1-rollback.json';
$payload = array(
  'utc' => gmdate('c'),
  'home' => $home,
  'environment_type' => wp_get_environment_type(),
  'admin_email' => get_option('admin_email'),
  'woocommerce_stock_email_recipient' => get_option('woocommerce_stock_email_recipient'),
  'woocommerce_email_from_address' => get_option('woocommerce_email_from_address'),
  'woocommerce_notify_low_stock' => get_option('woocommerce_notify_low_stock'),
  'woocommerce_notify_no_stock' => get_option('woocommerce_notify_no_stock'),
  'woocommerce_new_order_settings' => get_option('woocommerce_new_order_settings'),
  'mailpoet_status' => in_array('mailpoet/mailpoet.php', (array) get_option('active_plugins', array()), true) ? 'active' : 'not_active',
);

$json = wp_json_encode($payload, JSON_PRETTY_PRINT);
if (!is_string($json) || $json === '') {
  fwrite(STDERR, "ROLLBACK_ENCODE_FAILED\n");
  exit(1);
}

$written = file_put_contents($path, $json);
if ($written === false) {
  fwrite(STDERR, "ROLLBACK_WRITE_FAILED\n");
  exit(1);
}
chmod($path, 0600);

echo "ROLLBACK_WRITTEN bytes=" . $written . "\n";
echo "ROLLBACK_PATH=" . $path . "\n";
echo "ROLLBACK_CONTAINS_PII=yes_not_printed\n";
