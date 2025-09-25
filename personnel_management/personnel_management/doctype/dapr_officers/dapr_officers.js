// Copyright (c) 2025, NACWC and contributors
// For license information, please see license.txt

// frappe.ui.form.on("DAPR Officers", {
// 	refresh(frm) {

// 	},
// });


frappe.ui.form.on("DAPR Officers", {
    refresh: function(frm) {
        sort_posting_history(frm);
    }
});

frappe.ui.form.on("Posting History", {
    posting_history_add: function(frm, cdt, cdn) {
        sort_posting_history(frm);
    }
});

function sort_posting_history(frm) {
    let grid = frm.fields_dict["posting_history"].grid;
    if (grid && frm.doc.posting_history && frm.doc.posting_history.length > 0) {
        // Sort by DTOS descending
        frm.doc.posting_history.sort((a, b) => {
            let dateA = a.dtos ? new Date(a.dtos) : new Date(0);
            let dateB = b.dtos ? new Date(b.dtos) : new Date(0);
            return dateB - dateA;
        });

        // Re-render grid with sorted data
        grid.refresh();
    }
}

