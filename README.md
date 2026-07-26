# KSP Datathon - Advanced Crime Analytics Platform

Welcome to the KSP Datathon project! This repository contains an advanced, data-driven web application designed to help the Karnataka State Police (KSP) analyze, visualize, and predict crime patterns across the state.

The platform provides a comprehensive suite of tools including spatial intelligence mapping, district performance comparisons, temporal cadence analysis, and emerging trend signals. It uses a Flask-based backend to serve REST APIs that process crime data and a modern HTML/CSS/JavaScript frontend for data visualization.

---

## 🌟 Key Features

*   **Spatial Intelligence Map:** Visualize state, district, and station-level crime density using heatmaps and marker views.
*   **District Performance Comparison:** Dynamically compares district performance based on crime clearance rates (Solved vs. Pending).
*   **Temporal Cadence:** Analyze hourly and month-over-month incident trends.
*   **Spatiotemporal Hotspots:** Identify high-risk zones and emerging crime spikes.
*   **Network Intelligence:** Map connections between individuals and incidents across police stations.
*   **Machine Learning Integration (QuickML):** Endpoints ready for risk prediction and anomaly detection models.
*   **Natural Language Query (NLQ):** Query data using natural language prompts.

---

## 🛠️ Technology Stack

*   **Backend:** Python 3, Flask, Flask-CORS
*   **Frontend:** HTML5, CSS3, Vanilla JavaScript, Chart.js, Leaflet.js
*   **Data Processing:** Custom Python analytics modules (`ksp/analytics.py`) processing CSV datasets (`data_v3/`).

---

## 🚀 Setup Instructions

### Prerequisites

Ensure you have the following installed on your system:
*   [Python 3.8+](https://www.python.org/downloads/)
*   [Git](https://git-scm.com/downloads) (optional, for cloning the repository)

### 1. Clone or Extract the Repository

Navigate to your workspace directory and open the project folder:
```bash
cd KSP_Datathon
```

### 2. Set up a Virtual Environment

It is highly recommended to use a virtual environment to manage dependencies.

**On Windows (Command Prompt / PowerShell):**
```bash
python -m venv venv
venv\Scripts\activate
```

**On macOS / Linux:**
```bash
python3 -m venv venv
source venv/bin/activate
```

### 3. Install Dependencies

Install the required Python packages using `pip`:
```bash
pip install -r requirements.txt
```
*(If `requirements.txt` is missing, you can install the core dependencies manually: `pip install flask flask-cors requests`)*

### 4. Configure Environment Variables (Optional)

If you need to change the default port or settings, you can create a `.env` file in the root directory:
```env
PORT=8000
FLASK_DEBUG=true
```

---

## 🏃 Execution Instructions

### Starting the Server

Ensure your virtual environment is activated, then run the Flask application:

```bash
python app.py
```

You should see output indicating that the server is running, typically:
```
 * Serving Flask app 'app'
 * Debug mode: on
 * Running on all addresses (0.0.0.0)
 * Running on http://127.0.0.1:8000
```

### Accessing the Dashboard

Open your web browser and navigate to:
**[http://localhost:8000](http://localhost:8000)**

*Note: The frontend static files are served automatically by the Flask backend.*

---

## 📂 Project Structure

*   `app.py` - The main Flask application and API route definitions.
*   `ksp/` - Contains backend analytics logic (`analytics.py`, `quickml.py`).
*   `frontend/` - Contains all frontend assets (`index.html`, `app.js`, `style.css`, etc.).
*   `data_v3/` - Directory for storing CSV datasets used by the backend.
*   `.env` - Environment configuration file.

---

## 🤝 Contributing

When contributing to this repository, please ensure that your code adheres to the existing architectural patterns. The frontend should remain lightweight (Vanilla JS/CSS preferred unless a framework is explicitly required), and the backend should focus on efficient data aggregation before sending payloads to the client.

## 📄 License

This project is created for the KSP Datathon. Please refer to the `LICENSE` file for usage rights and restrictions.