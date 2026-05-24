# 📈 Mutual Fund Expense Ratio Tracker (MFTer)

An automated, serverless web application that tracks and compares the daily **Total Expense Ratios (TER)** of mutual funds and ETFs in India. It fetches daily disclosures directly from the **Association of Mutual Funds in India (AMFI)** to help investors identify low-cost funds and compare Direct vs. Regular plans.

**Live Website:** [mfter.vyneralabs.com](https://mfter.vyneralabs.com)

---

## ✨ Features

- **Automated Daily Updates**: Runs on a scheduled GitHub Actions workflow that downloads, parses, and updates the database from AMFI's daily disclosures.
- **Smart "Quick Compare" Presets**: Compare the cheapest 5 funds instantly across major categories (Nifty 50 Index, Nifty Next 50, Midcap 150, Smallcap 250, Flexi Cap, Large Cap, Mid Cap, Small Cap, Multi Cap, and ELSS).
- **5-Slot Side-by-Side Comparison**: Compare up to 5 custom mutual funds side-by-side with color-coded highlights showing the best value for metrics like Base Expense Ratio (BER), Brokerage, Transaction costs, and Statutory charges.
- **Dynamic ETF Data Reconciler**: Normalizes and mirrors ETF plan data (solving inconsistent AMC reporting across Direct/Regular columns) so they are identical across both plans.
- **Interactive Historical Charting**: Dynamic line charts powered by Chart.js showing historical trends for Base Expense Ratio (BER) and Total TER from April 2026 onwards.
- **Premium, Fully Responsive Layout**: Built with a sleek dark-and-teal theme, optimized for mobile devices with no focus-zoom issues and crisp high-DPI charts.
- **SEO & AI-Search Optimized**: Includes sitemaps, structured JSON-LD schemas, and open indexing settings allowing ChatGPT Search, Gemini, Claude, and Perplexity to read and cite the tracker.

---

## 🛠️ Architecture & Tech Stack

This project is built to run entirely serverless, requiring **zero infrastructure hosting costs** and serving data with high performance.

- **Frontend**: Vanilla HTML5, Custom CSS3 Variables, and Modern Vanilla JavaScript (ES5/ES6 compatible, zero framework dependencies).
- **Charts**: Chart.js for data visualization.
- **Data Storage**: Local JSON files. The dataset is split into `summary.json` (for fast initial loads and overview stats) and individual scheme files under `docs/data/daily/` (loaded asynchronously on demand).
- **Backend Automation**: A Node.js parsing script runs daily via **GitHub Actions** to fetch AMFI text disclosures, calculate averages, structure datasets, and commit updates automatically.
- **Hosting**: GitHub Pages mapped to a custom subdomain.

---

## 🚀 Local Development

Since the site is serverless, you do not need to install complex compilers or node modules to run the UI.

1. Clone the repository:
   ```bash
   git clone https://github.com/vyneralabs/mf-ter-tracker-main.git
   cd mf-ter-tracker-main
   ```

2. To view the website, serve the `docs/` folder using any static web server:
   * **Python 3**:
     ```bash
     python -m http.server -d docs/
     ```
   * **Node.js (`npx`)**:
     ```bash
     npx -y http-server docs/
     ```

3. Open your browser and navigate to `http://localhost:8000`.

---

## 📅 Daily Data Ingestion Pipeline

The backend data collection script is located under the `scripts/` directory:
- `.github/workflows/daily_download.yml` runs a cron job daily to execute the download script.
- The pipeline downloads the AMFI disclosures, filters entries from April 1st, 2026 onwards, calculates rolling averages, resolves ETF Direct/Regular reporting inconsistencies, and generates the individual JSON files.

---

## 🔒 Attribution & Data License

- **Data Source**: Daily disclosures provided by the [Association of Mutual Funds in India (AMFI)](https://www.amfiindia.com/).
- **Disclaimer**: This tool is for informational and educational purposes only. Expense ratios can change daily; please verify the final ratios with the respective AMC before making investment decisions.

---

## ✉️ Contact & Support

Created and maintained by **Anjuri Pavan Sai Kumar** (VyneraLabs).
- **LinkedIn**: [anjuripavan](https://www.linkedin.com/in/anjuripavan/)
- **Email**: [vyneralabs@gmail.com](mailto:vyneralabs@gmail.com)
