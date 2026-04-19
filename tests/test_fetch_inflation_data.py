import importlib.util
import pathlib
import unittest
from unittest import mock


ROOT = pathlib.Path(__file__).resolve().parents[1]
MODULE_PATH = ROOT / "scripts" / "fetch-inflation-data.py"

spec = importlib.util.spec_from_file_location("fetch_inflation_data", MODULE_PATH)
inflation = importlib.util.module_from_spec(spec)
spec.loader.exec_module(inflation)


class ParseEcbCsvSeriesTests(unittest.TestCase):
    def test_parse_ecb_csv_series_normalizes_months_and_skips_missing(self):
        csv_text = "\n".join(
            [
                "DATAFLOW,LAST UPDATE,FREQ,REF_AREA,ADJUSTMENT,ICP_ITEM,PROVIDER,UNIT,OBS_VALUE,TIME_PERIOD",
                "ECB,H, M,U2,N,000000,4D0,ANR,2.4,2025-01",
                "ECB,H, M,U2,N,000000,4D0,ANR,.,2025-02",
                "ECB,H, M,U2,N,000000,4D0,ANR,2.6,2025-03",
            ]
        )

        points = inflation.parse_ecb_csv_series(csv_text)

        self.assertEqual(
            points,
            [
                {"time": "2025-01-01", "value": 2.4},
                {"time": "2025-03-01", "value": 2.6},
            ],
        )


class BuildYoySeriesTests(unittest.TestCase):
    def test_build_yoy_series_converts_fred_index_levels_to_annual_rates(self):
        raw_points = [
            {"date": "2025-01-01", "value": 300.0},
            {"date": "2025-02-01", "value": 303.0},
            {"date": "2026-01-01", "value": 309.0},
            {"date": "2026-02-01", "value": 312.09},
        ]

        points = inflation.build_yoy_series(raw_points)

        self.assertEqual(
            points,
            [
                {"time": "2026-01-01", "value": 3.0},
                {"time": "2026-02-01", "value": 3.0},
            ],
        )


class FetchEcbSeriesPointsTests(unittest.TestCase):
    def test_fetch_ecb_series_points_uses_dimension_key_not_prefixed_series_id(self):
        config = {
            "label": "EU HICP",
            "flow_ref": "HICP",
            "series_key": "M.U2.N.000000.4D0.ANR",
        }

        with mock.patch.object(inflation, "fetch_text", return_value="OBS_VALUE,TIME_PERIOD\n2.6,2026-03\n") as fetch_text:
            points = inflation.fetch_ecb_series_points(config, "2020-01-01")

        self.assertEqual(points, [{"time": "2026-03-01", "value": 2.6}])
        fetch_text.assert_called_once()
        url, params = fetch_text.call_args.args[:2]
        self.assertEqual(url, f"{inflation.ECB_DATA_API_URL}/HICP/M.U2.N.000000.4D0.ANR")
        self.assertEqual(params["startPeriod"], "2020-01")
        self.assertEqual(params["format"], "csvdata")

    def test_fetch_ecb_series_points_falls_back_to_legacy_icp_flow(self):
        config = {
            "label": "EU Core HICP",
            "flow_ref": "HICP",
            "series_key": "M.U2.N.XEF000.4D0.ANR",
            "fallback_flow_ref": "ICP",
            "fallback_series_key": "M.U2.N.XEF000.4.ANR",
        }

        def fake_fetch_text(url, params, accept="application/json"):
            if "/HICP/" in url:
                raise RuntimeError("HTTP Error 400: Bad Request")
            return "OBS_VALUE,TIME_PERIOD\n2.1,2026-03\n"

        with mock.patch.object(inflation, "fetch_text", side_effect=fake_fetch_text) as fetch_text:
            points = inflation.fetch_ecb_series_points(config, "2020-01-01")

        self.assertEqual(points, [{"time": "2026-03-01", "value": 2.1}])
        self.assertEqual(fetch_text.call_count, 2)


class BuildPayloadTests(unittest.TestCase):
    def test_build_payload_combines_us_and_eu_series(self):
        us_points = [{"date": "2026-03-01", "value": 3.0}]
        eu_points = [{"time": "2026-03-01", "value": 2.5}]

        with mock.patch.object(inflation, "fetch_series_points", return_value=us_points), mock.patch.object(
            inflation, "fetch_ecb_series_points", return_value=eu_points
        ):
            payload = inflation.build_payload(5, "fred-key")

        self.assertEqual(len(payload["series"]), len(inflation.US_SERIES) + len(inflation.EU_SERIES))
        self.assertTrue(any(item["label"] == "EU Core HICP" for item in payload["series"]))
        self.assertEqual(payload["warnings"], [])


if __name__ == "__main__":
    unittest.main()
