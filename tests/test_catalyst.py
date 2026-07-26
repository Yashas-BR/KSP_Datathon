import unittest

from app import create_app
from ksp.catalyst import _project_columns


class CatalystColumnProjectionTests(unittest.TestCase):
    def test_project_columns_matches_case_insensitive_headers(self) -> None:
        row = {"Casemasterid": "17811", "CrimeNo": "202300001"}

        projected = _project_columns(row, "CaseMasterID,CrimeNo")

        self.assertEqual(projected["CaseMasterID"], "17811")
        self.assertEqual(projected["CrimeNo"], "202300001")

    def test_network_payload_uses_name_based_offender_grouping(self) -> None:
        app = create_app()
        with app.test_request_context("/api/network?district_id=6&top=35"):
            from ksp.analytics import build_network_payload

            payload = build_network_payload(app.test_request_context().request, district_id=6, top=35)

        self.assertGreater(len(payload["repeatOffenders"]), 4)
        self.assertGreaterEqual(len(payload["repeatOffenders"]), 10)


if __name__ == "__main__":
    unittest.main()
