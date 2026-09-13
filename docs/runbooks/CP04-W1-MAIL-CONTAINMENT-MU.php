<?php
/**
 * Plugin Name: CETECH CP04-W1 mail containment
 * Description: Capture wp_mail to a host-local sink. Do not deliver via SMTP/MTA.
 *
 * Training host only. Loaded as a must-use plugin. Does not install the POS bridge.
 */

if (!defined('ABSPATH')) {
  exit;
}

if (!defined('CETECH_CP04_W1_SINK_FILE')) {
  define('CETECH_CP04_W1_SINK_FILE', '/home/cetechtraining/cetech-cp04-w1-mail-sink.log');
}

add_filter('pre_wp_mail', 'cetech_cp04_w1_capture_wp_mail', PHP_INT_MIN, 2);

/**
 * Short-circuit wp_mail: record domain/subject only, never send.
 *
 * @param null|bool $short_circuit
 * @param array     $atts
 * @return bool
 */
function cetech_cp04_w1_capture_wp_mail($short_circuit, $atts) {
  $to = isset($atts['to']) ? $atts['to'] : '';
  if (is_array($to)) {
    $to = implode(',', $to);
  }
  $subject = isset($atts['subject']) ? (string) $atts['subject'] : '';
  $record = array(
    'utc' => gmdate('c'),
    'to_domains' => cetech_cp04_w1_domains((string) $to),
    'subject' => substr($subject, 0, 200),
  );
  $line = wp_json_encode($record);
  if (is_string($line) && $line !== '') {
    @file_put_contents(CETECH_CP04_W1_SINK_FILE, $line . "\n", FILE_APPEND | LOCK_EX);
  }
  return true;
}

/**
 * @param string $to
 * @return string[]
 */
function cetech_cp04_w1_domains($to) {
  $domains = array();
  foreach (preg_split('/[,\s]+/', $to) as $part) {
    $part = trim($part, "<> \t\"'");
    $bits = explode('@', $part);
    if (isset($bits[1]) && $bits[1] !== '') {
      $domains[] = strtolower($bits[1]);
    }
  }
  return array_values(array_unique($domains));
}
