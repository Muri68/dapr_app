# Copyright (c) 2025, NACWC and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import getdate, nowdate
import re


class DAPROfficers(Document):
    def validate(self):
        """Auto-calculate numeric_p_no and posting_status."""
        # Generate numeric_p_no (extract digits)
        if self.p_no:
            m = re.search(r"\d+", self.p_no)
            self.numeric_p_no = int(m.group()) if m else 0
        else:
            self.numeric_p_no = 0

        # Update posting status
        self.update_posting_status()

    def update_posting_status(self):
        """Update posting_status based on last DTOS (with same Unit logic)."""
        if not self.posting_history:
            self.posting_status = "Not Due"
            return

        # Sort posting history by DTOS ascending (oldest first)
        valid_postings = [p for p in self.posting_history if p.dtos]
        if not valid_postings:
            self.posting_status = "Not Due"
            return

        valid_postings.sort(key=lambda x: getdate(x.dtos))

        # Get the latest posting (most recent)
        latest = valid_postings[-1]
        latest_unit = (latest.unit or "").strip().lower()

        # Walk backwards to find oldest posting in same consecutive unit
        earliest_same_unit = latest
        for p in reversed(valid_postings[:-1]):
            unit = (p.unit or "").strip().lower()
            if unit == latest_unit:
                earliest_same_unit = p
            else:
                # stop once we reach a different unit
                break

        # Use earliest same-unit DTOS
        dtos_to_use = getdate(earliest_same_unit.dtos)
        today = getdate(nowdate())
        diff_days = (today - dtos_to_use).days
        diff_years = diff_days / 365.25

        if diff_years < 2:
            self.posting_status = "Not Due"
        elif 2 <= diff_years < 3:
            self.posting_status = "Due"
        else:
            self.posting_status = "Overdue"


def update_all_posting_status():
    """Scheduler job to update posting_status for all DAPR Officers."""
    officers = frappe.get_all("DAPR Officers", pluck="name")
    updated = 0

    for name in officers:
        try:
            doc = frappe.get_doc("DAPR Officers", name)
            old_status = doc.posting_status
            doc.update_posting_status()
            if doc.posting_status != old_status:
                doc.save(ignore_permissions=True, ignore_version=True)
                updated += 1
        except Exception as e:
            frappe.logger().error(f"Failed updating officer {name}: {e}")

    frappe.db.commit()
    frappe.logger().info(f"[Scheduler] Posting Status updated for {updated} officers")
    return f"Updated {updated} officers"
