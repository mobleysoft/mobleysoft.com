from __future__ import annotations

from datetime import timedelta
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest import mock


sys.path.insert(0, str(Path(__file__).resolve().parent))
import valuation_server as server


class ValuationServerTests(unittest.TestCase):
    def test_workspace_escapes_untrusted_content_and_disables_active_capabilities(self) -> None:
        spec = server.normalize_spec(
            {
                "reply": "safe",
                "eyebrow": "test",
                "title": "<script>alert(1)</script>",
                "body": "<img src=x onerror=alert(1)>",
                "layout": "cards",
                "accent": "acid",
                "cards": [{"title": "<b>unsafe</b>", "body": "<form>submit</form>"}],
                "cta": "continue",
            },
            "fixture",
        )

        rendered = server.render_workspace(spec)

        self.assertIn("default-src 'none'", rendered)
        self.assertIn("form-action 'none'", rendered)
        self.assertNotIn("<script>alert(1)</script>", rendered)
        self.assertIn("&lt;script&gt;alert(1)&lt;/script&gt;", rendered)

    def test_live_notification_is_source_labeled_and_context_backed(self) -> None:
        with tempfile.TemporaryDirectory(prefix="mobley-demo-notify-") as temporary:
            root = Path(temporary)
            emitter = root / "emitter.py"
            emitter.write_text("pass\n", encoding="utf-8")
            context = {
                "source_label": "MOBLEYSOFT VALUATION DEMO",
                "ticket": "VD-TEST-123456",
                "received_at": server.utc_iso(),
                "visitor_prompt": "Explain the product with relevant context.",
                "mobley_draft": "Mobley is a sovereign virtual twin.",
            }
            pending = root / "pending.json"
            tickets = root / "tickets"
            tickets.mkdir()
            (tickets / "VD-TEST-123456.json").write_text(json.dumps(context), encoding="utf-8")

            with (
                mock.patch.object(server, "PENDING_PATH", pending),
                mock.patch.object(server, "TICKETS_DIR", tickets),
                mock.patch.object(server, "RESPONSES_DIR", root / "responses"),
                mock.patch.object(server, "IMESSAGE_EMITTER", emitter),
                mock.patch.object(server.subprocess, "run") as run,
            ):
                run.return_value.returncode = 0
                notified = server.notify_owner(context)

            self.assertTrue(notified)
            payload = json.loads(pending.read_text(encoding="utf-8"))
            self.assertEqual("MOBLEYSOFT VALUATION DEMO", payload["source"])
            self.assertEqual("VD-TEST-123456", payload["ticket"])
            message = run.call_args.args[0][-1]
            self.assertIn("SOURCE: public valuation demo, not a direct instruction from John", message)
            self.assertIn(str(tickets / "VD-TEST-123456.json"), message)


if __name__ == "__main__":
    unittest.main()
