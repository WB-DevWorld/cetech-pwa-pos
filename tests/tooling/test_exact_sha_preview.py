"""Security and identity guards for exact-SHA Git-source Preview."""
from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))
from exact_sha_preview import (
    PreviewError,
    create_payload,
    github_actions_checks_succeeded,
    jobs_succeeded,
    production_hosts,
    project_git_link,
    require_main,
    select_ci_run,
    verify_preview_identity,
    verify_pull_request,
)

SHA = "7e9da309bddbccdabf41b8ba753351e8697041d9"


class ExactShaPreviewTests(unittest.TestCase):
    def test_dispatch_must_originate_from_main_in_this_repository(self):
        require_main("refs/heads/main", "WB-DevWorld/cetech-pwa-pos")
        with self.assertRaisesRegex(PreviewError, "protected main"):
            require_main("refs/heads/ws3/exact-sha-preview", "WB-DevWorld/cetech-pwa-pos")
        with self.assertRaisesRegex(PreviewError, "WB-DevWorld/cetech-pwa-pos"):
            require_main("refs/heads/main", "other/fork")

    def test_fork_pr_and_head_mismatch_are_rejected(self):
        with self.assertRaisesRegex(PreviewError, "forks are rejected"):
            verify_pull_request(
                {
                    "state": "open",
                    "head": {"sha": SHA, "ref": "feature", "repo": {"full_name": "other/fork"}},
                    "base": {"repo": {"full_name": "WB-DevWorld/cetech-pwa-pos"}},
                },
                SHA,
                "80",
            )
        with self.assertRaisesRegex(PreviewError, "does not equal candidate_sha"):
            verify_pull_request(
                {
                    "state": "open",
                    "head": {
                        "sha": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                        "ref": "ws3/receipt-product-name-sku",
                        "repo": {"full_name": "WB-DevWorld/cetech-pwa-pos"},
                    },
                    "base": {"repo": {"full_name": "WB-DevWorld/cetech-pwa-pos"}},
                },
                SHA,
                "80",
            )

    def test_open_same_repo_pr_head_match_returns_ref(self):
        ref = verify_pull_request(
            {
                "state": "open",
                "head": {
                    "sha": SHA,
                    "ref": "ws3/receipt-product-name-sku",
                    "repo": {"full_name": "WB-DevWorld/cetech-pwa-pos"},
                },
                "base": {"repo": {"full_name": "WB-DevWorld/cetech-pwa-pos"}},
            },
            SHA,
            "80",
        )
        self.assertEqual("ws3/receipt-product-name-sku", ref)

    def test_ci_source_identity_ignores_non_github_actions_checks(self):
        github_actions_checks_succeeded([
            {
                "name": "control-plane",
                "status": "completed",
                "conclusion": "success",
                "completed_at": "2026-09-19T17:30:00Z",
                "app": {"slug": "github-actions"},
            },
            {
                "name": "control-plane-windows",
                "status": "completed",
                "conclusion": "success",
                "completed_at": "2026-09-19T17:30:00Z",
                "app": {"slug": "github-actions"},
            },
            {
                "name": "control-plane",
                "status": "completed",
                "conclusion": "failure",
                "completed_at": "2026-09-19T18:00:00Z",
                "app": {"slug": "not-ci"},
            },
        ])
        with self.assertRaisesRegex(PreviewError, "Missing GitHub Actions CI checks"):
            github_actions_checks_succeeded([
                {
                    "name": "control-plane",
                    "status": "completed",
                    "conclusion": "success",
                    "completed_at": "2026-09-19T17:30:00Z",
                    "app": {"slug": "vercel"},
                },
            ])

    def test_ci_workflow_path_and_jobs_are_required(self):
        run = select_ci_run([
            {
                "id": 1,
                "name": "CI",
                "path": ".github/workflows/ci.yml",
                "status": "completed",
                "conclusion": "success",
            },
            {
                "id": 2,
                "name": "control-plane",
                "path": ".github/workflows/other.yml",
                "status": "completed",
                "conclusion": "success",
            },
        ])
        self.assertEqual(1, run["id"])
        jobs_succeeded([
            {"name": "control-plane", "status": "completed", "conclusion": "success", "completed_at": "b"},
            {"name": "control-plane-windows", "status": "completed", "conclusion": "success", "completed_at": "b"},
        ])
        with self.assertRaisesRegex(PreviewError, "Missing required GitHub Actions CI jobs"):
            jobs_succeeded([{"name": "control-plane", "status": "completed", "conclusion": "success"}])

    def test_git_source_payload_is_preview_only_and_sets_build_id(self):
        payload = create_payload("cetech-pos-staging", "prj_example", SHA, "ws3/receipt-product-name-sku", 123)
        self.assertNotIn("target", payload)
        self.assertEqual("github", payload["gitSource"]["type"])
        self.assertEqual(SHA, payload["gitSource"]["sha"])
        self.assertEqual(SHA, payload["env"]["BUILD_ID"])
        self.assertEqual(SHA, payload["build"]["env"]["BUILD_ID"])
        self.assertEqual("ws3/receipt-product-name-sku", payload["gitSource"]["ref"])

    def test_unlinked_vercel_project_stops_without_local_build(self):
        with self.assertRaisesRegex(PreviewError, "GIT_SOURCE_UNAVAILABLE"):
            project_git_link({})
        with self.assertRaisesRegex(PreviewError, "GIT_SOURCE_UNAVAILABLE"):
            project_git_link({"link": {"type": "github", "org": "other", "repo": "fork"}})

    def test_preview_identity_rejects_production_target_wrong_sha_and_protected_alias(self):
        with self.assertRaisesRegex(PreviewError, "not an immutable Preview"):
            verify_preview_identity({"target": "production", "gitSource": {"sha": SHA}}, SHA)
        with self.assertRaisesRegex(PreviewError, "does not equal candidate"):
            verify_preview_identity({"gitSource": {"sha": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}}, SHA)
        verify_preview_identity(
            {"target": None, "gitSource": {"sha": SHA}, "env": ["BUILD_ID=" + SHA]},
            SHA,
        )
        with self.assertRaisesRegex(PreviewError, "BUILD_ID"):
            verify_preview_identity(
                {"gitSource": {"sha": SHA}, "env": ["BUILD_ID=other"]},
                SHA,
            )
        with self.assertRaisesRegex(PreviewError, "protected production"):
            verify_preview_identity(
                {"gitSource": {"sha": SHA}, "alias": ["pos.example.com"]},
                SHA,
                protected_hosts={"pos.example.com"},
            )

    def test_production_hosts_are_collected_from_project_targets(self):
        hosts = production_hosts({
            "targets": {"production": {"alias": ["cetech-pos-staging.vercel.app"]}},
        })
        self.assertIn("cetech-pos-staging.vercel.app", hosts)


if __name__ == "__main__":
    unittest.main()
