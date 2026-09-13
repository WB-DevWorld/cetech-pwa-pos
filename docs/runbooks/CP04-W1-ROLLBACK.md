# CP04-W1 mail containment rollback (training only)

Host: `https://training.cetechbpa.com` (`cetechtrainingappserver`).
Observer: WS3 senior / @wbdevworld.
Do not use this on production. Do not print `/home/cetechtraining/cetech-cp04-w1-rollback.json` into git or chat.

## Approved sink (this assignment)

The operator authorized CP04-W1 without naming an external mailbox. The approved non-customer sink is therefore:

- Logical recipient: `cp04-w1-sink@training.invalid` (RFC 2606 non-routable)
- Capture file: `/home/cetechtraining/cetech-cp04-w1-mail-sink.log` (outside webroot)
- Intercept: MU plugin `cetech-cp04-w1-mail-containment.php` (`pre_wp_mail` short-circuit)

## Restore previous destinations (only if the operator wants MailPoet/admin mail restored)

1. Confirm host `home` is still `https://training.cetechbpa.com` and `wp_get_environment_type()` is `staging`.
2. Read the host-local rollback JSON as site user `cetechtraining` (do not copy it off-host).
3. Restore `admin_email`, `woocommerce_stock_email_recipient`, and `woocommerce_new_order_settings` from that file via WP-CLI.
4. `wp plugin activate mailpoet` only if the operator wants MailPoet sending restored.
5. Remove MU `cetech-cp04-w1-mail-containment.php` only after destinations are restored, or mail will still be captured.
6. Keep Woo webhooks at 0 unless the operator separately authorizes destinations.

Do not automatically undo containment the operator intends to keep.
