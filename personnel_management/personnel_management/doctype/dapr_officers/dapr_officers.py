# Copyright (c) 2025, NACWC and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import getdate, nowdate

class DAPROfficers(Document):
    def update_posting_status(self):
        """Automatically update posting_status based on the last DTOS in Posting History"""

        if not self.posting_history:
            self.posting_status = "Not Due"
            return

        last_posting = max(
            self.posting_history,
            key=lambda x: getdate(x.dtos) if x.dtos else getdate("1900-01-01")
        )

        if not last_posting.dtos:
            self.posting_status = "Not Due"
            return

        last_date = getdate(last_posting.dtos)
        today = getdate(nowdate())

        diff_days = (today - last_date).days
        diff_years = diff_days / 365.25

        if diff_years < 2:
            self.posting_status = "Not Due"
        elif 2 <= diff_years < 3:
            self.posting_status = "Due"
        else:
            self.posting_status = "Overdue"



def update_all_posting_status():
    """Update posting_status for all DAPR Officers (scheduler job)"""
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
