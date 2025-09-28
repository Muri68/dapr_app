frappe.utils.rename_listview_column = function (old_label, new_label, listview) {
    setTimeout(() => {
        let headers = listview.$result.find(".list-row-head .list-header-subject");
        headers.each(function () {
            if ($(this).text().trim() === old_label) {
                $(this).text(new_label);
            }
        });
    }, 500);
};
