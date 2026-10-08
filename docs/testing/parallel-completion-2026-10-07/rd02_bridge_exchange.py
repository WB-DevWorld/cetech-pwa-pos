#!/usr/bin/env python3
"""Owner-authorized RD-02 candidate bridge exchange on training only."""
from __future__ import annotations

import hashlib
import os
import subprocess
import time
from pathlib import Path

TASK = Path("/home/cetechtraining/cetech-timing-release")
PLUGIN = Path("/home/cetechtraining/htdocs/training.cetechbpa.com/wp-content/plugins/cetech-pos-bridge")
WP = Path("/home/cetechtraining/htdocs/training.cetechbpa.com")
LOG = Path("/home/cetechtraining/tmp/rd02-bridge-exchange-20261008b.log")

EXPECTED_MAIN = "63094753eb380b57c1e7e6db1a172ead3a295112e538d6722ffb4325f7ff58ab"
EXPECTED_RUNTIME = "89e4461c3ff7e7ef2dc6ff525751f799f4b92604d655880e9840256128deb76c"


def run(cmd: list[str], check: bool = True) -> subprocess.CompletedProcess[str]:
    print("+", " ".join(cmd), flush=True)
    proc = subprocess.run(cmd, text=True, capture_output=True)
    if proc.stdout:
        print(proc.stdout, end="", flush=True)
    if proc.stderr:
        print(proc.stderr, end="", flush=True)
    if check and proc.returncode != 0:
        raise SystemExit(f"cmd failed {proc.returncode}: {cmd}")
    return proc


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> int:
    LOG.parent.mkdir(parents=True, exist_ok=True)
    with LOG.open("w", encoding="utf-8") as logf:
        def log(msg: str) -> None:
            print(msg, flush=True)
            logf.write(msg + "\n")
            logf.flush()

        log("=== RD-02 bridge exchange start ===")
        # Preflight staged hashes
        main_h = sha256(TASK / "staged" / "cetech-pos-bridge.php")
        runtime_h = sha256(TASK / "staged" / "includes" / "class-woo-runtime.php")
        log(f"staged_main={main_h}")
        log(f"staged_runtime={runtime_h}")
        if main_h != EXPECTED_MAIN or runtime_h != EXPECTED_RUNTIME:
            raise SystemExit("staged hashes do not match approved candidate")

        wp_prior = run(
            ["systemctl", "show", "cetech-training-wp-cron.timer", "-p", "ActiveState", "--value"]
        ).stdout.strip()
        mail_prior = run(
            ["systemctl", "show", "cetech-training-mailpoet-cron.timer", "-p", "ActiveState", "--value"]
        ).stdout.strip()
        log(f"timers_prior wp={wp_prior} mail={mail_prior}")

        try:
            if wp_prior == "active":
                run(["systemctl", "stop", "cetech-training-wp-cron.timer"])
            if mail_prior == "active":
                run(["systemctl", "stop", "cetech-training-mailpoet-cron.timer"])
            time.sleep(1)
            run(["systemctl", "is-active", "cetech-training-wp-cron.service"], check=False)
            run(["systemctl", "is-active", "cetech-training-mailpoet-cron.service"], check=False)

            maint = WP / ".maintenance"
            maint.write_text(f'<?php\n$upgrading = "{int(time.time())}";\n', encoding="utf-8")
            st = WP.stat()
            os.chown(maint, st.st_uid, st.st_gid)
            log("maintenance written")

            idle = False
            for i in range(1, 31):
                log(f"drain_read_{i}")
                # Idle drain is --signed-off alone. --phase is only for verifier
                # (candidate|baseline|gate-on|gate-off).
                proc = run(
                    ["python3", str(TASK / "fpm_status_read.py"), "--signed-off"],
                    check=False,
                )
                if proc.returncode == 0:
                    idle = True
                    log("drain_idle")
                    break
                log(f"drain_rc={proc.returncode}")
                time.sleep(2)
            if not idle:
                raise SystemExit("drain_failed")

            log("exchange candidate")
            run(
                [
                    "python3",
                    str(TASK / "rename_exchange.py"),
                    "--signed-off",
                    str(PLUGIN),
                    str(TASK / "staged"),
                ]
            )

            got_main = sha256(PLUGIN / "cetech-pos-bridge.php")
            got_runtime = sha256(PLUGIN / "includes" / "class-woo-runtime.php")
            log(f"live_main={got_main}")
            log(f"live_runtime={got_runtime}")
            if got_main != EXPECTED_MAIN or got_runtime != EXPECTED_RUNTIME:
                raise SystemExit("post-exchange hashes mismatch")
            proof = (PLUGIN / "includes" / "class-woo-runtime.php").read_text(encoding="utf-8", errors="replace")
            count = proof.count("assert_prepared_order_operation_identity")
            log(f"identity_proof_count={count}")
            if count < 1:
                raise SystemExit("identity proof missing after exchange")

            maint.unlink(missing_ok=True)
            log("maintenance cleared")
        finally:
            if wp_prior == "active":
                run(["systemctl", "start", "cetech-training-wp-cron.timer"], check=False)
            if mail_prior == "active":
                run(["systemctl", "start", "cetech-training-mailpoet-cron.timer"], check=False)
            log(
                "timers "
                + run(["systemctl", "is-active", "cetech-training-wp-cron.timer"], check=False).stdout.strip()
                + " "
                + run(["systemctl", "is-active", "cetech-training-mailpoet-cron.timer"], check=False).stdout.strip()
            )
            if (WP / ".maintenance").exists():
                (WP / ".maintenance").unlink(missing_ok=True)
                log("maintenance force-cleared in finally")

        log("=== RD-02 bridge exchange end ===")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
