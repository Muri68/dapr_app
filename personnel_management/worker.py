import time
import frappe
from personnel_management.personnel_management.doctype.dapr_officers.dapr_officers import update_all_posting_status

def start_worker():
    while True:
        try:
            frappe.connect(site="dapr.army.mil.ng")  # replace with your site name
            result = update_all_posting_status()
            frappe.logger().info(f"[Manual Worker] {result}")
        except Exception as e:
            frappe.logger().error(f"[Manual Worker Error] {str(e)}")
        finally:
            frappe.destroy()
        
        time.sleep(60)  # wait 1 minute
