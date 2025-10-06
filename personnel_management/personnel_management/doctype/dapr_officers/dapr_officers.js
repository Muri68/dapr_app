// Copyright (c) 2025, NACWC and contributors
// For license information, please see license.txt

frappe.ui.form.on('DAPR Officers', {
    refresh: function(frm) {
        if (!frm.is_new()) {
            frm.add_custom_button(__('Add Posting History'), function() {
                frm.events.add_posting_history(frm);
            }).addClass('btn-dark');

            frm.events.add_service_status_button(frm);
        }

        frm.events.sort_posting_history(frm);
    },

    // --- Sort posting history newest first ---
    sort_posting_history: function(frm) {
        try {
            if (frm.fields_dict.posting_history && frm.fields_dict.posting_history.grid) {
                let grid = frm.fields_dict.posting_history.grid;
                let data = grid.data || [];
                if (data.length > 0) {
                    data.sort((a, b) => new Date(b.dtos || '1900-01-01') - new Date(a.dtos || '1900-01-01'));
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
                            frappe.show_alert({ message: 'Posting History Added', indicator: 'green' });
                            frm.reload_doc().then(() => {
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

    update_latest_posting: function(frm) {
        if (!frm.doc.posting_history || frm.doc.posting_history.length === 0) return;

        let history = [...frm.doc.posting_history];
        history.sort((a, b) => new Date(b.dtos) - new Date(a.dtos));
        let last_posting = history[0];
        if (!last_posting) return;

        frappe.model.set_value(frm.doctype, frm.docname, 'unit', last_posting.unit);
        frappe.model.set_value(frm.doctype, frm.docname, 'appointment', last_posting.appointment);
        frappe.model.set_value(frm.doctype, frm.docname, 'dtos', last_posting.dtos);
        frm.save_or_update();
    },

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

    // --- Service Status Button (with live status indicator & detailed explanation) ---
    add_service_status_button: function(frm) {
        if (!frm.doc.posting_history || frm.doc.posting_history.length === 0) return;

        let history = [...frm.doc.posting_history];
        history.sort((a, b) => new Date(b.dtos) - new Date(a.dtos)); // newest first

        let current_unit = history[0].unit;
        let relevant_postings = [];

        // Collect consecutive postings in the same Unit (most recent block)
        for (let i = 0; i < history.length; i++) {
            if (history[i].unit === current_unit) {
                relevant_postings.push(history[i]);
            } else {
                break; // stop once officer was posted elsewhere
            }
        }

        // Get earliest DTOS in this block
        let earliest = relevant_postings.reduce((a, b) =>
            new Date(a.dtos) < new Date(b.dtos) ? a : b
        );

        let from_date = frappe.datetime.str_to_obj(earliest.dtos);
        let today = frappe.datetime.str_to_obj(frappe.datetime.now_date());

        // Duration calculations
        let yearsDiff = today.getFullYear() - from_date.getFullYear();
        let monthsDiff = today.getMonth() - from_date.getMonth();
        let daysDiff = today.getDate() - from_date.getDate();
        if (daysDiff < 0) monthsDiff -= 1;
        let totalMonths = yearsDiff * 12 + monthsDiff;
        if (totalMonths < 0) totalMonths = 0;

        let duration_str = frm.events.format_duration(from_date, today);

        // Determine status color and message
        let bgColor = "#6c757d", textColor = "#fff", indicator = "grey";
        let status_label = "Not Due";
        let explanation = "";

        if (totalMonths < 24) {
            bgColor = "#198754"; // green
            indicator = "green";
            status_label = "Not Due";
            explanation = `The officer has served ${duration_str} in ${current_unit}, which is less than 2 years.`;
        } else if (totalMonths >= 24 && totalMonths < 36) {
            bgColor = "#ffc107"; // yellow
            textColor = "#000";
            indicator = "orange";
            status_label = "Due";
            explanation = `The officer has served ${duration_str} in ${current_unit}, continuously since ${frappe.datetime.str_to_user(earliest.dtos)}, and is now due for posting.`;
        } else {
            bgColor = "#dc3545"; // red
            indicator = "red";
            status_label = "Overdue";
            explanation = `The officer has served ${duration_str} in ${current_unit}, exceeding the 3-year limit and is overdue for rotation.`;
        }

        // Build posting summary (only if more than one consecutive posting)
        let posting_table_html = "";
        if (relevant_postings.length > 1) {
            let posting_list_html = relevant_postings
                .map((p, i) => `
                    <tr>
                        <td style="padding:4px 8px;">${i + 1}</td>
                        <td style="padding:4px 8px;">${p.unit}</td>
                        <td style="padding:4px 8px;">${p.appointment || ''}</td>
                        <td style="padding:4px 8px;">${frappe.datetime.str_to_user(p.dtos)}</td>
                    </tr>
                `)
                .join("");

            posting_table_html = `
                <br>
                <b>Consecutive Postings in ${current_unit}:</b><br>
                <table style="border-collapse:collapse; margin-top:6px; font-size:13px;">
                    <thead style="font-weight:bold; border-bottom:1px solid #ccc;">
                        <tr>
                            <th style="padding:4px 8px;">#</th>
                            <th style="padding:4px 8px;">Unit</th>
                            <th style="padding:4px 8px;">Appointment</th>
                            <th style="padding:4px 8px;">DTOS</th>
                        </tr>
                    </thead>
                    <tbody>${posting_list_html}</tbody>
                </table>
                <div style="margin-top:10px; font-style:italic; color:#666;">
                    (Only the earliest postings in the same Unit is considered.)
                </div>
            `;
        }

        // Final message
        let message = `
            <div style="padding:10px; line-height:1.6; font-size:14px;">
                <b>${frm.doc.rank || ''} ${frm.doc.fullname || ''} (${frm.doc.p_no || ''})</b><br>
                has been serving in <b>${current_unit}</b> since <b>${frappe.datetime.str_to_user(earliest.dtos)}</b>.<br><br>

                <b>Status:</b> ${status_label}<br>
                <b>Duration:</b> ${duration_str}<br><br>

                <b>Reason:</b> ${explanation}
                ${posting_table_html}
            </div>
        `;

        // Remove old button if exists
        $(".custom-actions .service-status-btn").remove();

        // Add a dynamic Service Status button
        let btn_text = `Service Status: ${status_label}`;
        let btn = frm.add_custom_button(__(btn_text), function() {
            frappe.msgprint({
                title: __('Service Duration Info'),
                message: message,
                indicator: indicator
            });
        });

        $(btn)
            .addClass("service-status-btn")
            .css({
                "background-color": bgColor,
                "color": textColor,
                "font-weight": "bold",
                "border-radius": "6px",
                "border": "none",
                "padding": "6px 12px"
            });
    }

});

// Keep child table sorted
frappe.ui.form.on('Posting History', {
    before_load: function(frm, cdt, cdn) {
        if (frm.fields_dict.posting_history && frm.fields_dict.posting_history.grid) {
            setTimeout(() => frm.events.sort_posting_history(frm), 200);
        }
    }
});
