# CP04-W4 rollback (training only)

Host: `https://training.cetechbpa.com`.
Do not print `/home/cetechtraining/cetech-cp04-w4-app-password.secret`.
Do not automatically undo W1 mail containment.

## If the operator wants the bridge identity kept (default after this assignment)

Keep the subscriber `cetech-pos-bridge-svc`, capability `cetech_pos_bridge_access`, and host-local Application Password. Rotate by creating a new Application Password with WP-CLI/PHP and deleting uuid `6bd36d36-1da6-424f-af0f-d54809f78bd5`.

## If the operator wants W4 undone

1. Confirm `home` is `https://training.cetechbpa.com` and environment type is `staging`.
2. Delete Application Passwords for user ID 22 (or delete uuid `6bd36d36-1da6-424f-af0f-d54809f78bd5`).
3. Remove capability `cetech_pos_bridge_access` from `cetech-pos-bridge-svc`.
4. Disable or delete that subscriber if no longer needed.
5. `wp plugin deactivate cetech-pos-bridge` then delete `wp-content/plugins/cetech-pos-bridge` if required.
6. Remove `/home/cetechtraining/cetech-cp04-w4-app-password.secret` and `/home/cetechtraining/cetech-cp04-w4-bff.env`.
7. Leave W1 intercept/MailPoet inactive unless the operator asks to restore mail.
