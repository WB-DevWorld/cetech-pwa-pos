<?php
/**
 * CP04-W4 Action F: grant only cetech_pos_bridge_access to the dedicated service user.
 */
if (!defined('ABSPATH')) {
  exit(1);
}

if (function_exists('wp_get_environment_type') && wp_get_environment_type() !== 'staging') {
  fwrite(STDERR, "REFUSING_GRANT: environment is not staging\n");
  exit(1);
}

$home = untrailingslashit((string) get_option('home'));
if ($home !== 'https://training.cetechbpa.com') {
  fwrite(STDERR, "REFUSING_GRANT: unexpected home\n");
  exit(1);
}

$user = get_user_by('login', 'cetech-pos-bridge-svc');
if (!$user) {
  fwrite(STDERR, "USER_MISSING\n");
  exit(1);
}

$roles = (array) $user->roles;
if (in_array('administrator', $roles, true)) {
  fwrite(STDERR, "REFUSING_GRANT: administrator is not the service identity\n");
  exit(1);
}

$user->add_cap('cetech_pos_bridge_access');
$user = get_user_by('id', $user->ID);
echo "USER_ID=" . (int) $user->ID . "\n";
echo "USER_ROLES=" . implode(',', $roles) . "\n";
echo "HAS_BRIDGE_CAP=" . ($user->has_cap('cetech_pos_bridge_access') ? 'yes' : 'no') . "\n";
echo "HAS_MANAGE_WOO=" . ($user->has_cap('manage_woocommerce') ? 'yes' : 'no') . "\n";
echo "HAS_MANAGE_OPTIONS=" . ($user->has_cap('manage_options') ? 'yes' : 'no') . "\n";
