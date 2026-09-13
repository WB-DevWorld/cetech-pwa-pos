<?php
/**
 * Apply CP04-W1 destination redirects on the confirmed training host only.
 * Requires the mail-containment MU plugin to already be loaded.
 */
if (!defined('ABSPATH')) {
  exit(1);
}

if (function_exists('wp_get_environment_type') && wp_get_environment_type() !== 'staging') {
  fwrite(STDERR, "REFUSING_APPLY: environment is not staging\n");
  exit(1);
}

$home = untrailingslashit((string) get_option('home'));
if ($home !== 'https://training.cetechbpa.com') {
  fwrite(STDERR, "REFUSING_APPLY: unexpected home\n");
  exit(1);
}

if (!has_filter('pre_wp_mail', 'cetech_cp04_w1_capture_wp_mail')) {
  fwrite(STDERR, "REFUSING_APPLY: CP04-W1 intercept not loaded\n");
  exit(1);
}

$sink = 'cp04-w1-sink@training.invalid';

update_option('admin_email', $sink);
update_option('woocommerce_stock_email_recipient', $sink);

$new_order = get_option('woocommerce_new_order_settings');
if (is_array($new_order)) {
  $new_order['recipient'] = $sink;
  update_option('woocommerce_new_order_settings', $new_order);
}

delete_option('new_admin_email');

echo "APPLY_OK\n";
echo "admin_domain=" . cetech_cp04_w1_option_domain(get_option('admin_email')) . "\n";
echo "stock_rcpt_domain=" . cetech_cp04_w1_option_domain(get_option('woocommerce_stock_email_recipient')) . "\n";
$updated_new = get_option('woocommerce_new_order_settings');
echo "new_order_rcpt_domain=" . (is_array($updated_new) && isset($updated_new['recipient']) ? cetech_cp04_w1_option_domain($updated_new['recipient']) : 'NA') . "\n";

function cetech_cp04_w1_option_domain($value) {
  $parts = explode('@', (string) $value);
  return isset($parts[1]) ? $parts[1] : 'NONE';
}
