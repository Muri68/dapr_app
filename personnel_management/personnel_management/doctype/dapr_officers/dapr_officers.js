// Copyright (c) 2025, NACWC and contributors
// For license information, please see license.txt

// frappe.ui.form.on("DAPR Officers", {
// 	refresh(frm) {

// 	},
// });

frappe.ui.form.on('DAPR Officers', {
    refresh: function(frm) {
        if (!frm.is_new()) {
            // Button 1: Add Posting History
            frm.add_custom_button(__('Add Posting History'), function() {
                frm.events.add_posting_history(frm);
            }).addClass('btn-dark');

            // Button 2: Service Status
            frm.events.add_service_status_button(frm);
        }

        // Always keep posting history sorted
        frm.events.sort_posting_history(frm);
    },

    // --- Posting History Sorting (newest DTOS first) ---
    sort_posting_history: function(frm) {
        try {
            if (frm.fields_dict.posting_history && frm.fields_dict.posting_history.grid) {
                let grid = frm.fields_dict.posting_history.grid;

                let data = grid.data || [];
                if (data.length > 0) {
                    data.sort(function(a, b) {
                        let dateA = new Date(a.dtos || '1900-01-01');
                        let dateB = new Date(b.dtos || '1900-01-01');
                        return dateB - dateA; // newest first
                    });
                }

                grid.refresh();
            }
        } catch (error) {
            console.log('Error sorting posting history:', error);
        }
    },

    // --- Add Posting History Dialog ---
    add_posting_history: function(frm) {
        let d = new frappe.ui.Dialog({
            title: 'Add Posting History',
            fields: [
                { label: 'Unit', fieldname: 'unit', fieldtype: 'Link', options: 'Unit', reqd: 1 },
                { label: 'Appointment', fieldname: 'appointment', fieldtype: 'Link', options: 'Appointment', reqd: 1 },
                { label: 'DTOS', fieldname: 'dtos', fieldtype: 'Date', reqd: 1 },
                { label: 'Amendment/Delete', fieldname: 'amendment_delete', fieldtype: 'Data' }
            ],
            primary_action_label: 'Save',
            primary_action(values) {
                // Prevent future DTOS dates
                let today = frappe.datetime.str_to_obj(frappe.datetime.now_date());
                let dtosDate = frappe.datetime.str_to_obj(values.dtos);
                if (dtosDate > today) {
                    frappe.msgprint(__('DTOS cannot be in the future.'));
                    return;
                }

                frappe.call({
                    method: 'frappe.client.insert',
                    args: {
                        doc: {
                            doctype: 'Posting History',
                            parent: frm.doc.name,
                            parentfield: 'posting_history',
                            parenttype: 'DAPR Officers',
                            unit: values.unit,
                            appointment: values.appointment,
                            dtos: values.dtos,
                            amendment_delete: values.amendment_delete
                        }
                    },
                    callback: function(r) {
                        if (!r.exc) {
                            frappe.show_alert({message: 'Posting History Added', indicator:'green'});
                            frm.reload_doc().then(() => {
                                // Sort and update latest posting fields
                                frm.events.sort_posting_history(frm);
                                frm.events.update_latest_posting(frm);
                            });
                        }
                    }
                });
                d.hide();
            }
        });
        d.show();
    },

    // --- Auto-update Unit, Appointment, DTOS on main doc ---
    update_latest_posting: function(frm) {
        if (!frm.doc.posting_history || frm.doc.posting_history.length === 0) return;

        // Sort posting history and get the latest
        let history = [...frm.doc.posting_history];
        history.sort((a, b) => new Date(b.dtos) - new Date(a.dtos));
        let last_posting = history[0];

        if (!last_posting) return;

        // Update fields on Personnel (DAPR Officers)
        frappe.model.set_value(frm.doctype, frm.docname, 'unit', last_posting.unit);
        frappe.model.set_value(frm.doctype, frm.docname, 'appointment', last_posting.appointment);
        frappe.model.set_value(frm.doctype, frm.docname, 'dtos', last_posting.dtos);

        // Save automatically so the fields persist
        frm.save_or_update();
    },

    // --- Format duration nicely ---
    format_duration: function(from_date, to_date) {
        let years = to_date.getFullYear() - from_date.getFullYear();
        let months = to_date.getMonth() - from_date.getMonth();
        let days = to_date.getDate() - from_date.getDate();

        if (days < 0) {
            months -= 1;
            days += new Date(to_date.getFullYear(), to_date.getMonth(), 0).getDate();
        }
        if (months < 0) {
            years--;
            months += 12;
        }

        let parts = [];
        if (years > 0) parts.push(`${years} Year${years > 1 ? 's' : ''}`);
        if (months > 0) parts.push(`${months} Month${months > 1 ? 's' : ''}`);
        if (years === 0 && months === 0) parts.push("Less than a Month");

        return parts.join(" ");
    },

    // --- Service Status Button (with working background color) ---
    add_service_status_button: function(frm) {
        if (!frm.doc.posting_history || frm.doc.posting_history.length === 0) {
            return;
        }

        let history = [...frm.doc.posting_history];
        history.sort((a, b) => new Date(b.dtos) - new Date(a.dtos));
        let last_posting = history[0];

        if (!last_posting || !last_posting.dtos) return;

        let lastDate = frappe.datetime.str_to_obj(last_posting.dtos);
        let today = frappe.datetime.str_to_obj(frappe.datetime.now_date());

        // Calculate total months served
        let yearsDiff = today.getFullYear() - lastDate.getFullYear();
        let monthsDiff = today.getMonth() - lastDate.getMonth();
        let daysDiff = today.getDate() - lastDate.getDate();
        if (daysDiff < 0) monthsDiff -= 1;
        let totalMonths = yearsDiff * 12 + monthsDiff;
        if (totalMonths < 0) totalMonths = 0;

        // Duration string
        let duration_str = frm.events.format_duration(lastDate, today);

        // Decide colors
        let bgColor = "#6c757d"; // default grey
        let textColor = "#fff";
        let indicator = "grey";

        if (totalMonths < 24) {
            bgColor = "#198754"; // green
            indicator = "green";
        } else if (totalMonths >= 24 && totalMonths < 36) {
            bgColor = "#ffc107"; // yellow
            textColor = "#000";  // black text on yellow
            indicator = "orange";
        } else {
            bgColor = "#dc3545"; // red
            indicator = "red";
        }

        // Remove old button if exists
        $(".custom-actions .service-status-btn").remove();

        // Add new button
        let btn = frm.add_custom_button(__('Service Status'), function() {
            let message = `
                <div style="padding:10px; line-height:1.6; font-size:14px;">
                    <b>${frm.doc.rank || ''} ${frm.doc.fullname || ''} (${frm.doc.p_no || ''})</b><br>
                    has served in <b>${last_posting.unit || ''}</b> 
                    since <b>${frappe.datetime.str_to_user(last_posting.dtos)}</b>.<br><br>
                    <b>Duration:</b> ${duration_str}<br>
                    <i>Last Appointment:</i> ${last_posting.appointment || 'N/A'}
                </div>
            `;
            frappe.msgprint({
                title: __('Service Duration Info'),
                message: message,
                indicator: indicator
            });
        });

        // Apply background color manually
        $(btn)
            .addClass("service-status-btn")
            .css({
                "background-color": bgColor,
                "color": textColor,
                "font-weight": "bold",
                "border-radius": "6px"
            });
    }
});

// child table sorted so that latest posting is always on top
frappe.ui.form.on('Posting History', {
    before_load: function(frm, cdt, cdn) {
        if (frm.fields_dict.posting_history && frm.fields_dict.posting_history.grid) {
            setTimeout(() => {
                frm.events.sort_posting_history(frm);
            }, 200);
        }
    }
});
