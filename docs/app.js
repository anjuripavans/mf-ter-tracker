/*  MF TER Tracker v2 — Direct + Regular Plan with Autocomplete  */

let summaryData = null;
let chart = null;
let currentPlan = "direct";      // default plan
let currentScheme = null;        // currently selected scheme
let currentDailyData = null;     // daily data of selected scheme

/* ====== INIT ====== */
async function init() {
    try {
        const res = await fetch("data/summary.json");
        if (!res.ok) throw new Error("summary.json not found. Run the workflow first!");
        summaryData = await res.json();

        // Header meta
        document.getElementById("lastUpdated").textContent = summaryData.last_updated;
        document.getElementById("totalSchemes").textContent = summaryData.total_schemes.toLocaleString();
        document.getElementById("dataPeriod").textContent =
            summaryData.data_from + " to " + summaryData.data_to;

        // Populate category dropdown
        var catSel = document.getElementById("categoryFilter");
        summaryData.categories.forEach(function (cat) {
            var opt = document.createElement("option");
            opt.value = cat;
            opt.textContent = cat;
            catSel.appendChild(opt);
        });

        // Populate all schemes
        populateSchemes(summaryData.schemes);

        // Setup autocomplete
        setupAutocomplete();

    } catch (e) {
        document.getElementById("lastUpdated").textContent = "Error loading data";
        console.error(e);
    }
}


/* ====== PLAN TOGGLE ====== */
function switchPlan(plan) {
    currentPlan = plan;

    // Update toggle button styles
    document.getElementById("btnDirect").classList.remove("active");
    document.getElementById("btnRegular").classList.remove("active");
    if (plan === "direct") {
        document.getElementById("btnDirect").classList.add("active");
    } else {
        document.getElementById("btnRegular").classList.add("active");
    }

    // Update labels
    var label = plan === "direct" ? "Direct Plan" : "Regular Plan";
    document.getElementById("planLabel").textContent = label;
    document.getElementById("chartPlanLabel").textContent = label;
    document.getElementById("tablePlanLabel").textContent = label;

    // If a scheme is already selected, refresh its data with new plan
    if (currentScheme && currentDailyData) {
        updateKPICards(currentScheme);
        updateChart(currentDailyData, currentScheme.scheme_name);
        updateTable(currentDailyData);
    }
}

// Make switchPlan available globally (called from HTML onclick)
window.switchPlan = switchPlan;


/* ====== POPULATE SCHEME DROPDOWN ====== */
function populateSchemes(schemes) {
    var sel = document.getElementById("schemeFilter");
    sel.innerHTML = '<option value="">Select a scheme (' + schemes.length + " available)</option>";
    schemes.forEach(function (s) {
        var opt = document.createElement("option");
        opt.value = s.id;
        opt.textContent = s.scheme_name;
        sel.appendChild(opt);
    });
}


/* ====== AUTOCOMPLETE SEARCH ====== */
function setupAutocomplete() {
    var input = document.getElementById("searchInput");
    var dropdown = document.getElementById("autocompleteDropdown");

    // When user types
    input.addEventListener("input", function () {
        var query = this.value.toLowerCase().trim();
        var cat = document.getElementById("categoryFilter").value;

        // Also filter the scheme dropdown
        filterAndPopulate(cat, query);

        // Show autocomplete dropdown
        if (query.length < 2) {
            dropdown.classList.remove("show");
            dropdown.innerHTML = "";
            return;
        }

        var filtered = summaryData.schemes;
        if (cat) {
            filtered = filtered.filter(function (s) { return s.category === cat; });
        }
        filtered = filtered.filter(function (s) {
            return s.scheme_name.toLowerCase().indexOf(query) !== -1;
        });

        if (filtered.length === 0) {
            dropdown.innerHTML = '<div class="autocomplete-no-results">No schemes found</div>';
            dropdown.classList.add("show");
            return;
        }

        // Show max 15 results
        var results = filtered.slice(0, 15);
        dropdown.innerHTML = "";

        results.forEach(function (s) {
            var item = document.createElement("div");
            item.className = "autocomplete-item";

            // Highlight matching text
            var name = s.scheme_name;
            var lowerName = name.toLowerCase();
            var idx = lowerName.indexOf(query);
            var highlighted = name;
            if (idx !== -1) {
                highlighted =
                    name.substring(0, idx) +
                    '<span class="highlight">' +
                    name.substring(idx, idx + query.length) +
                    '</span>' +
                    name.substring(idx + query.length);
            }

            item.innerHTML =
                '<div>' + highlighted + '</div>' +
                '<div class="scheme-cat">' + s.category + '</div>';

            item.addEventListener("click", function () {
                // Set the search input value
                input.value = s.scheme_name;
                dropdown.classList.remove("show");

                // Select this scheme in the dropdown too
                var schemeSel = document.getElementById("schemeFilter");
                schemeSel.value = s.id;

                // Load the scheme
                selectScheme(s);
            });

            dropdown.appendChild(item);
        });

        // Show count if more results exist
        if (filtered.length > 15) {
            var more = document.createElement("div");
            more.className = "autocomplete-no-results";
            more.textContent = "... and " + (filtered.length - 15) + " more. Keep typing to narrow down.";
            dropdown.appendChild(more);
        }

        dropdown.classList.add("show");
    });

    // Close dropdown when clicking outside
    document.addEventListener("click", function (e) {
        if (!input.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.classList.remove("show");
        }
    });

    // Close dropdown on Escape key
    input.addEventListener("keydown", function (e) {
        if (e.key === "Escape") {
            dropdown.classList.remove("show");
        }
    });
}


/* ====== FILTER BY CATEGORY ====== */
document.getElementById("categoryFilter").addEventListener("change", function () {
    var cat = this.value;
    var query = document.getElementById("searchInput").value.toLowerCase();
    filterAndPopulate(cat, query);
});

function filterAndPopulate(cat, query) {
    var filtered = summaryData.schemes;
    if (cat) filtered = filtered.filter(function (s) { return s.category === cat; });
    if (query) filtered = filtered.filter(function (s) {
        return s.scheme_name.toLowerCase().indexOf(query) !== -1;
    });
    populateSchemes(filtered);
}


/* ====== SCHEME SELECTED (from dropdown) ====== */
document.getElementById("schemeFilter").addEventListener("change", function () {
    var id = this.value;
    if (!id) return;
    var scheme = summaryData.schemes.find(function (s) { return s.id === id; });
    if (scheme) {
        document.getElementById("searchInput").value = scheme.scheme_name;
        document.getElementById("autocompleteDropdown").classList.remove("show");
        selectScheme(scheme);
    }
});


/* ====== SELECT SCHEME ====== */
async function selectScheme(scheme) {
    currentScheme = scheme;

    // Update KPI cards
    updateKPICards(scheme);

    // Update scheme info
    document.getElementById("schemeName").textContent = scheme.scheme_name;
    document.getElementById("schemeType").textContent = scheme.scheme_type || "-";
    document.getElementById("schemeCategory").textContent = scheme.category;
    document.getElementById("dateRange").textContent = scheme.date_from + " → " + scheme.date_to;
    document.getElementById("dataPoints").textContent = scheme.data_points + " days";

    // Load daily data
    try {
        var res = await fetch("data/daily/" + scheme.id + ".json");
        if (!res.ok) throw new Error("Daily data not found");
        currentDailyData = await res.json();
        updateChart(currentDailyData, scheme.scheme_name);
        updateTable(currentDailyData);
    } catch (e) {
        console.error("Error loading daily data:", e);
        currentDailyData = null;
    }
}


/* ====== UPDATE KPI CARDS ====== */
function updateKPICards(scheme) {
    var p = currentPlan === "direct" ? "d" : "r";
    document.getElementById("avgBer").textContent = (scheme["avg_" + p + "_ber"] || 0).toFixed(4) + "%";
    document.getElementById("avgBrk").textContent = (scheme["avg_" + p + "_brokerage"] || 0).toFixed(4) + "%";
    document.getElementById("avgTxn").textContent = (scheme["avg_" + p + "_transaction"] || 0).toFixed(4) + "%";
    document.getElementById("avgStat").textContent = (scheme["avg_" + p + "_statutory"] || 0).toFixed(4) + "%";
    document.getElementById("avgTotal").textContent = (scheme["avg_" + p + "_total_ter"] || 0).toFixed(4) + "%";
}


/* ====== CHART ====== */
function updateChart(data, name) {
    var ctx = document.getElementById("terChart").getContext("2d");
    if (chart) chart.destroy();

    var p = currentPlan === "direct" ? "d" : "r";
    var planLabel = currentPlan === "direct" ? "Direct" : "Regular";

    chart = new Chart(ctx, {
        type: "line",
        data: {
            labels: data.map(function (d) { return d.date; }),
            datasets: [
                {
                    label: "BER",
                    data: data.map(function (d) { return d[p + "_ber"] || 0; }),
                    borderColor: "#4CAF50",
                    backgroundColor: "rgba(76,175,80,0.08)",
                    fill: true, tension: 0.3, pointRadius: 2, borderWidth: 2
                },
                {
                    label: "Brokerage",
                    data: data.map(function (d) { return d[p + "_brokerage"] || 0; }),
                    borderColor: "#FF9800",
                    backgroundColor: "rgba(255,152,0,0.08)",
                    fill: true, tension: 0.3, pointRadius: 2, borderWidth: 2
                },
                {
                    label: "Transaction",
                    data: data.map(function (d) { return d[p + "_transaction"] || 0; }),
                    borderColor: "#2196F3",
                    backgroundColor: "rgba(33,150,243,0.08)",
                    fill: true, tension: 0.3, pointRadius: 2, borderWidth: 2
                },
                {
                    label: "Statutory",
                    data: data.map(function (d) { return d[p + "_statutory"] || 0; }),
                    borderColor: "#9C27B0",
                    backgroundColor: "rgba(156,39,176,0.08)",
                    fill: true, tension: 0.3, pointRadius: 2, borderWidth: 2
                },
                {
                    label: "Total TER",
                    data: data.map(function (d) { return d[p + "_total_ter"] || 0; }),
                    borderColor: "#F44336",
                    borderDash: [6, 3],
                    fill: false, tension: 0.3, pointRadius: 0, borderWidth: 2.5
                }
            ]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: planLabel + " Plan TER — " + name,
                    font: { size: 14 }
                },
                tooltip: { mode: "index", intersect: false }
            },
            scales: {
                y: {
                    title: { display: true, text: "Expense Ratio (%)" },
                    beginAtZero: true
                },
                x: {
                    title: { display: true, text: "Date" },
                    ticks: { maxTicksLimit: 15 }
                }
            },
            interaction: { mode: "nearest", axis: "x", intersect: false }
        }
    });
}


/* ====== TABLE ====== */
function updateTable(data) {
    var tbody = document.getElementById("dailyTableBody");
    tbody.innerHTML = "";

    var p = currentPlan === "direct" ? "d" : "r";

    // Most recent first
    var reversed = data.slice().reverse();

    reversed.forEach(function (d) {
        var tr = document.createElement("tr");
        tr.innerHTML =
            "<td>" + d.date + "</td>" +
            "<td>" + (d[p + "_ber"] || 0).toFixed(4) + "</td>" +
            "<td>" + (d[p + "_brokerage"] || 0).toFixed(4) + "</td>" +
            "<td>" + (d[p + "_transaction"] || 0).toFixed(4) + "</td>" +
            "<td>" + (d[p + "_statutory"] || 0).toFixed(4) + "</td>" +
            "<td><strong>" + (d[p + "_total_ter"] || 0).toFixed(4) + "</strong></td>";
        tbody.appendChild(tr);
    });
}


/* ====== START ====== */
init();
