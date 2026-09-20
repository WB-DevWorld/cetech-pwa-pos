"""Security and identity guards for exact-SHA Git-source Preview."""
from pathlib import Path
from unittest.mock import patch
import io
import sys
import unittest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))
from exact_sha_preview import (
    PreviewError,
    REQUIRED_INDEPENDENT_APPROVAL_COUNT,
    REPOSITORY_REVIEWERS,
    build_id_report,
    create_payload,
    deploy_and_verify,
    github_actions_checks_succeeded,
    jobs_succeeded,
    main,
    independent_exact_head_approvers,
    production_hosts,
    project_git_link,
    require_main,
    select_ci_run,
    verify_github,
    verify_preview_identity,
    verify_pull_request,
    verify_review_authorization,
)

SHA = "7e9da309bddbccdabf41b8ba753351e8697041d9"
OLD_SHA = "f9c7c2aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
REPO = "WB-DevWorld/cetech-pwa-pos"
ENV = {
    "GITHUB_REF": "refs/heads/main",
    "GITHUB_REPOSITORY": REPO,
    "CANDIDATE_SHA": SHA,
    "PR_NUMBER": "80",
    "GH_TOKEN": "test-github-token",
    "GITHUB_API_URL": "https://api.github.com",
}


def review(login, state, sha, submitted_at, review_id, body=""):
    return {
        "id": review_id,
        "user": {"login": login},
        "state": state,
        "commit_id": sha,
        "submitted_at": submitted_at,
        "body": body,
    }


def both_exact_head_approvals():
    return [
        review("Ben-001-sys", "APPROVED", SHA, "2026-09-19T18:00:00Z", 11),
        review("Emmanuel-coder-prog", "APPROVED", SHA, "2026-09-19T18:01:00Z", 12),
    ]


def github_json_fixture(reviews, author="wbdevworld"):
    def github_json(path, token, api, repo, accept="application/vnd.github+json"):
        if "check-runs" in path:
            return {
                "check_runs": [
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
                ]
            }
        if path.startswith(f"/commits/{SHA}"):
            return {"sha": SHA}
        if path.startswith("/pulls/80/reviews"):
            return reviews
        if path.startswith("/pulls/80"):
            return {
                "state": "open",
                "user": {"login": author},
                "head": {
                    "sha": SHA,
                    "ref": "ws3/receipt-product-name-sku",
                    "repo": {"full_name": REPO},
                },
                "base": {"repo": {"full_name": REPO}},
            }
        if path.startswith("/actions/runs?"):
            return {
                "workflow_runs": [
                    {
                        "id": 1,
                        "name": "CI",
                        "path": ".github/workflows/ci.yml",
                        "status": "completed",
                        "conclusion": "success",
                    }
                ]
            }
        if "/jobs" in path:
            return {
                "jobs": [
                    {
                        "name": "control-plane",
                        "status": "completed",
                        "conclusion": "success",
                        "completed_at": "b",
                    },
                    {
                        "name": "control-plane-windows",
                        "status": "completed",
                        "conclusion": "success",
                        "completed_at": "b",
                    },
                ]
            }
        raise AssertionError(f"unexpected GitHub path {path}")

    return github_json


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

    def test_one_independent_exact_head_approval_satisfies_the_gate(self):
        self.assertEqual(1, REQUIRED_INDEPENDENT_APPROVAL_COUNT)
        self.assertEqual(
            ("Ben-001-sys", "Emmanuel-coder-prog", "wbdevworld"),
            REPOSITORY_REVIEWERS,
        )
        reviews = [review("Ben-001-sys", "APPROVED", SHA, "2026-09-19T18:00:00Z", 11)]
        self.assertEqual(
            ["Ben-001-sys"],
            independent_exact_head_approvers(reviews, SHA, author_login="wbdevworld"),
        )
        verify_review_authorization(reviews, SHA, author_login="wbdevworld")

    def test_either_authorized_non_author_reviewer_can_satisfy_the_gate(self):
        emmanuel = [review("Emmanuel-coder-prog", "APPROVED", SHA, "2026-09-19T18:00:00Z", 12)]
        verify_review_authorization(emmanuel, SHA, author_login="wbdevworld")
        both = both_exact_head_approvals()
        verify_review_authorization(both, SHA, author_login="wbdevworld")

    def test_approval_on_an_old_sha_fails(self):
        reviews = [
            review("Ben-001-sys", "APPROVED", OLD_SHA, "2026-09-19T17:00:00Z", 1),
            review("Emmanuel-coder-prog", "APPROVED", OLD_SHA, "2026-09-19T17:01:00Z", 2),
        ]
        with self.assertRaises(PreviewError) as caught:
            verify_review_authorization(reviews, SHA, author_login="wbdevworld")
        self.assertEqual("REVIEW_AUTHORIZATION_REQUIRED", caught.exception.summary)
        self.assertIn("independent exact-head APPROVED review", str(caught.exception))
        self.assertNotIn("secret", str(caught.exception))

    def test_old_changes_requested_then_exact_head_approved_succeeds(self):
        reviews = [
            review("Ben-001-sys", "CHANGES_REQUESTED", OLD_SHA, "2026-09-19T16:00:00Z", 1),
            review("Emmanuel-coder-prog", "CHANGES_REQUESTED", OLD_SHA, "2026-09-19T16:01:00Z", 2),
            review("Ben-001-sys", "APPROVED", SHA, "2026-09-19T18:00:00Z", 11),
        ]
        verify_review_authorization(reviews, SHA, author_login="wbdevworld")

    def test_later_changes_requested_supersedes_prior_approval(self):
        reviews = [
            review("Ben-001-sys", "APPROVED", SHA, "2026-09-19T18:00:00Z", 11),
            review("Ben-001-sys", "CHANGES_REQUESTED", SHA, "2026-09-19T19:00:00Z", 21),
        ]
        with self.assertRaises(PreviewError) as caught:
            verify_review_authorization(reviews, SHA, author_login="wbdevworld")
        self.assertEqual("REVIEW_AUTHORIZATION_REQUIRED", caught.exception.summary)

    def test_remaining_independent_approval_still_counts_after_another_reviewer_requests_changes(self):
        reviews = [
            review("Ben-001-sys", "APPROVED", SHA, "2026-09-19T18:00:00Z", 11),
            review("Emmanuel-coder-prog", "APPROVED", SHA, "2026-09-19T18:01:00Z", 12),
            review("Ben-001-sys", "CHANGES_REQUESTED", SHA, "2026-09-19T19:00:00Z", 21),
        ]
        verify_review_authorization(reviews, SHA, author_login="wbdevworld")
        self.assertEqual(
            ["Emmanuel-coder-prog"],
            independent_exact_head_approvers(reviews, SHA, author_login="wbdevworld"),
        )

    def test_unrelated_user_approval_does_not_count(self):
        reviews = [
            review("unrelated-reviewer", "APPROVED", SHA, "2026-09-19T18:00:00Z", 99),
        ]
        with self.assertRaises(PreviewError) as caught:
            verify_review_authorization(reviews, SHA, author_login="wbdevworld")
        self.assertEqual("REVIEW_AUTHORIZATION_REQUIRED", caught.exception.summary)
        self.assertNotIn("unrelated-reviewer", str(caught.exception))
        self.assertNotIn("do-not-print-this-review-body", str(caught.exception))

    def test_author_self_approval_cannot_satisfy_independent_review(self):
        reviews = [
            review("wbdevworld", "APPROVED", SHA, "2026-09-19T18:00:00Z", 3),
        ]
        with self.assertRaises(PreviewError) as caught:
            verify_review_authorization(reviews, SHA, author_login="wbdevworld")
        self.assertEqual("REVIEW_AUTHORIZATION_REQUIRED", caught.exception.summary)
        self.assertNotIn("wbdevworld", str(caught.exception))

    def test_author_who_is_also_an_authorized_reviewer_cannot_self_approve(self):
        reviews = [review("Ben-001-sys", "APPROVED", SHA, "2026-09-19T18:00:00Z", 11)]
        with self.assertRaises(PreviewError) as caught:
            verify_review_authorization(reviews, SHA, author_login="Ben-001-sys")
        self.assertEqual("REVIEW_AUTHORIZATION_REQUIRED", caught.exception.summary)

    def test_vercel_deploy_is_not_invoked_when_review_authorization_fails(self):
        reviews = [
            review(
                "Ben-001-sys",
                "COMMENTED",
                SHA,
                "2026-09-19T18:00:00Z",
                11,
                body="do-not-print-this-review-body",
            )
        ]
        with patch("exact_sha_preview.github_json", side_effect=github_json_fixture(reviews)), \
             patch("exact_sha_preview.deploy_and_verify") as deploy, \
             patch("exact_sha_preview.request_json") as vercel, \
             patch("sys.stderr", new_callable=io.StringIO) as stderr:
            code = main(["deploy"], env=dict(ENV))
        self.assertEqual(1, code)
        deploy.assert_not_called()
        vercel.assert_not_called()
        text = stderr.getvalue()
        self.assertIn("REVIEW_AUTHORIZATION_REQUIRED", text)
        self.assertNotIn("do-not-print-this-review-body", text)

    def test_deploy_and_verify_refuses_without_granted_review_authorization(self):
        with patch("exact_sha_preview.request_json") as vercel:
            with self.assertRaises(PreviewError) as caught:
                deploy_and_verify(
                    {"VERCEL_TOKEN": "token", "VERCEL_ORG_ID": "org", "VERCEL_PROJECT_ID": "prj"},
                    {"sha": SHA, "head_ref": "ws3/receipt-product-name-sku", "pr_number": "80"},
                )
        self.assertEqual("REVIEW_AUTHORIZATION_REQUIRED", caught.exception.summary)
        vercel.assert_not_called()

    def test_build_id_summary_distinguishes_requested_from_runtime_verified(self):
        lines = build_id_report(SHA, request_supplied=True, runtime_observed=None)
        text = "\n".join(lines)
        self.assertIn(f"Git source SHA: VERIFIED (`{SHA}`) from Vercel deployment metadata.", text)
        self.assertIn(
            f"BUILD_ID request: VERIFIED that the trusted deployment request supplied `{SHA}`.",
            text,
        )
        self.assertIn("Running application BUILD_ID: PENDING RUNTIME VERIFICATION.", text)
        self.assertNotIn("DEPLOYED_PREVIEW", text)
        captured = []
        with patch(
            "exact_sha_preview.verify_github",
            return_value={
                "sha": SHA,
                "pr_number": "80",
                "head_ref": "ws3/receipt-product-name-sku",
                "review_authorization": "granted",
            },
        ), patch(
            "exact_sha_preview.deploy_and_verify",
            return_value={
                "deployment_id": "dpl_example",
                "url": "https://example.vercel.app",
                "sha": SHA,
                "target": "preview",
                "build_id_request_supplied": True,
                "runtime_build_id": None,
            },
        ), patch("exact_sha_preview.write_summary", side_effect=lambda rows: captured.extend(rows)), \
             patch("exact_sha_preview.write_output"):
            code = main(["deploy"], env=dict(ENV))
        self.assertEqual(0, code)
        summary = "\n".join(captured)
        self.assertIn("PREVIEW_CREATED", summary)
        self.assertIn("PENDING RUNTIME VERIFICATION", summary)
        self.assertIn("trusted deployment request supplied", summary)
        self.assertNotIn("DEPLOYED_PREVIEW", summary)

    def test_github_verify_grants_review_authorization_when_one_independent_reviewer_approves(self):
        with patch(
            "exact_sha_preview.github_json",
            side_effect=github_json_fixture([
                review("Ben-001-sys", "APPROVED", SHA, "2026-09-19T18:00:00Z", 11),
            ]),
        ):
            verified = verify_github(dict(ENV))
        self.assertEqual("granted", verified["review_authorization"])
        self.assertEqual("Ben-001-sys", verified["independent_approvers"])
        self.assertEqual(SHA, verified["sha"])


if __name__ == "__main__":
    unittest.main()
