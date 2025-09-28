console.log("dapr_officer_list.js loaded");

frappe.listview_settings["DAPR Officers"] = {
    add_fields: ["posting_status"],

    get_indicator: function (doc) {
        if (doc.posting_status === "Not Due") {
            return [__("Not Due"), "green", "posting_status,=,Not Due"];
        } else if (doc.posting_status === "Due")  {
            return [__("Due"), "orange", "posting_status,=,Due"];
        } else if (doc.posting_status === "Overdue") {
            return [__("Overdue"), "red", "posting_status,=,Overdue"];
        }
    },

    onload: function(listview) {
        console.log("dapr_officer_list onload");

        // rename function: find header nodes that currently say "Status" and rename them
        function renameStatusHeader() {
            let renamed = false;
            // candidate selectors for various Frappe versions / themes
            const candidates = listview.$result.find(
                ".list-row-head .list-header-subject, " +
                ".list-row-head th, " +
                ".list-header-cell, " +
                "th, " +
                ".list-header-subject, " +
                ".list-row-head .list-header"
            );
            // also fallback to scan any element inside $result
            const all = listview.$result.find("*");

            const checkNodes = candidates.add(all);

            checkNodes.each(function () {
                const $el = $(this);
                const text = $el.text() ? $el.text().trim() : "";

                // match English "Status" or translated string
                if (text === "Status" || text === __("Status")) {
                    $el.text("Posting Status");
                    renamed = true;
                }
            });

            if (renamed) {
                console.log("Posting Status header renamed");
            }
            return renamed;
        }

        // Try immediate rename
        renameStatusHeader();

        // Short interval attempts (in case rendering is slightly delayed)
        let tries = 0;
        const intervalId = setInterval(() => {
            if (renameStatusHeader() || ++tries > 12) {
                clearInterval(intervalId);
            }
        }, 300);

        // MutationObserver to catch later DOM changes (robust)
        try {
            const targetNode = listview.$result && listview.$result[0];
            if (targetNode) {
                const mo = new MutationObserver((mutationsList, observer) => {
                    // attempt rename when any mutation occurs
                    renameStatusHeader();
                });
                mo.observe(targetNode, { childList: true, subtree: true });
                // store observer so it can be disconnected later if needed
                listview._posting_status_observer = mo;
            }
        } catch (e) {
            console.warn("MutationObserver not available or failed:", e);
        }
    }
};
