<?php
/**
 * CP04-W4: create dedicated subscriber + Application Password. No capability grant.
 * Writes the Application Password to a host-local secret file. Never echo it.
 */
if (!defined('ABSPATH')) {
  exit(1);
}

if (function_exists('wp_get_environment_type') && wp_get_environment_type() !== 'staging') {
  fwrite(STDERR, "REFUSING_IDENTITY: environment is not staging\n");
  exit(1);
}

$home = untrailingslashit((string) get_option('home'));
if ($home !== 'https://training.cetechbpa.com') {
  fwrite(STDERR, "REFUSING_IDENTITY: unexpected home\n");
  exit(1);
}

$login = 'cetech-pos-bridge-svc';
$email = 'cp04-w4-svc@training.invalid';
$label = 'cetech-pos-bff-r2-health';
$secret = '/home/cetechtraining/cetech-cp04-w4-app-password.secret';
$env_pointer = '/home/cetechtraining/cetech-cp04-w4-bff.env';

$user = get_user_by('login', $login);
if (!$user) {
  $user_id = wp_insert_user(
    array(
      'user_login'   => $login,
      'user_pass'    => wp_generate_password(32, true, true),
      'user_email'   => $email,
      'role'         => 'subscriber',
      'display_name' => 'CETECH POS Bridge SVC',
    )
  );
  if (is_wp_error($user_id)) {
    fwrite(STDERR, "USER_CREATE_FAILED\n");
    exit(1);
  }
  $user = get_user_by('id', $user_id);
  echo "USER_CREATED=yes\n";
} else {
  echo "USER_CREATED=no_already_existed\n";
}

if (!$user || is_wp_error($user)) {
  fwrite(STDERR, "USER_MISSING\n");
  exit(1);
}

$roles = (array) $user->roles;
if (in_array('administrator', $roles, true) || in_array('shop_manager', $roles, true) || in_array('customer', $roles, true)) {
  fwrite(STDERR, "REFUSING_IDENTITY: unexpected role\n");
  exit(1);
}

if ($user->has_cap('cetech_pos_bridge_access')) {
  $user->remove_cap('cetech_pos_bridge_access');
}

$created = WP_Application_Passwords::create_new_application_password(
  (int) $user->ID,
  array('name' => $label)
);
if (is_wp_error($created) || !is_array($created) || empty($created[0]) || empty($created[1]['uuid'])) {
  fwrite(STDERR, "APP_PASSWORD_FAILED\n");
  exit(1);
}

$written = file_put_contents($secret, (string) $created[0]);
if ($written === false) {
  fwrite(STDERR, "SECRET_WRITE_FAILED\n");
  exit(1);
}
chmod($secret, 0600);

$pointer = "BRIDGE_BASE_URL=https://training.cetechbpa.com\nBRIDGE_USERNAME={$login}\n# BRIDGE_APPLICATION_PASSWORD is host-local only: {$secret}\n";
file_put_contents($env_pointer, $pointer);
chmod($env_pointer, 0600);

echo "USER_ID=" . (int) $user->ID . "\n";
echo "USER_LOGIN=" . $login . "\n";
echo "USER_ROLES=" . implode(',', $roles) . "\n";
echo "HAS_BRIDGE_CAP=" . ($user->has_cap('cetech_pos_bridge_access') ? 'yes' : 'no') . "\n";
echo "AP_LABEL=" . $label . "\n";
echo "AP_UUID=" . $created[1]['uuid'] . "\n";
echo "SECRET_PATH=" . $secret . "\n";
echo "SECRET_BYTES=" . (int) $written . "\n";
echo "SECRET_PRINTED=NO\n";
