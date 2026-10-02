import unittest

from scripts.check_staff_docs_impact import (
    NO_IMPACT_LABEL,
    UPDATED_LABEL,
    validate_declaration,
)


class StaffDocumentationImpactTests(unittest.TestCase):
    def test_requires_exactly_one_selection(self) -> None:
        self.assertTrue(validate_declaration("", ["apps/pos-web/src/app/page.tsx"]))
        body = f"- [x] {UPDATED_LABEL}\n- [x] {NO_IMPACT_LABEL}\n"
        self.assertTrue(validate_declaration(body, ["docs/staff/README.md"]))

    def test_updated_requires_canonical_staff_doc_change(self) -> None:
        body = f"- [x] {UPDATED_LABEL}\n- [ ] {NO_IMPACT_LABEL}\n"
        self.assertTrue(validate_declaration(body, ["apps/pos-web/src/features/sell/SellScreen.tsx"]))
        self.assertEqual(
            validate_declaration(body, ["docs/staff/STAFF-TRAINING-GUIDE.md"]),
            [],
        )

    def test_no_impact_is_explicit_and_does_not_require_doc_change(self) -> None:
        body = f"- [ ] {UPDATED_LABEL}\n- [x] {NO_IMPACT_LABEL}\n"
        self.assertEqual(
            validate_declaration(body, ["tests/tooling/test_example.py"]),
            [],
        )


if __name__ == "__main__":
    unittest.main()
