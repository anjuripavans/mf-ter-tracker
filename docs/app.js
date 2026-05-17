/*  MF TER Tracker — Main App  */

let summaryData = null;
let chart = null;

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
        const catSel = document.getElementById("categoryFilter");
        summaryData.categories.forEach(function (cat) {
            var opt = document.createElement("option");
            opt.value = cat;
            opt.textContent = cat;
            catSel.appendChild(opt);
        });

        // Populate all schemes
        populateSchemes(summaryData.schemes);

    } catch (e) {
        document.getElementById("lastUpdated").textContent = "Error loading data";
        console.error(e);
    }
}

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

/* ====== FILTER BY CATEGORY ====== */
document.getElementById("categoryFilter").addEventListener("change", function () {
    var cat = this.value;
    var query = document.getElementById("searchInput").value.toLowerCase();
    filterAndPopulate(cat, query);
});

/* ====== SEARCH ====== */
document.getElementById("searchInput").addEventListener("input", function () {
    var query = this.value.toLowerCase();
    var cat = document.getElementById("categoryFilter").value;
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

/* ====== SCHEME SELECTED ====== */
document.getElementById("schemeFilter").addEventListener("change", function () {
    var id = this.value;
    if (!id) return;
    var scheme = summaryData.schemes.find(function (s) { return s.id === id; });
    if (scheme) selectScheme(scheme);
});

/* ====== SELECT SCHEME ====== */
async function selectScheme(scheme) {
    // Update KPI cards
    document.getElementById("avgBer").textContent = scheme.avg_ber.toFixed(4) + "%";
    document.getElementById("avgBrk").textContent = scheme.avg_brokerage.toFixed(4) + "%";
    document.getElementById("avgTxn").textContent = scheme.avg_transaction.toFixed(4) + "%";
    document.getElementById("avgStat").textContent = scheme.avg_statutory.toFixed(4) + "%";
    document.getElementById("avgTotal").textContent = scheme.avg_total_ter.toFixed(4) + "%";

    // Update scheme info
    document.getElementById("schemeName").textContent = scheme.scheme_name;
    document.getElementById("schemeCategory").textContent = scheme.category;
    document.getElementById("dateRange").textContent = scheme.date_from + " → " + scheme.date_to;
    document.getElementById("dataPoints").textContent = scheme.data_points + " days";

    // Load daily data
    try {
        var res = await fetch("data/daily/" + scheme.id + ".json");
        if (!res.ok) throw new Error("Daily data not found");
        var dailyData = await res.json();
        updateChart(dailyData, scheme.scheme_name);
        updateTable(dailyData);
    } catch (e) {
        console.error("Error loading daily data:", e);
    }
}

/* ====== CHART ====== */
function updateChart(data, name) {
    var ctx = document.getElementById("terChart").getContext("2d");
    if (chart) chart.destroy();

    chart = new Chart(ctx, {
        type: "line",
        data: {
            labels: data.map(function (d) { return d.date; }),
            datasets: [
                {
                    label: "BER",
                    data: data.map(function (d) { return d.ber; }),
                    borderColor: "#4CAF50",
                    backgroundColor: "rgba(76,175,80,0.08)",
                    fill: true, tension: 0.3, pointRadius: 2, borderWidth: 2
                },
                {
                    label: "Brokerage",
                    data: data.map(function (d) { return d.brokerage; }),
                    borderColor: "#FF9800",
                    backgroundColor: "rgba(255,152,0,0.08)",
                    fill: true, tension: 0.3, pointRadius: 2, borderWidth: 2
                },
                {
                    label: "Transaction",
                    data: data.map(function (d) { return d.transaction; }),
                    borderColor: "#2196F3",
                    backgroundColor: "rgba(33,150,243,0.08)",
                    fill: true, tension: 0.3, pointRadius: 2, borderWidth: 2
                },
                {
                    label: "Statutory",
                    data: data.map(function (d) { return d.statutory; }),
                    borderColor: "#9C27B0",
                    backgroundColor: "rgba(156,39,176,0.08)",
                    fill: true, tension: 0.3, pointRadius: 2, borderWidth: 2
                },
                {
                    label: "Total TER",
                    data: data.map(function (d) { return d.total_ter; }),
                    borderColor: "#F44336",
                    borderDash: [6, 3],
                    fill: false, tension: 0.3, pointRadius: 0, borderWidth: 2.5
                }
            ]
        },
        options: {
            responsive: true,
            plugins: {
                title: { display: true, text: "Daily TER — " + name, font: { size: 14 } },
                tooltip: { mode: "index", intersect: false }
            },
            scales: {
                y: { title: { display: true, text: "Expense Ratio (%)" }, beginAtZero: true },
                x: { title: { display: true, text: "Date" },
                     ticks: { maxTicksLimit: 15 } }
            },
            interaction: { mode: "nearest", axis: "x", intersect: false }
        }
    });
}

/* ====== TABLE ====== */
function updateTable(data) {
    var tbody = document.getElementById("dailyTableBody");
    tbody.innerHTML = "";

    // Most recent first
    var reversed = data.slice().reverse();

    reversed.forEach(function (d) {
        var tr = document.createElement("tr");
        tr.innerHTML =
            "<td>" + d.date + "</td>" +
            "<td>" + d.ber.toFixed(4) + "</td>" +
            "<td>" + d.brokerage.toFixed(4) + "</td>" +
            "<td>" + d.transaction.toFixed(4) + "</td>" +
            "<td>" + d.statutory.toFixed(4) + "</td>" +
            "<td><strong>" + d.total_ter.toFixed(4) + "</strong></td>";
        tbody.appendChild(tr);
    });
}

/* ====== START ====== */
init();
